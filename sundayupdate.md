# Sunday Update — 2026-04-27

## 1. Disable Delete Button for Used Invitations
**File:** `frontend/src/pages/admin/Invitations.jsx`

The delete button in the invitations table is now disabled when the invitation has been used (`is_used = true`). The button gets `disabled`, reduced opacity (0.4), and a `not-allowed` cursor to make the state visually clear.

---

## 2. Prevent Duplicate Invitations to the Same Email
**File:** `accounts/serializers.py`

Added `validate_email` to `InvitationCreateSerializer`. Before saving a new invitation, it checks for an existing invitation with the same email that is **not used** and **not expired**. If one exists, a `400` validation error is returned:
> "An active invitation has already been sent to this email address."

Once an invitation is used or expires, a new one can be sent to the same email freely.

---

## 3. Remove Short Link Scenario — Send Real Link in Email

### Backend (`accounts/utils.py`)
- Removed `_shorten_via_tinyurl()`, `shorten_url()`, and `get_invite_link()` functions entirely.
- Removed `import requests` and the Bitly/TinyURL API constants.

### Backend (`accounts/views.py`)
- Removed `get_invite_link` import.
- Invite link is now built directly as `{frontend_origin}/register?token={token}`.
- Removed `invite_long_url` from the API response.
- Email receives the real registration link.

### Frontend (`frontend/src/App.jsx`)
- Removed `import InviteRedirect` and the `/i/:token` route.

### Frontend (`frontend/src/pages/admin/Invitations.jsx`)
- Success alert now shows a single "Invitation link" field (the real URL).
- Removed short link label, full link, and dev link sections.
- Copy button renamed from "Copy Short Link" to "Copy Link".

---

## 4. Fix Invite Link Pointing to Django Instead of Frontend
**File:** `accounts/views.py`

The invite link now reads the `Origin` header from the incoming request, which is always the frontend's URL (`http://localhost:3000` in dev, the real domain in production). Falls back to `SITE_BASE_URL` env var, then Django's own host if the header is absent.

Token is automatically removed from the browser address bar on the Register page — `Register.jsx` already saves the token to `sessionStorage` and calls `setParams({}, { replace: true })` on load.

---

## 5. Strong Password Validation on Registration

### Backend (`accounts/serializers.py`)
- Added `import re`.
- `RegisterSerializer` password field `min_length` raised from `8` → `12`.
- Added complexity checks in `validate()` — collects all failures and raises them together:
  - At least 2 numbers
  - At least 2 special characters (`[^a-zA-Z0-9]`)
  - At least 1 uppercase letter
  - Password must not be identical to the email address

### Frontend (`frontend/src/pages/Register.jsx`)
- Added `PasswordRules` component rendered below the password field.
- Shows 5 live-updating rules with `○` / `✓` indicators that turn green as each rule is met:
  - At least 12 characters
  - At least 2 numbers
  - At least 2 special characters
  - At least 1 uppercase letter
  - Must not match your email
- Password field placeholder updated to reflect the new requirements.

---

## 6. Fix "Invalid Invitation" Flash After Successful Registration + Redirect to Login

### Problem
After a successful registration submit, `sessionStorage.removeItem('invite_token')` cleared the stored token. On re-render `token` became `null`, re-triggering the validation `useEffect` which called `setTokenError(...)` and overwrote the success state — showing "Invalid Invitation" instead of the success screen.

### Fix (`frontend/src/pages/Register.jsx`)
- `token` is now stored in `useState` with a lazy initializer (computed once at mount), so it never changes after the session storage is cleared.
- The validation `useEffect` dependency is `[token]` which no longer fires again after submit.
- Added a `useEffect` on `[success]` that calls `navigate('/login')` after 3 seconds.
- Success screen updated to show: "Registration Submitted — pending admin approval" + "Redirecting to login page…".

---

## 8. Student Class (Grade) Targeting for Lessons & Groups

Teachers can now restrict a subject group or individual lesson to specific student classes (grades). Students only see content that matches their grade; content with no grades set is visible to everyone.

### Backend

**`content/models.py`**
- Added `target_grades = JSONField(default=list, blank=True)` to both `SubjectGroup` and `Lesson`.
- Empty list `[]` = visible to all students.

**`content/migrations/0003_add_target_grades.py`**
- New migration adding `target_grades` to both models.

**`accounts/authentication.py`**
- `StudentTokenAuthentication` now returns `(parent_user, student)` instead of `(parent_user, None)`, exposing the `Student` object on `request.auth` for downstream grade checks.

