-- 99Bricks: track where a listing's pin came from (2026-10-14)
-- Run this once in the Supabase SQL Editor.
--
-- Add Property / Edit Property now let a seller or broker paste a shared
-- Google/Apple Maps link (or plain coordinates) instead of requiring
-- "Use my current location" to always mean they're standing at the
-- property right now -- useful for a broker who has a WhatsApp-shared
-- pin for a listing they haven't physically visited yet. This column
-- records which of the four ways a pin was actually set, so the admin
-- Property Approval screen can flag "location_source = pasted_link" for
-- a closer look during the review every listing already goes through,
-- the same way a GPS or manually-dropped pin doesn't need one.

alter table public.properties
  add column if not exists location_source text default 'map_click';

-- Existing rows all predate this feature -- they were all set either by
-- clicking/dragging the pin or (less commonly) "Use my current
-- location," neither of which needs a second look, so backfilling them
-- to 'map_click' (the DEFAULT above already does this automatically for
-- rows that existed before this column was added) is the safe, accurate
-- assumption and needs no separate UPDATE statement.

alter table public.properties
  drop constraint if exists properties_location_source_valid;

alter table public.properties
  add constraint properties_location_source_valid
  check (
    location_source is null
    or location_source in ('map_click', 'search', 'gps', 'pasted_link')
  );

-- ============================================================
-- Done. Quick smoke test after running this:
--   1. Add Property / Edit Property should both still save a normal
--      listing exactly as before (pin clicked/dragged/searched/GPS all
--      still work).
--   2. On Add Property, click "Paste a shared location," paste a
--      Google Maps link, confirm the pin lands in the right place, and
--      that the saved listing has location_source = 'pasted_link':
--        select id, title, location_source from public.properties
--        order by id desc limit 1;
-- Roll back with:
--   alter table public.properties drop constraint if exists properties_location_source_valid;
--   alter table public.properties drop column if exists location_source;
-- ============================================================
