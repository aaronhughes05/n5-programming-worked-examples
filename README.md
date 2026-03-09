# Crack the Code
## National 5 Computing Science Worked Examples

Crack the Code is an interactive web resource for National 5 learners, designed to move students from passive reading to active analysis through scaffolded programming activities.

It is built with plain HTML, CSS, and JavaScript so it can run in typical school environments without build tooling.

---

## What The Project Does

The site provides:

- Structured worked examples following a step-by-step pipeline
- Prediction and checkpoint tasks with immediate feedback
- Persistent progress tracking across activities
- A learning dashboard with completion and badges
- Worksheet pages for print/download classroom use
- A final assessment with gating and mixed activity types
- A teacher mode with local analytics and admin tools

---

## Current Pages

### Home
- `docs/index.html`
- Learning dashboard
- Example showcase with rotating previews
- Badge summary actions (copy/download)

### Learner Activities
- `docs/pages/example1.html` (implemented)
- `docs/pages/example2.html` (implemented)
- `docs/pages/assessment.html` (implemented)
- `docs/pages/example3.html` (placeholder file currently empty)

### Worksheets
- `docs/pages/worksheets.html`
- `docs/pages/worksheet-example1.html`
- `docs/pages/worksheet-example2.html`
- `docs/pages/worksheet-example3.html`
- `docs/pages/worksheet-assessment.html`

### Teacher Mode
- `docs/pages/teacher.html`
- Passcode-gated local teacher tools

---

## Learning Flow And Design

Examples use a guided progression model with required checkpoints before moving forward.

Typical activity types:

- Prediction questions (radio/text/select)
- Step-by-step implementation reveal
- Parsons-style ordering tasks
- Subgoal mapping and line identification
- Trace/modify tasks
- Output checking

The design applies:

- Consistent structure and wording across activities
- Subgoal labeling to support mental mapping
- Rich targeted feedback on errors
- Adaptive hints with escalation by attempt count

---

## Core Features

### 1) Unified App Bar

- Shared top navigation across pages
- Mobile menu support
- Resume link shown when in-progress work exists
- Teacher Mode nav entry injected across pages

### 2) Stepper + Required Checkpoints

- Next step is blocked until required checks are complete
- Progress bar and step indicator update dynamically
- Restart clears state for the current activity

### 3) Rich Feedback + Adaptive Hints

- Correct/incorrect status treatment is standardized
- Rich feedback includes misconception and next-step guidance
- Hint levels unlock after failed attempts
- Worked hint reveal is tracked

### 4) Progress Persistence

Saved locally in `localStorage`:

- `assessmentStepperState.v2:<pathname>`
- `adaptiveHintState.v1:<pathname>`

Tracks:

- step index
- completed checkpoints
- input values
- completion state
- hint usage analytics

### 5) Learning Dashboard

- Activity state cards: Not started / In progress / Complete
- Progress bars + activity actions (Start/Continue/Review)
- Badge rendering and summary
- Summary copy/download actions

### 6) Assessment Access Gate

When users open Final Assessment before finishing all worked examples:

- modal warning appears
- completion progress shown (`X of 3 examples complete`)
- missing examples listed
- options to proceed or jump to next incomplete example

### 7) Teacher Mode (Client-Side)

Teacher Mode includes:

- passcode unlock modal (session-based)
- class progress summary cards
- attempt analytics and difficulty signals
- most-missed checkpoint highlights
- report export (CSV and JSON)
- admin actions:
  - `Insert Test Data`
  - `Reset all local progress` (custom confirmation popup)

Notes:

- This is client-side only (no backend auth)
- It provides deterrence/convenience, not secure access control

---

## Teacher Mode Access

Open:

- `docs/pages/teacher.html`

Unlock with passcode:

- current local passcode in code: `n5teacher`

Session behavior:

- unlock persists for current browser tab/session via `sessionStorage`
- lock/logout clears teacher session and returns to home

---

## Accessibility And UX

Implemented UX/accessibility support includes:

- keyboard focus styles and interactive controls
- ARIA labels for dynamic sections and tool groups
- modal close affordances (close button/backdrop/Escape where implemented)
- reduced-motion-aware animation patterns
- consistent feedback iconography and color semantics

---

## Tech Stack

- HTML
- CSS
- Vanilla JavaScript
- Pyodide (browser Python runtime for run/check tasks where used)
- Django (serves frontend + API in one app runtime)
- PostgreSQL (managed in production; Neon/Render/Railway-compatible)

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

## Run Locally

1. Clone repository:

```bash
git clone https://github.com/aaronhughes05/n5-programming-worked-examples.git
```

2. Run the Django app:

```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver
```

3. Open `http://127.0.0.1:8000/`.

No build step is required.

---

## Manual Smoke Test Checklist

1. Home page loads with app bar, dashboard, and examples preview.
2. App bar links route correctly from both `/docs` and `/docs/pages`.
3. Stepper behavior works (Back/Next/Restart + required checks).
4. Progress persists on reload for activities with saved data.
5. Assessment gate appears correctly when examples are incomplete.
6. Feedback/hints render correctly and update after failed attempts.
7. Teacher mode lock/unlock flow works as expected.
8. Teacher exports generate valid CSV and JSON files.
9. Reset/Insert Test Data actions immediately refresh teacher analytics.
10. Responsive layout remains usable on mobile widths.

---

## Known Limitations

- `docs/pages/example3.html` is currently an empty placeholder.
- All state and analytics are local to the browser (no backend sync).
- Teacher mode protection is client-side only.

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
