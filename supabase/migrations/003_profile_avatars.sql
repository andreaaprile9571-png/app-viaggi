-- Foto profilo: file in un bucket pubblico "avatars" (cartella = id utente), URL nel profilo
-- e copiato sui membri dei viaggi, così ogni lista di persone mostra la foto senza altre letture.
alter table public.profiles add column if not exists avatar_url text check (avatar_url is null or char_length(avatar_url) < 500);
alter table public.members add column if not exists avatar_url text;

create or replace function public.sync_member_avatar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    update public.members set avatar_url = null where user_id = old.id;
    return old;
  end if;
  if new.avatar_url is distinct from old.avatar_url then
    update public.members set avatar_url = new.avatar_url where user_id = new.id;
  end if;
  return new;
end $$;
revoke execute on function public.sync_member_avatar() from public, anon, authenticated;
drop trigger if exists profiles_avatar_sync on public.profiles;
create trigger profiles_avatar_sync after update of avatar_url or delete on public.profiles
  for each row execute function public.sync_member_avatar();

create or replace function public.member_avatar_on_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null and new.avatar_url is null then
    select avatar_url into new.avatar_url from public.profiles where id = new.user_id;
  end if;
  return new;
end $$;
revoke execute on function public.member_avatar_on_insert() from public, anon, authenticated;
drop trigger if exists members_avatar_insert on public.members;
create trigger members_avatar_insert before insert on public.members
  for each row execute function public.member_avatar_on_insert();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists avatars_insert on storage.objects;
drop policy if exists avatars_update on storage.objects;
drop policy if exists avatars_delete on storage.objects;
drop policy if exists avatars_select on storage.objects;
create policy avatars_select on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
