# Backend (Django)

This directory contains the Django app that serves both:

- page templates (frontend runtime)
- JSON API (auth, progress, hints, teacher analytics)

The project is configured for local development and PostgreSQL-backed deployment.

---

## Local Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.development.example .env
python manage.py migrate
python manage.py runserver
```

Windows PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.development.example .env
python manage.py migrate
python manage.py runserver
```

---

## Useful Commands

Create superuser:

```bash
python manage.py createsuperuser
```

Seed teacher demo data:

```bash
python manage.py seed_teacher_demo
```

Reset + reseed:

```bash
python manage.py seed_teacher_demo --reset
```

Activity-key cleanup dry-run (report only):

```bash
python manage.py cleanup_activity_keys
```

Apply normalizations:

```bash
python manage.py cleanup_activity_keys --apply
```

Apply + delete unknown activity keys:

```bash
python manage.py cleanup_activity_keys --apply --delete-unknown
```

---

## Database

- Local fallback can use SQLite when `DATABASE_URL` is not set.
- Recommended shared/dev/prod database is PostgreSQL.
- Production should use managed Postgres (Render, Railway, Neon, etc.).

---

## API Summary

Auth:

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

Learner progress:

- `GET /api/progress-summary`
- `GET|PUT /api/progress/<activity_key>`
- `POST /api/progress/<activity_key>/checkpoint`
- `POST /api/hints/<activity_key>/<checkpoint_id>`

Teacher analytics and management:

- `GET /api/teacher/class-summary`
- `GET /api/teacher/attempt-analytics`
- `GET /api/teacher/students/<student_id>/analytics`
- `GET /api/teacher/export.json`
- `GET /api/teacher/export.csv`
- `GET|POST /api/teacher/classes`
- `POST /api/teacher/classes/<classroom_id>/students`
- `POST /api/teacher/classes/<classroom_id>/students/<student_id>`
- `POST /api/teacher/classes/<classroom_id>` (delete class)

---

## Security And Environment

Environment variables in production should include at least:

- `DJANGO_SECRET_KEY`
- `DJANGO_ENV=production`
- `DJANGO_DEBUG=0`
- `DJANGO_ALLOWED_HOSTS`
- `DJANGO_CSRF_TRUSTED_ORIGINS`
- `DATABASE_URL`
- `DATABASE_SSL_REQUIRE=1` (if required by host)

Cookie/session controls are environment-driven:

- `SESSION_COOKIE_SAMESITE`
- `CSRF_COOKIE_SAMESITE`
- `SESSION_COOKIE_SECURE`
- `CSRF_COOKIE_SECURE`
- optional: `SESSION_COOKIE_DOMAIN`, `CSRF_COOKIE_DOMAIN`

---

## Deployment

Deploy as one Django app runtime (do not use GitHub Pages for app runtime).

Recommended free-tier paths:

- Render web service + managed Postgres
- Railway app + Postgres
- Neon Postgres attached to Render/Railway

After first deploy, run migrations:

```bash
python manage.py migrate
```
