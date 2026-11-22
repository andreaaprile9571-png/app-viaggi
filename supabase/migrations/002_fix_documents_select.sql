-- Il salvataggio dei documenti falliva: la regola di lettura rileggeva il documento per id e,
-- durante INSERT ... RETURNING, la riga nuova non era ancora visibile. Ora usa le colonne della riga.
create or replace function public.is_assigned(p_doc uuid, p_trip uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.document_assignees a where a.document_id = p_doc and a.member_id = public.my_member_id(p_trip));
$$;
revoke execute on function public.is_assigned(uuid, uuid) from public, anon;
grant execute on function public.is_assigned(uuid, uuid) to authenticated;

drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents for select to authenticated using (
  public.is_member(trip_id) and (
    visibility = 'group'
    or uploaded_by = public.my_member_id(trip_id)
    or public.is_assigned(id, trip_id)
  )
);
