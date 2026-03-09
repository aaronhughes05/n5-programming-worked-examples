# Backend (Django scaffold)

This folder contains the initial Django backend scaffold for account-based progress storage.

## Local setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.development.example .env
python manage.py migrate
python manage.py runserver
```

For production values, use `.env.production.example` as your template.

## Current endpoints

- `GET /health/`
- `GET /api/`

## Seed demo teacher data

```bash
python manage.py seed_teacher_demo
```

Reset and reseed:

```bash
python manage.py seed_teacher_demo --reset
```

## Notes

- Database defaults to SQLite for local boot if `DATABASE_URL` is not set.
- Set `DATABASE_URL` to PostgreSQL for shared/dev/prod environments.

## Production deployment (Django + frontend together)

This project is now configured to run as a single Django app in production:

- Django serves templates and static assets (including the frontend UI in `docs/`).
- Runtime should be a Python host (Render or Railway), not GitHub Pages.
- Use managed PostgreSQL in production (Render Postgres, Neon, Railway Postgres, etc.).

### Render (recommended)

1. Push this repo to GitHub.
2. In Render, create a Blueprint deploy from this repository (it will pick up `render.yaml`).
3. After first deploy, set `DJANGO_CSRF_TRUSTED_ORIGINS` to your app URL, e.g.:
   - `https://your-app.onrender.com`
4. Redeploy.

### Railway

1. Create a new Railway project from this repository.
2. Add a PostgreSQL service or connect Neon.
3. Set app variables:
   - `DJANGO_SECRET_KEY`
   - `DJANGO_ENV=production`
   - `DJANGO_DEBUG=0`
   - `DJANGO_ALLOWED_HOSTS=<your-railway-domain>`
   - `DJANGO_CSRF_TRUSTED_ORIGINS=https://<your-railway-domain>`
   - `DATABASE_URL=<managed postgres URL>`
   - `DATABASE_SSL_REQUIRE=1`
4. Deploy (Railway will use `railway.toml`).

## Cookie and session security

Session and CSRF cookies are now environment-driven:

- `SESSION_COOKIE_SAMESITE` and `CSRF_COOKIE_SAMESITE` (Lax/Strict/None)
- `SESSION_COOKIE_SECURE` and `CSRF_COOKIE_SECURE` (0/1)
- Optional `SESSION_COOKIE_DOMAIN` and `CSRF_COOKIE_DOMAIN`

Recommended strategy:

- Same-site deployment (Django serves frontend): `Lax` + secure cookies in production.
- Cross-site frontend/backend: set both SameSite values to `None` and keep both secure flags as `1`.
