# Backend (Django scaffold)

This folder contains the initial Django backend scaffold for account-based progress storage.

## Local setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver
```

## Current endpoints

- `GET /health/`
- `GET /api/`

## Notes

- Database defaults to SQLite for local boot if `DATABASE_URL` is not set.
- Set `DATABASE_URL` to PostgreSQL for shared/dev/prod environments.
