-- Run this entire file once in Supabase SQL Editor, then:
--   select public.refresh_leaderboard_cache();
-- Needs rolls.origin_station, so run phone_sync.sql first.

create or replace function public.refresh_leaderboard_cache()
returns void
language plpgsql
as $$
declare
  hill_val text;
  buggy_val text;
  buggy_opts text[] := array['all', 'Inviscid', 'Kingpin', 'Seraph', 'Zuke'];
  hill_opts text[] := array['all', 'H1', 'H2', 'H3', 'H4', 'H5'];
begin
  foreach hill_val in array hill_opts loop
    foreach buggy_val in array buggy_opts loop
      insert into public.leaderboard_cache (hill, buggy_filter, entries, computed_at)
      values (
        hill_val,
        buggy_val,
        (
          with completed as (
            select r.*
            from public.rolls r
            where r.status = 'completed'
              and r.total_ms is not null
              and r.total_ms > 0
              and (buggy_val = 'all' or r.buggy = buggy_val)
              and (hill_val <> 'all' or coalesce(r.origin_station, 'start') = 'start')
          ),
          ranked as (
            select
              c.id as roll_id,
              c.driver,
              c.buggy,
              c.start_time_ms,
              case
                when hill_val = 'all' then c.total_ms
                else s.split_ms
              end as time_ms,
              case
                when hill_val = 'all' then
                  to_char((c.total_ms / 60000), 'FM0') || ':' ||
                  lpad(to_char((c.total_ms / 1000) % 60, 'FM00'), 2, '0') || '.' ||
                  lpad(to_char((c.total_ms % 1000) / 10, 'FM00'), 2, '0')
                else s.time_display
              end as time_str,
              case when hill_val = 'all' then '' else coalesce(s.pusher, '') end as pusher
            from completed c
            left join public.roll_splits s
              on s.roll_id = c.id
              and hill_val <> 'all'
              and s.hill = substring(hill_val from 2)::smallint
            where hill_val = 'all' or s.id is not null
          )
          select coalesce(jsonb_agg(row_to_json(t) order by t."timeMs" asc), '[]'::jsonb)
          from (
            select
              row_number() over (order by time_ms asc) as rank,
              roll_id::text as "rollId",
              pusher as name,
              driver,
              buggy,
              time_str as time,
              time_ms as "timeMs",
              to_char(to_timestamp(start_time_ms / 1000.0) at time zone 'America/New_York', 'MM/DD/YY') as date,
              to_char(to_timestamp(start_time_ms / 1000.0) at time zone 'America/New_York', 'HH12:MI AM') as "timeDisplay"
            from ranked
            where time_ms is not null and time_ms > 0
            order by time_ms asc
            limit 5
          ) t
        ),
        now()
      )
      on conflict (hill, buggy_filter)
      do update set entries = excluded.entries, computed_at = excluded.computed_at;
    end loop;
  end loop;
end;
$$;
