# Supabase setup

## 1. Run schema

In the Supabase SQL Editor, run the full script in [`schema.sql`](./schema.sql).

This **drops and recreates** the tables with the corrected shapes the app expects.

## 2. Environment variables

Copy `.env.example` to `.env` (already done locally):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

Restart `npm run dev` after changing `.env`.

## 3. Populate leaderboard cache

After you have at least one **completed** roll (`status = 'completed'`, positive `total_ms`):

```sql
select public.refresh_leaderboard_cache();
```

## 4. Daily midnight refresh (optional)

Enable the **pg_cron** extension, then:

```sql
select cron.schedule(
  'spirit-leaderboard-midnight',
  '0 0 * * *',
  'select public.refresh_leaderboard_cache()'
);
```

Times are **UTC** by default. Adjust the cron expression for Eastern midnight if needed.

## Table fixes vs your original DDL

| Issue | Fix |
|-------|-----|
| `roll_splits.roll_id` was the primary key | Split rows need their own `id`; `roll_id` is a foreign key (many splits per roll) |
| `time_display` was `bigint` | Changed to `text` (e.g. `0:08.12`) |
| `rolls.start_time_ms` as timestamp | Changed to `bigint` (Unix ms) |
| `weather json json` | Changed to `jsonb` |
| `created_by` as timestamp | Removed; added `client_id` for per-device active rolls |
| Missing live fields | Added `status`, `records` jsonb, `config_snapshot` jsonb |
| Leaderboard | New `leaderboard_cache` table + `refresh_leaderboard_cache()` |
