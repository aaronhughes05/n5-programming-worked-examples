# Crack the Code
## National 5 Computing Science Worked Examples

Crack the Code is an interactive web resource that supports National 5 learners in moving from a problem description to a working program through structured, guided activities.

The site is intentionally built with plain HTML, CSS, and JavaScript so it runs well in typical school environments without framework dependencies.

---

## Current Status

- Home page, assessment page, and Example 2 are implemented and styled with a unified UI system.
- Example 1 and Example 3 files currently exist but are empty:
  - `docs/pages/example1.html`
  - `docs/pages/example3.html`

This affects some flows (for example, the assessment readiness warning expects all three examples to be completed).

---

## Who This Is For

- National 5 Computing Science learners (typically ages 15–16)
- Beginner programmers who need scaffolded problem-solving support

Expected prior knowledge:

- Variables
- Basic input/output
- Simple arithmetic
- Basic loop awareness

---

## Learning Design

Worked examples use a step-by-step flow with interactive checks to build confidence before independent coding.

Typical activity types include:

- Prediction questions
- Step-by-step code reveal
- Parsons puzzle reordering
- Subgoal matching and code identification
- Modify/extend tasks
- Program run/output checking

Each page uses a stepper that controls progression and shows completion state.

---

## Pedagogical Intent

The resource is designed to reduce cognitive load and improve transfer from guided examples to independent coding.

Design choices include:

- **Consistent structure** across examples so learners can focus on problem solving rather than interface changes.
- **Small verification checkpoints** (checks, trace, code identification) to catch misconceptions early.
- **Progressive release** from modelled solution steps to modification and output validation.
- **Assessment gating warning** to encourage practice-first sequencing while still allowing learner autonomy.

---

## Main Features

### 1) Unified App Bar

All active pages use a shared app bar with:

- quick links (`Home`, `Examples`, `Final Assessment`)
- mobile menu behavior
- resume link (shown when progress exists)

### 2) Home Examples Showcase

The home page has a tabbed examples preview section that:

- auto-rotates through examples
- supports manual tab selection
- preloads preview images to reduce switching lag

### 3) Progress Persistence

Learner progress is saved in `localStorage` per page using:

- `assessmentStepperState.v2:<pathname>`

Saved state includes:

- current step index
- completed checks
- input values
- run/output fields where applicable
- final completion flag when finish screen is reached

### 4) Assessment Readiness Warning

When a user tries to open the assessment without completing all three examples, a warning dialog appears.

Behavior:

- users are warned but can still proceed
- includes progress indicator (`X of 3 examples complete`)
- provides path to the next incomplete example

Completion rule:

- an example counts as complete only after the user reaches that page’s finish screen

### 5) Custom Glass Tooltips

Reusable delayed tooltips are implemented centrally and auto-assigned to pill-style controls for short assistive guidance.

### 6) Back-to-Top FAB

A floating action button appears after scrolling and smoothly returns the page to top.

---

## UX and Interaction Model

### Global Navigation

- Sticky glass app bar on all active pages
- Home/Examples/Assessment quick links
- Resume link appears when valid progress data exists

### Home Experience

- Hero section with direct entry points
- Tabbed preview module for examples and assessment
- Auto-rotating preview with manual override
- Scroll-reveal animation for home cards

### Assessment Warning Flow

When users attempt to open the assessment:

1. Example completion is checked from persisted stepper state.
2. If all examples are complete, navigation proceeds immediately.
3. If not, a warning modal appears with:
   - completion progress (`X of 3`)
   - missing example chips
   - two paths: proceed anyway or open the next incomplete example

---

## Data and State Model

Client-side persistence uses `localStorage` with the namespace:

- `assessmentStepperState.v2:<pathname>`

Saved payload fields include:

- `index`: current step index
- `completedChecks`: IDs marked correct
- `inputs`: text input values
- `makeProgram`, `makeCase`, `makeActual`: make-task state (where present)
- `isComplete`: true only when finish screen is reached

This model supports:

- restoring in-progress work
- resume-link targeting
- assessment readiness checks

---

## Accessibility Notes

Current implementation includes:

- Keyboard-usable controls across navigation and activities
- Modal close by `Esc`, click-outside, and explicit close button
- Focus trapping while modal is open
- Reduced-motion fallbacks for animated UI paths
- Tooltip support on focus, not hover-only

---

## Project Structure

```text
/docs
  index.html
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
```

---

## Tech Stack

- HTML
- CSS
- JavaScript (vanilla)
- Pyodide (for browser-based Python execution in relevant activities)
- GitHub Pages deployment from `/docs`

---

## Key Front-End Modules

### `docs/js/script.js`

Main responsibilities:

- Stepper progression and validation logic
- Local storage save/load/reset
- Parsons drag-and-drop ordering checks
- Subgoal activity checks
- Pyodide run/evaluate path for make tasks
- App bar enhancements and resume-link handling
- Glass tooltip generation and positioning
- Assessment gate modal behavior and routing interception

### `docs/css/styles.css`

Main responsibilities:

- Design tokens and color system
- App bar, card, and edge-sweep visual language
- Responsive layout behavior
- Tooltip and modal visual system
- Home preview interactions and reveal states

---

## Run Locally

1. Clone the repository:

```bash
git clone https://github.com/aaronhughes05/n5-programming-worked-examples.git
```

2. Open:

```text
docs/index.html
```

in a web browser.

No build step is required.

---

## Manual Test Checklist

Recommended smoke tests after UI/logic changes:

1. Home page loads with app bar, examples preview, and footer layout intact.
2. App bar links route correctly from both `/docs` and `/docs/pages`.
3. Example/assessment stepper:
   - next/back/restart work
   - required checks gate step progression
   - completion screen appears at final step
4. Progress persistence:
   - reload restores step + inputs
   - resume link appears when progress exists
5. Assessment gate:
   - warning appears when any example incomplete
   - proceed anyway opens assessment
   - next incomplete example button routes correctly
6. Tooltips:
   - appear after delay
   - position correctly near trigger
   - disappear on leave/blur/escape paths
7. Responsive behavior at mobile widths:
   - app bar menu toggle
   - modal layout
   - examples preview tabs

---

## Known Limitations

- `example1.html` and `example3.html` are currently empty, which impacts full end-to-end learner flow.
- Completion checks are client-side only (local to browser/storage context).
- No analytics/telemetry layer is currently included.

---

## Suggested Next Improvements

- Rebuild Example 1 and Example 3 pages using the shared template and current UI system.
- Add automated UI regression checks (Playwright/Cypress) for critical user journeys.
- Add versioned content metadata for examples to manage future curriculum updates.
- Consider optional teacher mode (progress reset/overview controls).

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
