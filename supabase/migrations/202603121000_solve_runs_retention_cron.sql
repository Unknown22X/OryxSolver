-- Solve Runs Retention: Schedule daily cleanup of rows older than 30 days.
-- See: SaaS/4-Analytics/SOLVE_RUNS_RETENTION.md

-- Enable pg_cron if not already enabled
create extension if not exists pg_cron;

-- Schedule daily cleanup at 03:00 UTC
select cron.schedule(
  'cleanup-old-solve-runs',
  '0 3 * * *',
  $$DELETE FROM public.solve_runs WHERE created_at < now() - interval '30 days'$$
);
