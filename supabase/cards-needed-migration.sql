alter table public.products
add column if not exists cards_needed integer not null default 0;

update public.products
set cards_needed = coalesce(nullif(cards_needed, 0), price::integer, 0)
where cards_needed = 0;
