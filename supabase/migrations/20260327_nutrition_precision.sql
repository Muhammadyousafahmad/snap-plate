-- Preserve raw USDA per-100g baselines so repeated portion edits never compound
-- rounding error.

alter table public.scan_items
  add column if not exists calories_per_100g numeric(12, 4),
  add column if not exists protein_per_100g numeric(12, 4),
  add column if not exists carbs_per_100g numeric(12, 4),
  add column if not exists fat_per_100g numeric(12, 4);
