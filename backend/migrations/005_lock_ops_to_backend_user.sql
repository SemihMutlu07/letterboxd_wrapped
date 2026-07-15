-- Run after creating ops@movieswrapped.internal in Supabase Auth.
-- Frontend-facing tables are intentionally untouched.
do $$
declare
  tbl text;
  policy_record record;
begin
  foreach tbl in array array[
    'ops_runs', 'ops_watchlist_runs', 'ops_date_night_runs',
    'ops_worker_events', 'ops_dashboard_settings'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    for policy_record in select policyname from pg_policies where schemaname = 'public' and tablename = tbl loop
      execute format('drop policy if exists %I on public.%I', policy_record.policyname, tbl);
    end loop;
  end loop;
end $$;

create policy "backend ops select" on public.ops_runs for select to authenticated
  using ((auth.jwt() ->> 'email') = 'ops@movieswrapped.internal');
create policy "backend ops insert" on public.ops_runs for insert to authenticated
  with check ((auth.jwt() ->> 'email') = 'ops@movieswrapped.internal');
create policy "backend ops delete" on public.ops_runs for delete to authenticated
  using ((auth.jwt() ->> 'email') = 'ops@movieswrapped.internal');

create policy "backend watchlist select" on public.ops_watchlist_runs for select to authenticated
  using ((auth.jwt() ->> 'email') = 'ops@movieswrapped.internal');
create policy "backend watchlist insert" on public.ops_watchlist_runs for insert to authenticated
  with check ((auth.jwt() ->> 'email') = 'ops@movieswrapped.internal');
create policy "backend watchlist delete" on public.ops_watchlist_runs for delete to authenticated
  using ((auth.jwt() ->> 'email') = 'ops@movieswrapped.internal');

create policy "backend date night select" on public.ops_date_night_runs for select to authenticated
  using ((auth.jwt() ->> 'email') = 'ops@movieswrapped.internal');
create policy "backend date night insert" on public.ops_date_night_runs for insert to authenticated
  with check ((auth.jwt() ->> 'email') = 'ops@movieswrapped.internal');
create policy "backend date night delete" on public.ops_date_night_runs for delete to authenticated
  using ((auth.jwt() ->> 'email') = 'ops@movieswrapped.internal');

create policy "backend worker events" on public.ops_worker_events for all to authenticated
  using ((auth.jwt() ->> 'email') = 'ops@movieswrapped.internal')
  with check ((auth.jwt() ->> 'email') = 'ops@movieswrapped.internal');
create policy "backend dashboard settings" on public.ops_dashboard_settings for all to authenticated
  using ((auth.jwt() ->> 'email') = 'ops@movieswrapped.internal')
  with check ((auth.jwt() ->> 'email') = 'ops@movieswrapped.internal');
