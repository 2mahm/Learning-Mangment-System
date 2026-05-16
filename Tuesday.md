# Tuesday Updates — 2026-04-28

## Feature: Auto-generate Student Credentials on Approval

### What Changed

When an admin approves a student request, the system now **automatically generates** a unique username and a secure password instead of requiring the admin to provide them manually.

---

### Backend — `lacm-v1.2/accounts/views.py`

**New imports added:**
- `re`, `secrets`, `string` — for username/password generation
- `from django.db import IntegrityError` — for race-condition safety net

**New helper functions added before `StudentRequestApproveView`:**

- `_generate_unique_student_username(name)` — 3-layer uniqueness strategy:
  - Layer 1: `<normalized_name><4-digit suffix>` — 20 attempts (e.g. `ahmed4521`)
  - Layer 2: `<normalized_name><6-digit suffix>` — 20 attempts (fallback for crowded namespaces)
  - Layer 3: `<normalized_name><uuid4_hex[:8]>` — guaranteed unique fallback, never fails

- `_generate_student_password()` — generates a secure 10-character alphanumeric password using `secrets.choice`

**`StudentRequestApproveView.post()` updated:**
- Removed manual `username` and `password` fields from request body validation
- Auto-generates both credentials on approval
- `Student.objects.create()` wrapped in `try/except IntegrityError` to handle concurrent write race conditions

**Note:** `Student.username` already had `unique=True` at the DB level — no migration needed.

---

### Frontend — `lacm-v1.2/frontend/src/pages/admin/StudentRequests.jsx`

- Removed **Username** and **Password** input fields from the approval form
- Updated grid layout from 4 columns to 2 columns (Grade selector + Confirm button)
- Updated form label to: *"username & password will be auto-generated"*
- Updated page subtitle to: *"Credentials are auto-generated on approval."*
- Cleaned up `credentials` state — now only tracks `{ grade }`

---

### Result

Admin approval flow is now:
1. Click **Approve** on a student request
2. Select the **Grade** (or keep the original)
3. Click **Confirm**
4. Backend auto-generates credentials and emails them to the parent

---

## Feature: Match Columns Exercise Type + Hints + Custom Exercise Renderer

### What Changed

Added a new **"Match Columns"** exercise type, a per-question **hint system**, and replaced the broken SurveyJS-based student viewer with a fully working custom renderer that submits answers and shows graded results.

---

### Backend — `lacm-v1.2/content/views.py`

**New import:** `import random` added at the top.

**`_grade_exercise()` updated:**
- Added a `matching` branch before the existing logic
- Each pair in a matching question counts as **1 individual point** (`total += len(pairs)`)
- Student answer for matching is a dict `{ pairId: selectedRight }` — each pair compared against `pairs[].right`
- Returns `correct_count` and full `pairs` data in the detail entry

**`PublishedLessonDetailView._strip()` updated:**
- Extracted a `_strip_question(q)` helper
- For `matching` type: removes `pairs` (which would reveal correct answers), adds `lefts` (list of `{id, text}`) and `options` (shuffled right-column values) — students see the left items and shuffled options but not the mapping
- For all other types: unchanged (strips `correct` and `caseSensitive`)

---

### Frontend — `lacm-v1.2/frontend/src/pages/teacher/ExerciseBuilder.jsx`

- Added `matching: 'Match Columns'` to `TYPE_LABELS`
- Added `{ id: 'matching', label: 'Match Columns', icon: '⇌' }` to `AddQuestionMenu`
- **New `MatchingEditor` component:** two-column grid (Left | Right), add/remove pair rows, minimum 2 pairs enforced via disabled delete button
- Added `hint: ''` field to `newQuestion()` — applies to all question types
- Added `pairs` field to `newQuestion()` for matching type (2 blank pairs by default)
- Added **Hint input** to `QuestionCard` (below question text, available for all types)
- Updated `validate()`: matching questions require ≥ 2 pairs with both sides filled

---

### Frontend — `lacm-v1.2/frontend/src/pages/student/StudentLesson.jsx`

