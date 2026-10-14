-- ============================================================
-- Row Level Security for the properties table
-- ============================================================
-- Run this once in the Supabase SQL Editor.
--
-- Today this table has ZERO policies. That means the ONLY thing
-- stopping a random visitor -- using nothing but the public anon
-- key, no login at all -- from reading every pending or rejected
-- listing, or inserting / editing / deleting ANY property row in
-- the database, is that the app's own screens never offer that
-- button. A direct API call bypasses that completely. This closes
-- that gap. Nothing about how the app itself behaves changes --
-- every screen (map, Add Property, Edit Property, My Properties,
-- Property Approval) keeps working exactly as it does today.
--
-- What this sets up:
--   - Anyone (including not logged in) can read approved listings
--     -- this is what the public map/search needs.
--   - A seller can always see, edit, and re-submit their own
--     listings, whatever their approval status.
--   - Only an admin can read pending/rejected listings that
--     aren't theirs, approve/reject a listing, or delete one.
--   - A seller cannot approve their own listing by editing it
--     directly (see the trigger at the bottom) -- RLS row
--     policies alone can't lock down a single column, so a
--     trigger backs that up.
-- ============================================================

alter table public.properties enable row level security;

-- Buyers / visitors (including not logged in) can read approved listings.
drop policy if exists "Public can read approved properties" on public.properties;
create policy "Public can read approved properties"
  on public.properties
  for select
  using (verification_status = 'approved');

-- A seller can always see their own listings, whatever their status.
drop policy if exists "Sellers can read their own properties" on public.properties;
create policy "Sellers can read their own properties"
  on public.properties
  for select
  using (auth.uid() = seller_id);

-- Admins can read everything, including pending/rejected listings.
drop policy if exists "Admins can read all properties" on public.properties;
create policy "Admins can read all properties"
  on public.properties
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- A logged-in seller can only create a listing under their own account
-- (stops one account from listing a property as if it belonged to
-- someone else's seller_id).
drop policy if exists "Sellers can insert their own properties" on public.properties;
create policy "Sellers can insert their own properties"
  on public.properties
  for insert
  with check (auth.uid() = seller_id);

-- A seller can update their own listing (edit details, mark Sold, etc).
-- The trigger below stops this from being used to self-approve.
drop policy if exists "Sellers can update their own properties" on public.properties;
create policy "Sellers can update their own properties"
  on public.properties
  for update
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

-- Admins can update any listing -- this is what keeps Property
-- Approval's Approve/Reject buttons working after RLS is turned on.
drop policy if exists "Admins can update all properties" on public.properties;
create policy "Admins can update all properties"
  on public.properties
  for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- Only admins can delete a listing outright.
drop policy if exists "Admins can delete properties" on public.properties;
create policy "Admins can delete properties"
  on public.properties
  for delete
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- ------------------------------------------------------------
-- Lock verification_status so only an admin can change it.
--
-- The "Sellers can update their own properties" policy above has
-- to allow updates to a seller's own row (so they can fix a typo,
-- change the price, mark it Sold), but that would also let a
-- seller flip their own verification_status straight to
-- 'approved' with a direct API call. A row-level policy can't
-- single out one column, so this trigger does: it silently
-- resets verification_status back to whatever it already was,
-- unless the person making the change is an admin.
-- ------------------------------------------------------------
create or replace function public.lock_property_verification_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verification_status is distinct from old.verification_status then
    if not exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    ) then
      new.verification_status := old.verification_status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists lock_property_verification_status on public.properties;
create trigger lock_property_verification_status
  before update on public.properties
  for each row
  execute function public.lock_property_verification_status();

-- ============================================================
-- Done. After running this, please do a quick smoke test:
--   1. Browse the public map while logged out -- approved
--      listings should still show up as normal.
--   2. Log in as a seller and open My Properties -- your own
--      pending/rejected listings should still be visible to you.
--   3. In Admin -> Property Approval, approve or reject a
--      listing -- it should still work exactly as before.
-- If any of those break, the fix is safe to roll back by running:
--   alter table public.properties disable row level security;
-- ============================================================
