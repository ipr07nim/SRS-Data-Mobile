# SRS Spirit Timing (pusher phone app)

Phone app for weekend rolls. Pushers tap at their hill to time the buggy, see the roll's
progress live, and set who pushes which hill. No login.

- **Timing** lives in Supabase: one shared clock and one row per tap, synced to every phone.
- **Pusher assignments** live in the SRS backend's roll-day plan (the same data as the
  desktop plan page). The SRS backend is used as-is; nothing in `srs/` changes.

## How timing works

- Stations: `Start` (Hill 1 line), `H1-H2`, `H2-H3`, `H3-H4`, `H4-H5`, `Finish`.
- One buggy is on the course at a time. A roll starts with a tap at **Start**, or at **H1-H2**
  when Hill 1 is skipped. No other station can start a roll.
- Any later station may be skipped. A hill's split is only shown when both of its ends were
  tapped; a skipped station leaves a blank instead of being folded into the next hill.
- Every phone measures its offset to the database clock (`server_now_ms()`), so a tap and the
  running timer read the same on every phone, whatever each phone's own clock says.
- A tap's time is fixed when the button is pressed. If the network is down, the tap waits on
  the phone and is sent later with that same time.
- The next tap at Start (or H1-H2) after a roll has run ends that roll (it is saved if any hill
  has a split) and starts the next one, so a missed finish tap does not block the day.

## Setup

### 1. Supabase (once)

The project already has the tables from `supabase/schema.sql`. Add the phone-sync pieces:

1. Open the Supabase dashboard, pick the project, and go to **SQL Editor** → **New query**.
2. Paste the whole of `supabase/phone_sync.sql` and click **Run**.

The script only adds things (a function, a table, columns, realtime) and can be re-run safely.
Do **not** re-run `schema.sql`; it drops every table.

### 2. Environment

Copy `.env.example` to `.env` and fill in:

| Variable | Where to find it |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API (or Data API) → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → `anon` / publishable key |
| `VITE_SRS_URL` | `https://srs.westus2.cloudapp.azure.com` |
| `VITE_SRS_KEY` | The SRS shared password (`SRS_KEY` in the SRS server's `backend/.env`) |

`VITE_*` values are compiled into the JavaScript the phones download, so anyone with the app URL
can read them. Never commit `.env`.

Without `VITE_SRS_URL`/`VITE_SRS_KEY` the app still times rolls; buggy, driver and pushers are
then typed in on the phone instead of coming from the SRS plan.

### 3. Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run typecheck
```

### 4. Deploy

Phones need HTTPS for Add to Home Screen and the screen wake lock.

With Docker (the values are build arguments because Vite inlines them at build time):

```bash
docker build -t srs-timing \
  --build-arg VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY \
  --build-arg VITE_SRS_URL=https://srs.westus2.cloudapp.azure.com \
  --build-arg VITE_SRS_KEY=YOUR_SRS_KEY \
  .
docker run -p 3000:3000 srs-timing
```

Put it behind an HTTPS host or reverse proxy. On a Node host (Render, Railway, Fly, etc.), set
the four variables in the host's environment **before the build step**, use `npm run build` as
the build command and `npm run start` as the start command (`PORT` is respected).

## Roll morning

1. **Install once per phone.** Open the app URL. iPhone: Safari → Share → *Add to Home Screen*.
   Android: Chrome → ⋮ → *Add to Home screen* / *Install app*. Open it from that icon.
2. **Pick a role** (top left menu): *Pushers* to time and edit assignments.
3. **Assign tab**: shows today's SRS plan, roll by roll (‹ ›). Each buggy column has its five
   hill pushers; type a name (suggestions come from the SRS pusher list) and tap away to save.
   The desktop plan page and other phones see it within a few seconds.
4. **Home → Next roll**: the buggy the next start will time, with its driver and pushers. It
   defaults to the first buggy of the current roll that has not been timed; tap another to change.
5. **Pick your station** under *Select your location*. The screen stays on.
   - At Start: tap **Start roll** when the buggy goes.
   - At H1-H2 when Hill 1 is skipped: tap **Start roll at Hill 2**.
   - Everyone else: tap **Log ...** as the buggy passes. Before a roll starts the button reads
     *Waiting for start*.
6. Taps can be undone for a few seconds. Undoing the opening tap cancels the roll. The flag
   button marks a tap as late/unreliable.
7. After the finish tap, the summary opens; **Export** saves the roll. A roll with no finish tap
   can be saved from *Save roll without a finish*, or it is saved automatically when the next roll
   starts.

The *Roll progress* card shows whether the shared clock is synced and whether any taps are still
waiting to send.
