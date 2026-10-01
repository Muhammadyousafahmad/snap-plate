-- Add private meal-photo storage after the initial SnapPlate schema.

alter table public.scans
add column if not exists image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meal-images',
  'meal-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read their own meal images" on storage.objects;
drop policy if exists "Users can upload their own meal images" on storage.objects;
drop policy if exists "Users can delete their own meal images" on storage.objects;

create policy "Users can read their own meal images"
on storage.objects for select
to authenticated
using (
  bucket_id = 'meal-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can upload their own meal images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'meal-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can delete their own meal images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'meal-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
