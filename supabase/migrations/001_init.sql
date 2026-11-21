-- App viaggi di gruppo — schema iniziale
-- Tabelle, regole di accesso (RLS), funzioni per creare/entrare nei viaggi, storage privato.

create extension if not exists pgcrypto;

-- PROFILI ---------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  paypal_me text,
  iban text,
  locale text not null default 'it',
  accepted_terms_at timestamptz,
  created_at timestamptz not null default now()
);

-- VIAGGI ----------------------------------------------------------------
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  destination text,
  dest_lat double precision,
  dest_lon double precision,
  start_date date,
  end_date date,
  currency text not null default 'EUR',
  cover_color text not null default '#0E6B58',
  simplify_debts boolean not null default true,
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  calendar_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 60),
  role text not null default 'member' check (role in ('organizer', 'member', 'guest')),
  color text not null default '#0F1B2D',
  created_at timestamptz not null default now(),
  unique (trip_id, user_id)
);
create index on public.members (user_id);
create index on public.members (trip_id);

-- DOCUMENTI -------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  category text not null check (category in ('voli','alloggi','trasporti','attivita','assicurazione','personali','altro')),
  title text not null check (char_length(title) between 1 and 160),
  starts_at timestamptz,
  ends_at timestamptz,
  ref_code text,
  address text,
  notes text,
  visibility text not null default 'group' check (visibility in ('group', 'private')),
  file_path text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.documents (trip_id);