**Removed SurveyJS** (`survey-core`, `survey-react-ui`) — the old `ExerciseViewer` passed the app's custom JSON format directly to `new Model()` which is not SurveyJS format, so exercises were rendering blank and answers were never submitted.

**New custom `ExerciseViewer` component:**
- On mount: calls `getMyResult(sectionId)` — if already attempted, shows result immediately
- Tracks `answers`, `hints` (set of revealed question IDs), `result`, `submitting` state
- Calls `submitExercise(sectionId, answers)` on submit → shows graded result

**Per question type rendering:**
| Type | Student UI |
|---|---|
| `multiple_choice` | Styled radio cards (highlighted border when selected) |
| `true_false` | Two toggle buttons (True / False) |
| `text` | Text input |
| `matching` | Left item + arrow + shuffled `<select>` dropdown per row |

**Hint system:**
- `💡 Hint` button appears per question if `q.hint` is set
- Toggles a yellow hint box inline below the question

**New `ResultView` component:**
- Score banner with emoji (🌟 ≥70%, 👍 ≥40%, 📚 otherwise), score fraction, and percentage
- Per-question breakdown: ✅/❌, student's answer, correct answer shown if wrong
- Matching questions show a per-pair breakdown with correct mapping
- **Try Again** button resets state for a new attempt

---

### Result

Exercise workflow end-to-end:
1. Teacher creates an exercise with any combination of question types (including matching) and optional hints per question
2. Student opens the lesson → exercises render correctly with all question types
3. Student can click **💡 Hint** on any question to reveal the hint
4. Student submits → server grades → result panel shows score and per-question feedback
5. Student can retry; teacher sees all attempts in ExercisePerformance

---

## Feature: Grade Filter + Searchable Student Dropdown for Lesson Assignment

### What Changed

When a teacher assigns a lesson to specific students, the previous UI showed a flat checkbox list of **all students** at once. This has been replaced with:
1. A **grade dropdown** — filter students by grade first
2. A **searchable student dropdown** — click to open, type to search, checkboxes inside

---

### Backend — `lacm-v1.2/content/views.py`

**`GroupStudentsView.get()` updated (lines ~804–816):**

- Added `select_related('grade')` to the queryset — eliminates N+1 DB queries
- Changed the response fields from `grade` (raw Django model instance, unsafe to serialize) to:
  - `grade_id` — integer FK, used for filtering in the frontend
  - `grade_name` — string, used for display inside the dropdown

**Before:**
```python
students = Student.objects.filter(...).select_related('parent__user').order_by('name')
data = [{'id': s.id, 'name': s.name, 'grade': s.grade} for s in students]
```

**After:**
```python
students = Student.objects.filter(...).select_related('parent__user', 'grade').order_by('name')
data = [{'id': s.id, 'name': s.name, 'grade_id': s.grade_id, 'grade_name': s.grade.name if s.grade else None} for s in students]
```

---

### Frontend — `lacm-v1.2/frontend/src/pages/teacher/SubjectGroupDetail.jsx`

**New `StudentDropdown` component added** (before the main export):
- Trigger button showing "Select students..." or "N students selected"
- Opens a floating dropdown panel on click
- Search input at the top of the panel (auto-focused)
- Scrollable list of student checkboxes — selected rows highlighted
- Grade name shown on the right of each row
- Click-outside closes the dropdown and clears the search

**New state variables added:**
- `createGradeFilter` — grade filter for the create lesson form
- `editGradeFilter` — grade filter for the per-lesson edit panel

**Create lesson form** — student section replaced:
- Grade `<select>` → filters which students appear in the dropdown
- `<StudentDropdown>` → searchable multi-select of students in the selected grade

**Per-lesson edit panel** — student section replaced:
- Same two-control layout (grade select + StudentDropdown)
- Opening the edit panel resets `editGradeFilter` to empty

---

### Result

Teacher lesson assignment flow is now:
1. Click **+ Add Lesson** (or the 👤 button on an existing lesson)
2. Choose a **grade** from the first dropdown to narrow the list
3. Click the **student dropdown** → type to search → check students to assign
4. Save — selected student IDs are sent to the API unchanged
