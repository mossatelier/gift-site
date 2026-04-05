create table if not exists public.admin_users (
  email text primary key,
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "Admin users can read self row" on public.admin_users;
create policy "Admin users can read self row"
on public.admin_users
for select
to authenticated
using (
  lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
);

drop policy if exists "Public read active products" on public.products;
create policy "Public read active products"
on public.products
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "Quick start insert products" on public.products;
drop policy if exists "Quick start update products" on public.products;
drop policy if exists "Quick start delete products" on public.products;

drop policy if exists "Admins can read all products" on public.products;
create policy "Admins can read all products"
on public.products
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users au
    where lower(au.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);

drop policy if exists "Admins can insert products" on public.products;
create policy "Admins can insert products"
on public.products
for insert
to authenticated
with check (
  exists (
    select 1
    from public.admin_users au
    where lower(au.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);

drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products"
on public.products
for update
to authenticated
using (
  exists (
    select 1
    from public.admin_users au
    where lower(au.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
)
with check (
  exists (
    select 1
    from public.admin_users au
    where lower(au.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);

drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products"
on public.products
for delete
to authenticated
using (
  exists (
    select 1
    from public.admin_users au
    where lower(au.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);

drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'product-images');

drop policy if exists "Quick start upload product images" on storage.objects;
drop policy if exists "Quick start update product images" on storage.objects;
drop policy if exists "Quick start delete product images" on storage.objects;

drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.admin_users au
    where lower(au.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);

drop policy if exists "Admins can update product images" on storage.objects;
create policy "Admins can update product images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.admin_users au
    where lower(au.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
)
with check (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.admin_users au
    where lower(au.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);

drop policy if exists "Admins can delete product images" on storage.objects;
create policy "Admins can delete product images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.admin_users au
    where lower(au.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
);

comment on table public.admin_users is
'List of allowed backend operators. Add one row per admin email after creating the auth user.';
