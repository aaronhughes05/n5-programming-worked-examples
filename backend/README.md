# Backend (Django)

This directory contains the Django runtime for:

- template-rendered frontend pages
- JSON API for auth, progress, hints, teacher analytics, and roster management

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

## Core Commands

Create admin user:

```bash
python manage.py createsuperuser
```

Seed demo teacher/classes/students/progress:

```bash
python manage.py seed_teacher_demo
```

Reset and reseed demo data:

```bash
python manage.py seed_teacher_demo --reset
```

---

## Data Maintenance Commands

Normalize activity keys (dry-run):

```bash
python manage.py cleanup_activity_keys
```

Normalize activity keys (apply):

```bash
python manage.py cleanup_activity_keys --apply
```

Normalize + remove unknown keys:

```bash
python manage.py cleanup_activity_keys --apply --delete-unknown
```

Rebuild user progress summaries:

```bash
python manage.py rebuild_progress_summaries
```

Audit roster consistency:

```bash
python manage.py roster_consistency
```

Apply roster consistency fixes:

```bash
python manage.py roster_consistency --apply
```

Apply + prune orphan links + sync roles:

```bash
python manage.py roster_consistency --apply --prune-orphans --sync-roles
```

Recommended post-cleanup sequence:

```bash
python manage.py cleanup_activity_keys --apply --delete-unknown
python manage.py rebuild_progress_summaries
python manage.py roster_consistency --apply
```

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
- `DELETE /api/teacher/classes/<classroom_id>/students/<student_id>`
- `DELETE /api/teacher/classes/<classroom_id>`
- `POST /api/teacher/seed-demo`

Health:

- `GET /health/`

---

## Database and Environment

- Local development can run on SQLite if `DATABASE_URL` is not set.
- Shared/dev/prod should use PostgreSQL.
- Production env should include:
  - `DJANGO_SECRET_KEY`
  - `DJANGO_ENV=production`
  - `DJANGO_DEBUG=0`
  - `DJANGO_ALLOWED_HOSTS`
  - `DJANGO_CSRF_TRUSTED_ORIGINS`
  - `DATABASE_URL`
  - `DATABASE_SSL_REQUIRE=1` (if required by your host)

Cookie/session env controls:

- `SESSION_COOKIE_SAMESITE`
- `CSRF_COOKIE_SAMESITE`
- `SESSION_COOKIE_SECURE`
- `CSRF_COOKIE_SECURE`
- optional: `SESSION_COOKIE_DOMAIN`, `CSRF_COOKIE_DOMAIN`

---

## Deployment (Render/Railway)

Deploy as a single Django app runtime.  
Do not use GitHub Pages for production runtime.

Recommended start command:

```bash
python manage.py migrate --noinput && python manage.py collectstatic --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
```

One-time maintenance deploy command (if no shell access):

```bash
python manage.py migrate --noinput && python manage.py collectstatic --noinput && python manage.py cleanup_activity_keys --apply --delete-unknown && python manage.py rebuild_progress_summaries && python manage.py roster_consistency --apply && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
```

After that one-time run, revert to the normal start command.
