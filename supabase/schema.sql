create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  price numeric(10, 2) not null default 0,
  cards_needed integer not null default 0,
  description text not null default '',
  image_url text not null,
  action_label text not null default '立即领取',
  action_url text not null default '#service',
  sort_order integer not null default 10,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_products_set_updated_at on public.products;
create trigger trg_products_set_updated_at
before update on public.products
for each row
execute function public.set_updated_at();

alter table public.products enable row level security;

drop policy if exists "Public read active products" on public.products;
create policy "Public read active products"
on public.products
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "Quick start insert products" on public.products;
create policy "Quick start insert products"
on public.products
for insert
to anon, authenticated
with check (true);

drop policy if exists "Quick start update products" on public.products;
create policy "Quick start update products"
on public.products
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Quick start delete products" on public.products;
create policy "Quick start delete products"
on public.products
for delete
to anon, authenticated
using (true);

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'product-images');

drop policy if exists "Quick start upload product images" on storage.objects;
create policy "Quick start upload product images"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'product-images');

drop policy if exists "Quick start update product images" on storage.objects;
create policy "Quick start update product images"
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'product-images')
with check (bucket_id = 'product-images');

drop policy if exists "Quick start delete product images" on storage.objects;
create policy "Quick start delete product images"
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'product-images');

comment on table public.products is
'Quick start version for static frontend + mobile admin form. Current policies are convenience-first. Before public launch, replace anon write policies with authenticated-only policies.';
