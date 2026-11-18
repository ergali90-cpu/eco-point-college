# ECO POINT COLLEGE 🌿

**Бір бөтелке – бір мүмкіндік. / Одна бутылка – одна возможность.**

Mobile app (Android, iOS, web) for college students: collect plastic bottles, earn points, exchange them for rewards.
Stack: **Expo SDK 58 (React Native) + Supabase** (Auth, Postgres, Realtime, Storage).

## Run it

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** (Android/iOS), or press `w` for the web version.
Supabase keys are in `.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`).

## Make the first admin

Register normally in the app, then run in Supabase → SQL Editor:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'admin@your-college.kz');
```

Log out and back in: the account opens the admin panel. After that, admins can promote others from **Students → Make admin**.

> Supabase sends a confirmation e-mail on sign-up by default. For a live demo you can turn it off in
> Authentication → Sign In / Providers → Email → "Confirm email".

## Rules implemented

| Rule | Where |
|---|---|
| 1 bottle = 1 point, 20 bottles ≈ 1 kg | `review_submission()`, `kg()` |
| Points only after admin approval; rejected = 0 points | `review_submission()` (SECURITY DEFINER) |
| Students can never approve their own submissions | `is_admin()` + `cannot_review_own` check; no UPDATE grant on submissions |
| Duplicate protection | idempotency `request_id` + unique (student, date, amount) |
| Reward points held while pending, deducted only on approval | `request_reward()` / `review_redemption()` |
| Full transaction history | `point_ledger` table (insert only through functions) |
| Real-time leaderboard & dashboards | Supabase Realtime on `profiles`, `submissions`, `redemptions` |
| Students can't change points / role | column-level grants (only name, college, group editable) |

Schema: [`supabase/schema.sql`](supabase/schema.sql)

## Structure

```
App.tsx                 navigation (student tabs / admin tabs)
src/i18n/               Kazakh + Russian translations
src/lib/                Supabase client, types, realtime hook
src/components/         UI kit (cards, buttons, charts, progress ring)
src/screens/            Home, Submit, Leaderboard, Rewards, Profile, Stats
src/screens/admin/      Dashboard, Verify, Students, Rewards management
```

## Build an installable app

```bash
npx eas-cli@latest build -p android --profile preview
```
