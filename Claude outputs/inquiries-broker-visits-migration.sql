-- ============================================================
-- Broker visit assignment + verification for the inquiries table
-- ============================================================
-- Run this once in the Supabase SQL Editor, AFTER
-- properties-rls-migration.sql has already been run.
--
-- What this adds:
--   - Four new columns on inquiries so a broker can record proof
--     that they actually completed a site visit you assigned them.
--   - RLS policies so a broker/agent can see ONLY the leads you've
--     assigned to them (assigned_to = their own user id), and can
--     update ONLY the visit-verification fields on those rows --
--     not the lead's contact info, status, or admin notes.
--   - A trigger that enforces that column-level restriction, since
--     a row policy alone can't stop a broker from editing OTHER
--     columns on a row they're allowed to update at all.
--
-- Nothing about how the app looks today changes until you also
-- ship the code that uses these columns (the broker dashboard,
-- the updated Sales Pipeline admin view). Running this migration
-- alone is safe on its own.
-- ============================================================

alter table public.inquiries
  add column if not exists visit_completed boolean not null default false,
  add column if not exists visit_note text,
  add column if not exists visit_photo_url text,
  add column if not exists visit_completed_at timestamptz;

-- ------------------------------------------------------------
-- A broker/agent can see the leads assigned to them.
-- (Admins already have "view all" from the earlier migration --
-- this is additive, just for the broker's own account.)
-- ------------------------------------------------------------
drop policy if exists "Brokers can view their assigned visits" on public.inquiries;
create policy "Brokers can view their assigned visits"
  on public.inquiries
  for select
  using (auth.uid() = assigned_to);

-- ------------------------------------------------------------
-- A broker/agent can update a row assigned to them -- but the
-- trigger below stops that from touching anything except the
-- four visit_* columns.
-- ------------------------------------------------------------
drop policy if exists "Brokers can update their assigned visits" on public.inquiries;
create policy "Brokers can update their assigned visits"
  on public.inquiries
  for update
  using (auth.uid() = assigned_to)
  with check (auth.uid() = assigned_to);

-- ------------------------------------------------------------
-- Lock every column except visit_completed / visit_note /
-- visit_photo_url / visit_completed_at when the person making
-- the change is the assigned broker rather than an admin.
--
-- This is what stops a broker from using a direct API call to
-- reassign a lead to themselves, change its status, read/alter
-- another lead's admin_notes, or edit the buyer's contact info --
-- the UI would never offer that, but RLS alone can't block one
-- column while allowing another on the same row, so this backs
-- it up exactly like lock_property_verification_status() does
-- for properties.verification_status.
-- ------------------------------------------------------------
create or replace function public.lock_inquiry_fields_for_broker()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean;
begin
  select exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  ) into is_admin;

  if is_admin then
    return new;
  end if;

  -- Not an admin: only the visit_* columns may change. Every
  -- other column snaps back to its previous value, no matter
  -- what the request tried to send.
  new.property_id      := old.property_id;
  new.buyer_id          := old.buyer_id;
  new.contact_name      := old.contact_name;
  new.contact_phone     := old.contact_phone;
  new.source            := old.source;
  new.message           := old.message;
  new.status            := old.status;
  new.assigned_to       := old.assigned_to;
  new.admin_notes       := old.admin_notes;
  new.created_at        := old.created_at;

  -- A broker can only ever confirm a visit, not un-confirm one
  -- that's already verified -- stops accidentally wiping proof.
  if old.visit_completed = true then
    new.visit_completed    := old.visit_completed;
    new.visit_note         := old.visit_note;
    new.visit_photo_url    := old.visit_photo_url;
    new.visit_completed_at := old.visit_completed_at;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists lock_inquiry_fields_for_broker on public.inquiries;
create trigger lock_inquiry_fields_for_broker
  before update on public.inquiries
  for each row
  execute function public.lock_inquiry_fields_for_broker();

-- ============================================================
-- Done. Quick smoke test after running this:
--   1. As admin, open Admin -> Sales Pipeline -- everything
--      should look and work exactly as before.
--   2. Log in as a broker/agent account that has a lead
--      assigned to them -- they should NOT see this yet in the
--      UI (that's the next piece), but once the broker dashboard
--      page ships, they should see only their own assigned leads.
-- Safe rollback if anything breaks:
--   drop trigger if exists lock_inquiry_fields_for_broker on public.inquiries;
--   drop policy if exists "Brokers can view their assigned visits" on public.inquiries;
--   drop policy if exists "Brokers can update their assigned visits" on public.inquiries;
-- ============================================================