**`content/serializers.py`**
- `target_grades` added to `SubjectGroupSerializer`, `LessonListSerializer`, `LessonDetailSerializer`, and `PublishedSubjectGroupSerializer`.

**`content/views.py`**
- Added `_student_from_request(request)` helper — returns the `Student` from `request.auth` if the request came via `StudentToken`, else `None`.
- `PublishedSubjectGroupListView`: filters groups in Python — skips groups whose `target_grades` is non-empty and doesn't include the student's grade.
- `PublishedLessonListView`: same Python-level filter on lessons.
- `PublishedLessonDetailView`: returns 404 if the lesson has grade restrictions that exclude the requesting student.
- Filtering is Python-level (not DB-level) for SQLite compatibility.

**`accounts/views.py`**
- New `GradeListView` — `GET /grades/` returns a sorted list of unique grade strings from all approved students. Used to populate the grade-picker in the teacher UI.

**`accounts/urls.py`**
- Registered `GET /grades/` → `GradeListView`.

### Frontend

**`frontend/src/api/content.js`**
- Added `export const getGrades = () => client.get('/grades/')`.

**`frontend/src/pages/teacher/SubjectGroups.jsx`**
- `target_grades: []` added to `EMPTY_FORM`.
- Fetches available grades on mount via `getGrades()`.
- "Target Classes" checkbox list added to the group creation form (only shown when grades exist). Empty selection = all students.
- Group cards now show a 🎓 badge listing the targeted grades when set.

**`frontend/src/pages/teacher/SubjectGroupDetail.jsx`**
- Fetches available grades on mount.
- Lesson creation form expanded: grade checkboxes appear below the title input.
- Each lesson row shows its targeted grades (🎓 label) and a 🎓 button to open inline grade editing — saves via `PATCH /content/lessons/<id>/`.

---

## 7. Approval Email Button Uses Dynamic Login URL

### Problem
The invitation email link was built dynamically from `HTTP_ORIGIN` (request-aware), but the approval email's `login_url` was built by `_get_login_url()` which only read the `SITE_BASE_URL` env var — potentially pointing to the wrong host.

### Backend (`accounts/views.py`)
- In `RegistrationRequestApproveView`, `login_url` is now built from `HTTP_ORIGIN` (same pattern as the invite link) before calling `send_registration_approved_email`.

### Backend (`accounts/utils.py`)
- `send_registration_approved_email` now accepts `login_url` as an explicit parameter; falls back to `_get_login_url()` if omitted.

### Template (`accounts/templates/emails/registration_approved.html`)
- Added a plain-text fallback link below the "Log In Now" button so users can copy-paste the URL if their email client does not render HTML buttons.

---

## 9. Exercise System — Auto-Graded Exercises for Students

Full end-to-end exercise feature: teachers build exercises, students take them, results are graded server-side, and teachers track performance per student.

### Backend

