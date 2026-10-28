# Portfolio + Supabase Password Login, TOTP MFA, and Admin Project Management

This package updates the GitHub Pages static site with a login page and an admin dashboard using Supabase Auth + TOTP MFA. Writes are also restricted by PostgreSQL RLS to the authenticated owner with `aal2`.

## Important: configure the publishable key

1. In Supabase Dashboard, open Project Settings → API Keys (or the API section).
2. Copy the **publishable key** (or legacy `anon` public key if the dashboard only has that format).
3. Open `docs/assets/js/supabase-client.js` and replace `PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE` with it.
4. Never use a `service_role` key or Supabase secret key in browser code. The publishable/anon key is public; RLS is what protects data.

The project URL is prefilled from the project URL supplied during setup. Verify it matches your Supabase project.

## Database setup

1. Open Supabase Dashboard → SQL Editor → New query.
2. Paste and run `supabase/schema.sql` from this package.
3. The schema permits public reads only for published projects. Insert, update, and delete require the signed-in owner and an `aal2` token (password + MFA).

## Supabase Auth setup

1. Authentication → Users: make sure your one admin user exists.
2. Authentication → Sign In / Providers: keep public sign-ups disabled.
3. In Authentication → URL Configuration, add `https://jagan-s22.github.io/Portfolio-admin/` as the Site URL or an allowed redirect URL as the dashboard allows.
4. TOTP authenticator MFA is supported by Supabase Auth. The first successful login in `docs/login.html` enrolls Google Authenticator by QR code. Subsequent logins challenge the verified factor.

## Publish with GitHub Pages

The `docs/` folder in this package contains the updated static site. Copy/merge this `docs` folder into the repository root, stage it, and push `main`. GitHub Pages should publish from `main` → `/docs`.

Example PowerShell commands, from your local repository root:

```powershell
# Extract this package at your repository root, merge/replace docs files, and copy supabase/schema.sql.
git add docs supabase/schema.sql README-SUPABASE-SETUP.md
git status
# Ensure no .env, service-role key, database password, or SQLite database is staged.
git commit -m "Integrate Supabase admin login and MFA"
git push origin main
```

## Flow

- Public homepage: `index.html`, with an Admin Login navigation link.
- Login: email/password via Supabase Auth, followed by TOTP enrollment or challenge.
- Admin: only shown after `aal2` has been verified.
- Project management: add/edit/delete in the admin dashboard; public site displays published rows only.

## Security notes

- Do not commit any `.env`, service-role key, secret key, database password, or TOTP QR/secret.
- A public frontend can be inspected by anyone; its publishable key is expected to be visible.
- RLS policies in `supabase/schema.sql` are critical. Do not allow public signup, and do not create broad `USING (true)` write policies.
- The dashboard is a static page, so UI hiding is not a security boundary; database RLS enforces write permissions at the data layer.
