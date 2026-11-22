-- Sezioni nelle liste e voci manuali dell'itinerario
alter table public.list_items add column if not exists section text not null default 'Altro' check (char_length(section) between 1 and 40);

create table if not exists public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day date not null,
  at_time time,
  kind text not null default 'nota' check (kind in ('nota', 'attivita', 'pasto', 'spostamento', 'luogo')),
  text text not null check (char_length(text) between 1 and 500),
  place text check (place is null or char_length(place) <= 200),
  created_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists itinerary_items_trip_idx on public.itinerary_items (trip_id, day, at_time);
alter table public.itinerary_items enable row level security;
create policy itinerary_items_select on public.itinerary_items for select to authenticated using (public.is_member(trip_id));
create policy itinerary_items_insert on public.itinerary_items for insert to authenticated
  with check (public.is_member(trip_id) and created_by = public.my_member_id(trip_id));
create policy itinerary_items_update on public.itinerary_items for update to authenticated
  using (public.is_member(trip_id)) with check (public.is_member(trip_id));
create policy itinerary_items_delete on public.itinerary_items for delete to authenticated using (public.is_member(trip_id));
alter publication supabase_realtime add table public.itinerary_items;
