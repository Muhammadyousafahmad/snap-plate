-- Name the user chose when saving a meal to History/audit.
-- The prompt "by which name do you want to save this meal?" runs before the
-- scan is written, so older rows simply keep a NULL name.

alter table public.scans
  add column if not exists meal_name text;
