-- Run this once in the Supabase SQL Editor.
--
-- Part 1: lets an admin manually add a lead that came from a phone call,
-- WhatsApp, or walk-in -- not through the website's own inquiry form.
-- `buyer_id` becomes optional (a manual lead has no real signed-up
-- account), and a manual lead instead carries a name/phone typed in by
-- the admin, plus which channel it came from.

alter table inquiries
  alter column buyer_id drop not null;

alter table inquiries
  add column if not exists contact_name text;

alter table inquiries
  add column if not exists contact_phone text;

alter table inquiries
  add column if not exists source text not null default 'website_form';

alter table inquiries
  drop constraint if exists inquiries_source_check;

alter table inquiries
  add constraint inquiries_source_check
  check (source in ('website_form', 'phone_call', 'whatsapp', 'walk_in', 'other'));

-- Every row must be identifiable one way or another: either a real
-- buyer_id (website form) or a contact_name (manual entry) -- never
-- neither.
alter table inquiries
  drop constraint if exists inquiries_has_contact_check;

alter table inquiries
  add constraint inquiries_has_contact_check
  check (buyer_id is not null or contact_name is not null);

-- Part 2: adds a phone column to profiles. Nothing currently writes to
-- it yet -- the signup form still only asks for email/password -- this
-- just makes the column exist so it's ready once that's decided. Every
-- existing profile will simply have phone = null until then.

alter table profiles
  add column if not exists phone text;
