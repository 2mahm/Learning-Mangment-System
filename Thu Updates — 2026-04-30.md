# Updates — Thursday, April 30 2026

## 1. Hide lesson ID from URL (Student Portal)

**Problem:** Opening a lesson exposed its UUID in the browser address bar:
`http://localhost:3000/student/lessons/6e4ffc94-8941-4f44-b11d-4e334c332069`

**Fix:** Switched to React Router state-based navigation so the ID is passed invisibly through route state instead of the URL path.

**Files changed:**
- `frontend/src/App.jsx` — route changed from `/student/lessons/:lessonId` to `/student/lesson`
- `frontend/src/pages/student/StudentPortalContent.jsx` — `navigate()` now passes `{ state: { lessonId } }` instead of embedding the ID in the path
- `frontend/src/pages/student/StudentPortalLesson.jsx` — reads `lessonId` from `useLocation().state` instead of `useParams()`; redirects to `/student/content` if state is missing (e.g. direct URL access or page refresh)

---

## 2. Exercise list redesign (Student Portal Lesson)

**Goal:** Make exercises more suitable for students and more efficient.

### What changed in `frontend/src/pages/student/StudentPortalLesson.jsx`:

**Removed**
- SurveyJS dependency (`survey-core`, `survey-react-ui`) — replaced with custom React components
- All debug `console.log` statements
- `buildModel` / `exerciseToSurveyJSON` helper functions

**Custom question UI**
- `MultiChoiceQuestion` — styled clickable radio cards, selected choice is highlighted
- `TrueFalseQuestion` — two large toggle-style True / False buttons
- `TextQuestion` — clean textarea with animated focus border
- `MatchingQuestion` — wraps the existing color-coded drag-connect UI
- Progress bar at the top of each exercise showing answered vs. total questions
- Submit button stays disabled until all questions are answered; shows remaining count

**Exercises overview panel**
- "📝 Exercises N/N" button added to the lesson topbar — toggles a dedicated exercises panel
- Panel shows a summary row: Total / Completed / Passed
- Each exercise card displays: status icon (🔲 not started / ✅ passed ≥70% / ❌ failed), score, and a Start / View action
- Clicking any card navigates directly to that exercise section

**TOC badges**
- Exercise sections in the sidebar table of contents now show a status badge:
  - 📝 not started
  - ✅ passed (score ≥ 70%)
  - ❌ failed
- Badges update live when a student submits an exercise — no page reload needed

**Exercise status tracking**
- All exercise statuses are fetched in parallel when the lesson loads
- Submitting an exercise updates the parent state immediately, keeping TOC badges and the overview panel in sync

---

## 3. Publish lesson to all grades when no grade is selected

**Problem:** When a teacher published a lesson without selecting any target grades, there was no clear indication of who would see it, and grade-based filtering had a silent bug.

**Backend bug fixed (`content/views.py`):**
- `l.target_grades.filter(name=student.grade)` was passing a `Grade` FK object to a `CharField` filter — Django calls `str()` on it, producing `"Name (Center)"` which never matches the stored `name` field.
- Fixed in all three places (`PublishedSubjectGroupListView`, `PublishedLessonListView`, `PublishedLessonDetailView`) to use `filter(id=student.grade_id)` instead.
- The "no grade = all students" logic (`if not l.target_grades.exists()`) was already correct and continues to work.

**Teacher UI (`frontend/src/pages/teacher/SubjectGroupDetail.jsx`):**
- The lesson card now always shows a grade label: `🎓 All grades` when none are selected, or `🎓 Grade 1, Grade 2` when specific grades are set — previously it showed nothing when blank.

---

## 4. Fix `TypeError: Object of type Grade is not JSON serializable`

**Problem:** The `/api/content/lessons/<id>/exercise-stats/` endpoint crashed with a JSON serialization error.

**Cause:** Two views were storing the raw `Grade` FK object directly into the response dict instead of its string name.

**Fix (`content/views.py`):**
- `ExerciseResultsView` (line 790): `s.student.grade` → `s.student.grade.name if s.student.grade_id else ''`
- `ExerciseStatsView` (line 838): same fix
- Both views updated from `select_related('student')` to `select_related('student__grade')` to avoid N+1 queries when reading `grade.name`

---

## 5. Hide lesson ID from teacher performance URL

**Problem:** Navigating to the performance page exposed the lesson UUID:
`http://localhost:3000/teacher/lessons/07b1c258-6f24-4dc0-bef3-0f060c13f1f3/performance`

**Fix:** Same pattern as the student lesson URL — switched to router state navigation.

**Files changed:**
- `frontend/src/App.jsx` — route changed from `/teacher/lessons/:lessonId/performance` to `/teacher/lessons/performance`
- `frontend/src/pages/teacher/LessonEditor.jsx` — `navigate()` now passes `{ state: { lessonId } }` instead of embedding the ID in the path
- `frontend/src/pages/teacher/ExercisePerformance.jsx` — switched from `useParams()` to `useLocation().state`; redirects to `/teacher/subject-groups` if accessed directly without state
