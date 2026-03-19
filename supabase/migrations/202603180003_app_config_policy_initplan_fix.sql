drop policy if exists app_config_admin_insert on public.app_config;
create policy app_config_admin_insert
on public.app_config
for insert
to authenticated
with check ((select public.is_admin_user((select auth.uid()))));

drop policy if exists app_config_admin_update on public.app_config;
create policy app_config_admin_update
on public.app_config
for update
to authenticated
using ((select public.is_admin_user((select auth.uid()))))
with check ((select public.is_admin_user((select auth.uid()))));

drop policy if exists app_config_admin_delete on public.app_config;
create policy app_config_admin_delete
on public.app_config
for delete
to authenticated
using ((select public.is_admin_user((select auth.uid()))));