**`content/models.py`**
- Added `ExerciseSubmission` model:
  - `id` — UUID primary key
  - `section` — FK to `LessonSection` (type=`exercise`)
  - `student` — FK to `accounts.Student`
  - `answers` — JSONField (student's raw answers)
  - `score`, `total` — integers
  - `details` — JSONField (per-question correct/wrong breakdown)
  - `submitted_at` — auto timestamp
  - `percentage` — computed property

**`content/views.py`**
- Added `_grade_exercise(exercise_body, answers)` helper — compares student answers against stored `correct` fields (case-insensitive for text questions). Returns `{ score, total, details }`. Correct answers are **never** sent to the student.
- Added `ExerciseSubmitView` (`POST /content/sections/<id>/submit/`) — grades and saves the attempt; allows re-submission (each attempt is stored).
- Added `ExerciseMyResultView` (`GET /content/sections/<id>/my-result/`) — returns the student's latest attempt or `{ attempted: false }`.
- Added `ExerciseResultsView` (`GET /content/sections/<id>/results/`) — teacher-only; returns all submissions with latest-per-student flagged.
- Added `ExerciseStatsView` (`GET /content/lessons/<id>/exercise-stats/`) — teacher-only; returns a student × exercise performance grid (students as rows, exercises as columns).
- `PublishedLessonDetailView` now strips `correct` and `caseSensitive` fields from exercise sections before returning the response, so correct answers are never exposed to the student API.

**`content/urls.py`**
- Added 4 new routes:
  - `POST sections/<uuid>/submit/`
  - `GET  sections/<uuid>/my-result/`
  - `GET  sections/<uuid>/results/`
  - `GET  lessons/<uuid>/exercise-stats/`

**`content/admin.py`**
- Registered `ExerciseSubmission` with `list_display`: section, student, score, total, percentage, submitted_at.

> **Migration required:** `python manage.py makemigrations content && python manage.py migrate`

### Frontend

**`frontend/src/api/exercises.js`** *(new file)*
- `getExerciseResults(sectionId)` — teacher: all submissions for one exercise
- `getExerciseStats(lessonId)` — teacher: full student × exercise grid
- `submitExercise(sectionId, answers)` — student: submit and receive graded result
- `getMyResult(sectionId)` — student: check prior attempt

**`frontend/src/pages/teacher/ExerciseBuilder.jsx`** *(new file)*
- Custom React exercise editor — replaces Survey Creator entirely.
- Question types supported: Multiple Choice, True/False, Text Answer.
- Each question supports an optional image upload via `uploadSectionMedia`.
- `MultipleChoiceEditor`: click the radio button to mark the correct answer.
- Client-side validation before save: title required, at least one question, all questions need text, MC needs ≥ 2 choices and a correct answer marked, text questions need a correct answer.
- `onSave(sectionId, { title, content_body })` callback wired into `LessonEditor`.

**`frontend/src/pages/teacher/LessonEditor.jsx`**
- Removed all Survey Creator imports (`survey-creator-react`, `survey-creator-core`).
- Replaced `ExerciseEditor` component (which used `SurveyCreator`) with `<ExerciseBuilder>`.
- Added "📊 Performance" button to the top bar (next to Publish) — navigates to `/teacher/lessons/:lessonId/performance`.

**`frontend/src/pages/teacher/ExercisePerformance.jsx`** *(new file)*
- Teacher dashboard: students as rows, exercises as columns, color-coded score badges.
- Green ≥ 70 %, yellow ≥ 40 %, red < 40 %.
- Click any exercise column header to open a `DetailModal` showing per-student scores and submission dates for that exercise.
- Accessed at `/teacher/lessons/:lessonId/performance`.

**`frontend/src/pages/student/StudentPortalLesson.jsx`**
- `ExerciseViewer` component fully rewritten:
  - On load: checks `getMyResult` — shows prior result immediately if already attempted.
  - Renders exercise via SurveyJS `survey-react-ui` with `survey-core/survey-core.css`.
  - `buildModel()` enables HTML rendering in question descriptions via `onTextMarkdown` — required for question images to display correctly.
  - On submit: calls `submitExercise`, transitions to result view.
  - `ExerciseResult` component shows score/percentage, per-question correct/wrong highlight with correct answer revealed only for wrong answers, and a "Try Again" button.
- Added `useRef` back to React imports (was accidentally dropped in a prior edit).

**`frontend/src/App.jsx`**
- Added `import ExercisePerformance`.
- Added route: `GET /teacher/lessons/:lessonId/performance` → `ExercisePerformance` (teacher-only protected route).

---

## 10. Grade Management — Center-Scoped Grades with Lesson & Student Assignment

Admins define a named list of grades per center. Teachers see only the grades belonging to their center(s) when creating groups or lessons. A lesson can be restricted to specific grades **and/or** assigned directly to specific students.

### Scenario

**Step 1 — Admin creates grades for a center**
1. Staff admin logs in → sidebar shows **Grades** link (below Centers).
2. Opens `/admin/grades` → selects center "Cairo Center" → types "Grade 1" → clicks **Add Grade**. Repeats for "Grade 2", "Grade 3".
3. The Django admin panel at `/django-admin/accounts/grade/` also shows the full grades table, filterable by center.

**Step 2 — Teacher creates a subject group restricted to Grade 1**
1. Teacher logs in → opens **Subject Groups** → clicks **+ New Group**.
2. Selects center "Cairo Center" → the **Target Grades** checkboxes appear: Grade 1, Grade 2, Grade 3.
3. Checks "Grade 1" only → submits. The group card displays `🎓 Grade 1`.

**Step 3 — Teacher creates a lesson and assigns it to Grade 2 + one specific student**
1. Inside the subject group → opens **Lessons** tab → **+ Add Lesson**.
2. Checks "Grade 2" under *Target grades*.
3. Under *Also assign to specific students* checks "Ahmed" (a Grade 3 student who should get an exception).
4. Clicks **Create**.

**Step 4 — Student access**
- A Grade 1 student opens the published groups list → sees only the group from Step 2 (Grade 1 match). Inside, the Grade 2 lesson from Step 3 is **not** shown.
- A Grade 2 student → sees both the group and the lesson (grade match).
- Ahmed (Grade 3) → sees the lesson from Step 3 because he is in `assigned_students` (explicit override).
- A Grade 3 student who is **not** Ahmed → cannot see the Grade 2 lesson.

**Step 5 — Teacher updates lesson grades inline**
1. Teacher clicks the 🎓 button on a lesson row → checkboxes appear inline → updates grades → **Save**.
2. Teacher clicks the 👤 button → student checkboxes appear → updates assignment → **Save**.

---

### Backend

**`accounts/models.py`**
- Added `Grade` model: `name` (CharField), `center` (FK → Center), `sort_order` (PositiveIntegerField). `unique_together = [('name', 'center')]`.
- Added `can_manage_grades` to `CustomUser.Meta.permissions`.

**`accounts/permissions.py`**
- Added `PERM_MANAGE_GRADES = 'can_manage_grades'` constant and `CanManageGrades` DRF permission class.
- Added `PERM_MANAGE_GRADES` to the `center_admin` default permission set.

**`accounts/serializers.py`**
- Added `GradeSerializer` with `center_name` read field.

**`accounts/views.py`**
- Replaced `GradeListView` with `GradeListCreateView` (GET filtered by requester's centers, POST requires `can_manage_grades`) and `GradeDetailView` (PATCH / DELETE).

**`accounts/urls.py`**
- `GET/POST /api/grades/` → `GradeListCreateView`
- `GET/PATCH/DELETE /api/grades/<pk>/` → `GradeDetailView`

**`accounts/admin.py`**
- Registered `Grade` with `list_display = ['name', 'center', 'sort_order']`, `list_filter = ['center']`.

**`content/models.py`**
- `SubjectGroup.target_grades`: JSONField → `ManyToManyField(Grade)`.
- `Lesson.target_grades`: JSONField → `ManyToManyField(Grade)`.
- `Lesson.assigned_students`: new `ManyToManyField(Student, blank=True)`.

**`content/serializers.py`**
- `SubjectGroupSerializer`: `target_grades` is now M2M PKs; added `target_grade_details` (read-only list of `{id, name}`).
- `LessonListSerializer` / `LessonDetailSerializer`: same grade changes + `assigned_students` (M2M PKs) and `assigned_student_names` (read-only list of `{id, name}`).
- `PublishedSubjectGroupSerializer`: exposes `target_grade_details` instead of raw JSONField.

**`content/views.py`**
- `PublishedSubjectGroupListView`: grade filter now uses `target_grades.filter(name=student.grade).exists()`.
- `PublishedLessonListView`: same M2M check; student is also allowed if in `assigned_students`.
- `PublishedLessonDetailView`: same combined grade + explicit-student access check.
- Added `GroupStudentsView` (`GET /content/subject-groups/<group_pk>/students/`) — returns students whose parent's center is in the group's centers (used by teacher to pick assignment targets).

**`content/urls.py`**
- Added `subject-groups/<group_pk>/students/` → `GroupStudentsView`.

**Migrations**
- `accounts 0005` — creates `Grade` model.
- `content 0005` — removes JSONField `target_grades`, adds M2M `target_grades` + `assigned_students` on `Lesson`, M2M `target_grades` on `SubjectGroup`.

### Frontend

**`frontend/src/api/content.js`**
- `getGrades()` now returns grade objects `{id, name, center, center_name}`.
- Added `createGrade(data)`, `updateGrade(id, data)`, `deleteGrade(id)`.
- Added `getGroupStudents(groupId)` → `GET /content/subject-groups/<id>/students/`.

**`frontend/src/pages/admin/Grades.jsx`** *(new file)*
- Admin page at `/admin/grades` (staff only). Lists grades grouped by center. Add / edit / delete with inline form. Center filter dropdown for multi-center admins.

**`frontend/src/App.jsx`**
- Added `import Grades` and route `/admin/grades` (staffOnly).

**`frontend/src/components/Layout.jsx`**
- Added **Grades** sidebar link (academic icon, staff only, below Centers).

**`frontend/src/pages/teacher/SubjectGroups.jsx`**
- `availableGrades` now holds grade objects. Grade checkboxes use `grade.id` as value and `grade.name` as label. Only grades belonging to the currently selected centers are shown.

**`frontend/src/pages/teacher/SubjectGroupDetail.jsx`**
- Grade picker uses grade IDs; displays `target_grade_details[].name` in lesson rows.
- Added student assignment: 👤 button per lesson opens inline checkboxes of students in the group's centers. Saves via `PATCH /content/lessons/<id>/` with `assigned_students` IDs.
- Lesson create form also includes both grade and student checkboxes.
