# Crack the Code
## National 5 Computing Science Worked Examples

Crack the Code is an interactive learning web app for National 5 Computing Science. It guides learners from prediction to implementation, modification, and testing using scaffolded worked examples and a final assessment.

The project now runs as a Django web app (frontend + backend together), with PostgreSQL-ready persistence for accounts, progress, hints, and teacher analytics.

---

## What The Project Does

- Scaffolded step-by-step examples with checkpoint gating
- Rich feedback and adaptive hints at checkpoint level
- Persistent learner progress (local fallback + API-backed sync)
- Dashboard with status, progress bars, and badges
- Worksheet pages for print/download use
- Final assessment with prerequisite gate
- Teacher mode with class summary, analytics, exports, and roster management

---

## Runtime Architecture

### Django routes (current source of truth)

- `/` home dashboard
- `/login/` sign-in page
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

### API routes

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
- `POST /api/teacher/classes/<classroom_id>/students/<student_id>`
- `POST /api/teacher/classes/<classroom_id>` (delete class)

---

## Current Stack

- Django (templates + API)
- Vanilla JavaScript
- HTML/CSS (served as Django static/template assets)
- PostgreSQL (production target)
- Pyodide (for browser-run coding tasks)

---

## Project Structure

```text
/docs
  index.html
  favicon.svg
  /css
    styles.css
  /js
    script.js
    api.js

/backend
  manage.py
  requirements.txt
  /config
  /core
  /templates
    index.html
    login.html
    /pages
      assessment.html
      example-template.html
      example1.html
      example2.html
      example3.html
      teacher.html
      worksheets.html
      worksheet-example1.html
      worksheet-example2.html
      worksheet-example3.html
      worksheet-assessment.html
```

---

## Local Setup

1. Clone repository:

```bash
git clone https://github.com/aaronhughes05/n5-programming-worked-examples.git
cd n5-programming-worked-examples/backend
```

2. Create and activate virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Windows PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
```

3. Install dependencies and configure env:

```bash
pip install -r requirements.txt
cp .env.development.example .env
```

4. Migrate and run:

```bash
python manage.py migrate
python manage.py runserver
```

5. Open `http://127.0.0.1:8000/`.

---

## Auth And Roles

- App access requires login.
- `student` role: learner pages only.
- `teacher` role: learner pages + teacher mode.
- Teacher mode is role-based (legacy passcode gate removed from runtime path).

---

## Progress And Analytics

- Learner progress and hint analytics are stored in DB for logged-in users.
- Frontend includes localStorage compatibility and one-time import to DB.
- Teacher mode surfaces:
  - class progress counts
  - attempt analytics and most-missed checkpoints
  - per-student analytics modal
  - CSV/JSON export
  - class and roster management tools

---

## Manual Smoke Checklist

1. Login works and `/auth/me` reflects role.
2. Student can open home/examples/assessment/worksheets.
3. Non-teacher cannot access `/teacher/`.
4. Teacher can access `/teacher/` and load analytics.
5. Progress persists after reload.
6. Assessment prerequisite gate works.
7. Export JSON/CSV downloads from teacher page.

---

## Known Notes

- `example3` content may still be lighter than Example 1/2 depending on branch state.
- Old static `docs/pages/*` runtime was removed; Django templates are now the only page source.

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
