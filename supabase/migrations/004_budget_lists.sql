-- Budget del viaggio e liste condivise (bagagli, cose da fare)
alter table public.trips add column if not exists budget numeric(12,2) check (budget is null or budget > 0);

create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  list text not null default 'bagagli' check (list in ('bagagli', 'cose')),
  text text not null check (char_length(text) between 1 and 200),
  done boolean not null default false,
  member_id uuid references public.members(id) on delete set null,
  created_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists list_items_trip_idx on public.list_items (trip_id, list, created_at);
alter table public.list_items enable row level security;
create policy list_items_select on public.list_items for select to authenticated using (public.is_member(trip_id));
create policy list_items_insert on public.list_items for insert to authenticated
  with check (public.is_member(trip_id) and created_by = public.my_member_id(trip_id));
create policy list_items_update on public.list_items for update to authenticated
  using (public.is_member(trip_id)) with check (public.is_member(trip_id));
create policy list_items_delete on public.list_items for delete to authenticated using (public.is_member(trip_id));
alter publication supabase_realtime add table public.list_items;
