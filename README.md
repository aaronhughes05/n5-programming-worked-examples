# Crack the Code
## National 5 Computing Science Worked Examples

Crack the Code is an interactive National 5 Computing Science learning web app.  
It scaffolds students through prediction, implementation, modification, and testing with worked examples and a final assessment.

The app now runs as a single Django + PostgreSQL web application (no static-only runtime path for production).

---

## Key Features

- PRIMM-style worked examples with checkpoint gating
- Rich corrective feedback and adaptive hinting per checkpoint
- Persistent account-based progress and hint analytics
- Role-based access (`student` and `teacher`)
- Teacher dashboard with class summary, attempt analytics, student drill-down, and exports
- Worksheet pages for revision/printing

---

## Stack

- Django 5 (templates + JSON API)
- PostgreSQL
- Vanilla JavaScript + HTML/CSS
- Pyodide for in-browser Python run/check tasks
- Gunicorn + Whitenoise for production runtime/static serving

---

## Runtime Routes

Page routes:

- `/`
- `/login` and `/login/`
- `/examples/example1/`
- `/examples/example2/`
- `/examples/example3/`
- `/assessment/`
- `/worksheets/`
- `/examples/worksheet-example1/`
- `/examples/worksheet-example2/`
- `/examples/worksheet-example3/`
- `/examples/worksheet-assessment/`
- `/teacher/` (teacher role required)

API routes:

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /api/progress-summary`
- `GET|PUT /api/progress/<activity_key>`
- `POST /api/progress/<activity_key>/checkpoint`
- `POST /api/hints/<activity_key>/<checkpoint_id>`
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

---

## Repository Layout

```text
docs/
  css/styles.css
  js/script.js
  js/api.js
  images/...
  favicon.svg

backend/
  manage.py
  requirements.txt
  config/
  core/
  templates/
    index.html
    login.html
    pages/...
```

`backend/templates` is the page source of truth.  
`docs/` contains static assets used by the Django templates.

---

## Local Setup

```bash
git clone https://github.com/aaronhughes05/n5-programming-worked-examples.git
cd n5-programming-worked-examples/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.development.example .env
python manage.py migrate
python manage.py runserver
```

Open `http://127.0.0.1:8000/`.

PowerShell activation:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
```

---

## Roles and Access

- Unauthenticated users are redirected to login.
- `student`: learner pages only.
- `teacher`: learner pages + teacher mode + teacher APIs.
- Teacher access is role-account based (legacy passcode flow removed from production path).

---

## Operations

Common backend maintenance commands are documented in [backend/README.md](backend/README.md), including:

- demo seeding
- activity key cleanup
- progress summary rebuild
- roster consistency audit/repair

---

## Deployment

- Deploy as one Django app runtime (e.g., Render).
- Use managed Postgres.
- Do not rely on GitHub Pages for app runtime.

Recommended production start command:

```bash
python manage.py migrate --noinput && python manage.py collectstatic --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
```

---

## Contributors

Developed for the Computing Science Education Theory and Practice course.

- Aaron Hughes
- Varshini Seshan
- Sophie MacLurg
- Rabindranath Jha

---

## License

Educational use.
