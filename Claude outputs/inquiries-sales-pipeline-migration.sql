-- Run this once in the Supabase SQL Editor.
--
-- Extends the EXISTING `inquiries` table (buyer messages sent to sellers
-- from a property page -- unchanged, still works exactly as before) into a
-- real sales pipeline the admin can manage: a status per inquiry, and the
-- ability to allot it to a registered broker or agent for the site visit.
-- Nothing about the existing buyer/seller inquiry flow changes.

-- Defensive: make sure RLS is actually on before adding admin policies
-- below (idempotent if it's already enabled).
alter table inquiries enable row level security;

alter table inquiries
  add column if not exists status text not null default 'new';

alter table inquiries
  drop constraint if exists inquiries_status_check;

alter table inquiries
  add constraint inquiries_status_check
  check (
    status in (
      'new',
      'contacted',
      'site_visit_scheduled',
      'closed_won',
      'closed_lost'
    )
  );

alter table inquiries
  add column if not exists assigned_to uuid references auth.users(id) on delete set null;

alter table inquiries
  add column if not exists admin_notes text;

alter table inquiries
  add column if not exists updated_at timestamptz not null default now();

create index if not exists inquiries_status_idx on inquiries(status);
create index if not exists inquiries_assigned_to_idx on inquiries(assigned_to);

-- Admins need to see and manage EVERY inquiry across every listing (not
-- just sellers seeing their own properties' inquiries, which the existing
-- policy on this table already covers). These are additive -- they don't
-- touch or remove any existing policy.
drop policy if exists "Admins can view all inquiries" on inquiries;
create policy "Admins can view all inquiries" on inquiries for select using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can update all inquiries" on inquiries;
create policy "Admins can update all inquiries" on inquiries for update using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);
