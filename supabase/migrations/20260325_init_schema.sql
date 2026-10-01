-- SnapPlate user profiles and nutrition scan data.
-- All application data is isolated by the authenticated user's auth.uid().

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  scanned_at timestamptz not null default now(),
  total_calories numeric(12, 2) not null default 0 check (total_calories >= 0),
  total_protein_g numeric(12, 2) not null default 0 check (total_protein_g >= 0),
  total_carbs_g numeric(12, 2) not null default 0 check (total_carbs_g >= 0),
  total_fat_g numeric(12, 2) not null default 0 check (total_fat_g >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scan_items (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans (id) on delete cascade,
  position smallint not null check (position >= 0),
  name text not null,
  portion text not null default '',
  calories numeric(12, 2) not null default 0 check (calories >= 0),
  protein_g numeric(12, 2) not null default 0 check (protein_g >= 0),
  carbs_g numeric(12, 2) not null default 0 check (carbs_g >= 0),
  fat_g numeric(12, 2) not null default 0 check (fat_g >= 0),
  original_grams numeric(10, 2) check (original_grams is null or original_grams > 0),
  calories_per_100g numeric(12, 4) check (calories_per_100g is null or calories_per_100g >= 0),
  protein_per_100g numeric(12, 4) check (protein_per_100g is null or protein_per_100g >= 0),
  carbs_per_100g numeric(12, 4) check (carbs_per_100g is null or carbs_per_100g >= 0),
  fat_per_100g numeric(12, 4) check (fat_per_100g is null or fat_per_100g >= 0),
  matched boolean not null default true,
  created_at timestamptz not null default now(),
  unique (scan_id, position)
);

create index scans_user_id_scanned_at_idx
  on public.scans (user_id, scanned_at desc);
create index scan_items_scan_id_idx
  on public.scan_items (scan_id, position);

-- Keep profile rows and modified timestamps current without trusting clients.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger scans_set_updated_at
before update on public.scans
for each row execute function public.set_updated_at();

-- Existing auth users created before this migration also need profile rows before
-- they can own scans. New users are handled by handle_new_user().

insert into public.profiles (id, email, full_name, avatar_url)
select
  users.id,
  coalesce(users.email, ''),
  coalesce(users.raw_user_meta_data ->> 'full_name', users.raw_user_meta_data ->> 'name'),
  users.raw_user_meta_data ->> 'avatar_url'
from auth.users as users
on conflict (id) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
      updated_at = now();

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.scans enable row level security;
alter table public.scan_items enable row level security;

create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Users can read their own scans"
on public.scans for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own scans"
on public.scans for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own scans"
on public.scans for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own scans"
on public.scans for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read items in their own scans"
on public.scan_items for select
to authenticated
using (
  exists (
    select 1
    from public.scans
    where scans.id = scan_items.scan_id
      and scans.user_id = (select auth.uid())
  )
);

create policy "Users can create items in their own scans"
on public.scan_items for insert
to authenticated
with check (
  exists (
    select 1
    from public.scans
    where scans.id = scan_items.scan_id
      and scans.user_id = (select auth.uid())
  )
);

create policy "Users can update items in their own scans"
on public.scan_items for update
to authenticated
using (
  exists (
    select 1
    from public.scans
    where scans.id = scan_items.scan_id
      and scans.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.scans
    where scans.id = scan_items.scan_id
      and scans.user_id = (select auth.uid())
  )
);

create policy "Users can delete items in their own scans"
on public.scan_items for delete
to authenticated
using (
  exists (
    select 1
    from public.scans
    where scans.id = scan_items.scan_id
      and scans.user_id = (select auth.uid())
  )
);

revoke all on table public.profiles, public.scans, public.scan_items from anon;
grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.scans to authenticated;
grant select, insert, update, delete on table public.scan_items to authenticated;