create table public.document_assignees (
  document_id uuid not null references public.documents(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  primary key (document_id, member_id)
);

-- SPESE -----------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'EUR',
  rate numeric(14,6) not null default 1,          -- 1 unità di "currency" = rate unità della valuta del viaggio
  amount_base numeric(12,2) not null,             -- importo nella valuta del viaggio
  paid_by uuid not null references public.members(id) on delete restrict,
  category text not null default 'altro' check (category in ('cibo','alloggio','trasporti','attivita','spesa','altro')),
  spent_on date not null default current_date,
  split_mode text not null default 'equal' check (split_mode in ('equal','amounts','shares')),
  receipt_path text,
  client_id text unique,                          -- per evitare doppioni dalla coda offline
  created_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.expenses (trip_id);

create table public.expense_shares (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete restrict,
  amount_base numeric(12,2) not null,
  weight numeric(10,3),
  primary key (expense_id, member_id)
);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  from_member uuid not null references public.members(id) on delete restrict,
  to_member uuid not null references public.members(id) on delete restrict,
  amount_base numeric(12,2) not null check (amount_base > 0),
  created_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.settlements (trip_id);

-- ATTIVITÀ --------------------------------------------------------------
create table public.activity (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  kind text not null,
  text text not null,
  created_at timestamptz not null default now()
);
create index on public.activity (trip_id, created_at desc);

-- FUNZIONI DI SUPPORTO (security definer, search_path fissato) -----------
create or replace function public.is_member(p_trip uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members m where m.trip_id = p_trip and m.user_id = auth.uid());
$$;

create or replace function public.is_organizer(p_trip uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members m where m.trip_id = p_trip and m.user_id = auth.uid() and m.role = 'organizer');
$$;

create or replace function public.my_member_id(p_trip uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select m.id from public.members m where m.trip_id = p_trip and m.user_id = auth.uid() limit 1;
$$;

create or replace function public.can_see_document(p_doc uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.documents d
    where d.id = p_doc
      and public.is_member(d.trip_id)
      and (
        d.visibility = 'group'
        or d.uploaded_by = public.my_member_id(d.trip_id)
        or exists (select 1 from public.document_assignees a where a.document_id = d.id and a.member_id = public.my_member_id(d.trip_id))
      )
  );
$$;

-- Crea un viaggio e aggiunge chi lo crea come organizzatore
create or replace function public.create_trip(
  p_name text, p_destination text, p_lat double precision, p_lon double precision,
  p_start date, p_end date, p_currency text, p_display_name text, p_color text default '#0E6B58'
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_trip uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into trips (name, destination, dest_lat, dest_lon, start_date, end_date, currency, cover_color, created_by)
  values (p_name, p_destination, p_lat, p_lon, p_start, p_end, coalesce(p_currency, 'EUR'), coalesce(p_color, '#0E6B58'), auth.uid())
  returning id into v_trip;
  insert into members (trip_id, user_id, display_name, role, color)
  values (v_trip, auth.uid(), coalesce(nullif(p_display_name, ''), 'Organizzatore'), 'organizer', '#0F1B2D');
  insert into activity (trip_id, member_id, kind, text)
  values (v_trip, public.my_member_id(v_trip), 'trip', 'ha creato il viaggio');
  return v_trip;
end $$;

-- Anteprima pubblica di un invito (nome viaggio e date), senza dati personali
create or replace function public.invite_preview(p_code text)
returns table (trip_id uuid, name text, destination text, start_date date, end_date date, members_count bigint)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, t.destination, t.start_date, t.end_date,
         (select count(*) from members m where m.trip_id = t.id)
  from trips t where t.invite_code = upper(p_code);
$$;

-- Entra in un viaggio con il codice; se p_guest_member è un ospite, lo collega al proprio account
create or replace function public.join_trip(p_code text, p_display_name text, p_guest_member uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_trip uuid; v_member uuid; v_colors text[] := array['#6D28D9','#1D4ED8','#C2410C','#0E6B58','#B45309','#BE185D','#0369A1'];
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select id into v_trip from trips where invite_code = upper(p_code);
  if v_trip is null then raise exception 'invalid invite code'; end if;
  select id into v_member from members where trip_id = v_trip and user_id = auth.uid();
  if v_member is not null then return v_trip; end if;
  if p_guest_member is not null then
    update members set user_id = auth.uid(), role = 'member'
    where id = p_guest_member and trip_id = v_trip and user_id is null and role = 'guest'
    returning id into v_member;
  end if;
  if v_member is null then
    insert into members (trip_id, user_id, display_name, role, color)
    values (v_trip, auth.uid(), coalesce(nullif(p_display_name, ''), 'Nuovo membro'), 'member',
            v_colors[1 + (select count(*) from members where trip_id = v_trip)::int % array_length(v_colors, 1)])
    returning id into v_member;
  end if;
  insert into activity (trip_id, member_id, kind, text) values (v_trip, v_member, 'join', 'si è unito al viaggio');
  return v_trip;
end $$;

-- Ospiti del viaggio non ancora collegati (per scegliere "sono io" quando si entra)
create or replace function public.invite_guests(p_code text)
returns table (member_id uuid, display_name text)
language sql stable security definer set search_path = public as $$
  select m.id, m.display_name from members m join trips t on t.id = m.trip_id
  where t.invite_code = upper(p_code) and m.role = 'guest' and m.user_id is null;
$$;

-- Rigenera codice invito e link calendario (solo organizzatore)
create or replace function public.rotate_trip_secrets(p_trip uuid, p_what text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_organizer(p_trip) then raise exception 'not allowed'; end if;
  if p_what = 'invite' then
    update trips set invite_code = upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)) where id = p_trip;
  elsif p_what = 'calendar' then
    update trips set calendar_token = encode(gen_random_bytes(18), 'hex') where id = p_trip;
  end if;
end $$;

-- Salva una spesa con le quote in un'unica transazione
create or replace function public.save_expense(p_expense jsonb, p_shares jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_trip uuid := (p_expense->>'trip_id')::uuid; v_me uuid; v_existing uuid;
begin
  if not public.is_member(v_trip) then raise exception 'not allowed'; end if;
  v_me := public.my_member_id(v_trip);
  if p_expense ? 'client_id' then
    select id into v_existing from expenses where client_id = p_expense->>'client_id';
    if v_existing is not null and not (p_expense ? 'id') then return v_existing; end if;
  end if;
  if p_expense ? 'id' and (p_expense->>'id') is not null then
    v_id := (p_expense->>'id')::uuid;
    update expenses set title = p_expense->>'title', amount = (p_expense->>'amount')::numeric,
      currency = p_expense->>'currency', rate = (p_expense->>'rate')::numeric,
      amount_base = (p_expense->>'amount_base')::numeric, paid_by = (p_expense->>'paid_by')::uuid,
      category = p_expense->>'category', spent_on = (p_expense->>'spent_on')::date,
      split_mode = p_expense->>'split_mode', receipt_path = p_expense->>'receipt_path'
    where id = v_id and trip_id = v_trip;
    delete from expense_shares where expense_id = v_id;
  else
    insert into expenses (trip_id, title, amount, currency, rate, amount_base, paid_by, category, spent_on, split_mode, receipt_path, client_id, created_by)
    values (v_trip, p_expense->>'title', (p_expense->>'amount')::numeric, p_expense->>'currency', (p_expense->>'rate')::numeric,
            (p_expense->>'amount_base')::numeric, (p_expense->>'paid_by')::uuid, p_expense->>'category',
            (p_expense->>'spent_on')::date, p_expense->>'split_mode', p_expense->>'receipt_path', p_expense->>'client_id', v_me)
    returning id into v_id;
    insert into activity (trip_id, member_id, kind, text)
    values (v_trip, v_me, 'expense', 'ha aggiunto ' || (p_expense->>'title') || ' · ' || (p_expense->>'amount') || ' ' || (p_expense->>'currency'));
  end if;
  insert into expense_shares (expense_id, member_id, amount_base, weight)
  select v_id, (s->>'member_id')::uuid, (s->>'amount_base')::numeric, nullif(s->>'weight','')::numeric
  from jsonb_array_elements(p_shares) s
  where exists (select 1 from members m where m.id = (s->>'member_id')::uuid and m.trip_id = v_trip);
  return v_id;
end $$;

-- Elimina il proprio account: i membri restano come "Utente eliminato" per non alterare i saldi
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  update public.members set display_name = 'Utente eliminato', role = case when role = 'organizer' then 'member' else role end
  where user_id = v_uid;
  delete from public.documents d using public.members m
  where d.uploaded_by = m.id and m.user_id = v_uid;
  delete from auth.users where id = v_uid;
end $$;

-- Profilo creato automaticamente alla registrazione
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, accepted_terms_at)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''),
          case when (new.raw_user_meta_data->>'accepted_terms') = 'true' then now() end);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- RLS -------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.members enable row level security;
alter table public.documents enable row level security;
alter table public.document_assignees enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_shares enable row level security;
alter table public.settlements enable row level security;
alter table public.activity enable row level security;

-- profili: io vedo e modifico il mio; vedo i profili dei compagni di viaggio (per PayPal.me / IBAN)
create policy profiles_self on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_trip_mates on public.profiles for select to authenticated using (
  exists (select 1 from public.members a join public.members b on a.trip_id = b.trip_id
          where a.user_id = (select auth.uid()) and b.user_id = profiles.id));

create policy trips_select on public.trips for select to authenticated using (public.is_member(id));
create policy trips_update on public.trips for update to authenticated using (public.is_organizer(id)) with check (public.is_organizer(id));
create policy trips_delete on public.trips for delete to authenticated using (public.is_organizer(id));

create policy members_select on public.members for select to authenticated using (public.is_member(trip_id));
create policy members_insert_guest on public.members for insert to authenticated
  with check (public.is_member(trip_id) and role = 'guest' and user_id is null);
create policy members_update on public.members for update to authenticated
  using (public.is_organizer(trip_id) or user_id = (select auth.uid()))
  with check (public.is_organizer(trip_id) or user_id = (select auth.uid()));
create policy members_delete on public.members for delete to authenticated
  using (public.is_organizer(trip_id) or user_id = (select auth.uid()));

create policy documents_select on public.documents for select to authenticated using (public.can_see_document(id));
create policy documents_insert on public.documents for insert to authenticated
  with check (public.is_member(trip_id) and uploaded_by = public.my_member_id(trip_id));
create policy documents_update on public.documents for update to authenticated
  using (public.is_member(trip_id) and (uploaded_by = public.my_member_id(trip_id) or public.is_organizer(trip_id)))
  with check (public.is_member(trip_id));
create policy documents_delete on public.documents for delete to authenticated
  using (uploaded_by = public.my_member_id(trip_id) or public.is_organizer(trip_id));

create policy assignees_select on public.document_assignees for select to authenticated using (public.can_see_document(document_id));
create policy assignees_write on public.document_assignees for all to authenticated
  using (exists (select 1 from public.documents d where d.id = document_id and public.is_member(d.trip_id)))
  with check (exists (select 1 from public.documents d where d.id = document_id and public.is_member(d.trip_id)));

create policy expenses_select on public.expenses for select to authenticated using (public.is_member(trip_id));
create policy expenses_delete on public.expenses for delete to authenticated using (public.is_member(trip_id));
create policy shares_select on public.expense_shares for select to authenticated
  using (exists (select 1 from public.expenses e where e.id = expense_id and public.is_member(e.trip_id)));

create policy settlements_select on public.settlements for select to authenticated using (public.is_member(trip_id));
create policy settlements_insert on public.settlements for insert to authenticated with check (public.is_member(trip_id));
create policy settlements_delete on public.settlements for delete to authenticated using (public.is_member(trip_id));

create policy activity_select on public.activity for select to authenticated using (public.is_member(trip_id));
create policy activity_insert on public.activity for insert to authenticated
  with check (public.is_member(trip_id) and member_id = public.my_member_id(trip_id));

-- Le funzioni RPC sono eseguibili solo da utenti autenticati (invite_preview anche anonima)
revoke execute on function public.create_trip, public.join_trip, public.invite_guests, public.rotate_trip_secrets,
  public.save_expense, public.delete_my_account, public.invite_preview from public, anon;
grant execute on function public.create_trip, public.join_trip, public.invite_guests, public.rotate_trip_secrets,
  public.save_expense, public.delete_my_account, public.invite_preview to authenticated;
grant execute on function public.invite_preview to anon;
revoke execute on function public.handle_new_user from public, anon, authenticated;

-- STORAGE ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('trip-files', 'trip-files', false, 20971520)
on conflict (id) do nothing;

-- percorso file: <trip_id>/<docs|receipts>/<uuid>.<ext>
create policy files_read on storage.objects for select to authenticated using (
  bucket_id = 'trip-files' and (
    exists (select 1 from public.documents d where d.file_path = storage.objects.name and public.can_see_document(d.id))
    or (split_part(name, '/', 2) = 'receipts' and public.is_member((split_part(name, '/', 1))::uuid))
  ));
create policy files_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'trip-files' and public.is_member((split_part(name, '/', 1))::uuid));
create policy files_delete on storage.objects for delete to authenticated using (
  bucket_id = 'trip-files' and public.is_member((split_part(name, '/', 1))::uuid));

-- Realtime per aggiornare gli altri membri
alter publication supabase_realtime add table public.expenses, public.documents, public.members, public.settlements, public.activity;
