# Updates — Sunday, May 3 2026

## 4. Interactive Game Exercises

**Goal:** Add three new game-like question types inside the existing lesson/exercise system to make students more active and engaged.

### New Question Types

| Type | Student Experience |
|---|---|
| `ordering` | Drag items (or use ▲▼ buttons) to arrange them in the correct sequence |
| `fill_blank` | Click a word from a word bank to fill a blank (`___`) in a sentence |
| `word_scramble` | Click shuffled letter tiles in order to spell the answer word |

### Backend

**Modified** (`content/views.py` — `_grade_exercise()`):
- Added `ordering` branch: partial credit — 1 point per item placed in the correct position; `total += len(items)`
- Extended `fill_blank` and `word_scramble` to the case-insensitive text comparison branch (`qtype in ('text', 'fill_blank', 'word_scramble')`)

**Modified** (`content/views.py` — `_strip_question()` inside `PublishedLessonDetailView`):
- Added `word_scramble` exception: keeps the `correct` field in the response (the letters are the puzzle tiles the student must see); only strips `caseSensitive`

### Frontend — Teacher

**Modified** (`frontend/src/pages/teacher/ExerciseBuilder.jsx`):
- Added 3 entries to `TYPE_LABELS` and the `TYPES` dropdown: **↕ Drag to Order**, **_ Fill in the Blank**, **? Word Scramble**
- `OrderingEditor`: numbered list of text inputs entered in the correct order; add/remove buttons
- `FillBlankEditor`: correct-answer field + editable word bank list (correct answer + distractors); hint to use `___` in the question text
- `WordScrambleEditor`: single answer-word input; hint explains letters will be shuffled for students
- `newQuestion()` extended: `items` array for ordering, `word_bank` array for fill_blank
- Validation for all 3 types (ordering needs ≥2 items with text; fill_blank needs `___` in text + ≥2 word bank entries; word_scramble needs ≥2-char answer)

### Frontend — Student

**Modified** (`frontend/src/pages/student/StudentPortalLesson.jsx`):
- `OrderingQuestion`: items shuffled on mount; HTML5 native drag-and-drop + ▲▼ arrow fallback; calls `onChange` with array of item IDs on every reorder
- `FillBlankQuestion`: renders sentence with `___` replaced by an interactive blank slot; word bank chips below; clicking the blank clears the selection
- `WordScrambleQuestion`: placed-letters area (dashed box) + available-letter tiles; click tile to place, click placed tile to remove; Reset button; resets on retry
- `OrderingResultRows`: per-position ✅/❌ breakdown showing student order vs correct order
- `InlineQuestionResult` extended: routes `ordering` type to `OrderingResultRows`
- `hasAnswer` extended: ordering requires full-length ID array; word_scramble requires all letters placed

### Files changed

| File | Change |
|---|---|
| `content/views.py` | Added ordering grading; extended text comparison; kept `correct` for word_scramble in published response |
| `frontend/src/pages/teacher/ExerciseBuilder.jsx` | Added 3 question types, editors, validation |
| `frontend/src/pages/student/StudentPortalLesson.jsx` | Added 3 question components + result display |

---

## 1. In-App Notification Center

**Goal:** Give all users a persistent bell notification system inside the sidebar so they are informed of key events without relying on email alone.

### Backend

**New model** (`accounts/models.py`):
- `Notification(recipient, type, title, message, is_read, link, created_at)` — linked to `CustomUser` via FK
- 5 notification types: `request_approved`, `request_rejected`, `student_approved`, `lesson_published`, `attendance_recorded`

**New helper** (`accounts/utils.py`):
- `notify(recipient_id, type, title, message, link)` — single-call factory for creating notifications; imported lazily to avoid circular imports

**New API endpoints** (`accounts/views.py` + `accounts/urls.py`):
- `GET  /api/notifications/` — returns unread-first list (last 50) + `unread_count`
- `POST /api/notifications/mark-read/` — marks specific IDs or all as read
- `DELETE /api/notifications/<id>/` — dismisses a single notification

**Auto-trigger points added to existing views:**
- `RegistrationRequestApproveView` → notifies the newly created user
- `StudentRequestApproveView` → notifies the parent when their student is approved
- `LessonDetailView.patch()` → notifies all parents in the subject group's center(s) when a lesson is published for the first time

**Migration:** `accounts/migrations/0007_alter_customuser_options_notification.py`

### Frontend

**New API module** (`frontend/src/api/notifications.js`):
- `getNotifications()`, `markNotificationsRead(ids)`, `deleteNotification(id)`

**`NotificationBell` component** (inside `frontend/src/components/Layout.jsx`):
- Polls `GET /api/notifications/` every 30 seconds via `setInterval`
- Bell icon with red unread count badge in the sidebar
- Clicking opens an inline dropdown showing the latest notifications
- Each row: blue dot (unread), title, message, time-ago, dismiss (×) button
- "Mark all read" button at top of dropdown
- "See all notifications →" link at bottom

**New page** (`frontend/src/pages/NotificationsPage.jsx`):
- Full list view with All / Unread filter tabs
- Color-coded left border and icon per notification type
- Per-notification Mark read + dismiss controls
- Route: `/notifications`

---

## 2. Attendance Tracking

**Goal:** Let teachers record daily attendance per subject group and let parents view their students' history.

### Backend — new `attendance` Django app

**New model** (`attendance/models.py`):
- `AttendanceRecord(id UUID, subject_group, student, date, status, notes, recorded_by, created_at)`
- `unique_together = ('subject_group', 'student', 'date')` — prevents duplicates
- Status choices: `present`, `absent`, `late`, `excused`

**New permissions** (`accounts/permissions.py`):
- `can_manage_attendance` — added to teacher role
- `can_view_attendance` — added to parent role
- `CanManageAttendance` and `CanViewAttendance` DRF permission classes

**New API endpoints** (`attendance/views.py` + `attendance/urls.py`):
- `GET  /api/attendance/subject-groups/<uuid>/?date=YYYY-MM-DD` — teacher fetches records for a group on a date
- `POST /api/attendance/subject-groups/<uuid>/` — teacher bulk-upserts attendance (`{"date": "...", "records": [...]}`)
- `GET  /api/attendance/subject-groups/<uuid>/summary/` — per-student totals (present/absent/late/excused counts + %)
- `GET  /api/attendance/parent/` — parent views all their students' attendance history

**Registered in:**
- `LMS/settings.py` → added `'attendance'` to `INSTALLED_APPS`
- `LMS/urls.py` → mounted at `api/attendance/`

**Migration:** `attendance/migrations/0001_initial.py`

### Frontend

**New API functions** (added to `frontend/src/api/content.js`):
- `getAttendance(groupId, date)`, `saveAttendance(groupId, date, records)`, `getAttendanceSummary(groupId)`, `getParentAttendance()`

**Teacher page** (`frontend/src/pages/teacher/AttendancePage.jsx`):
- Group picker + date picker (defaults to today)
- **Take Attendance tab** — table of students with Present / Late / Absent / Excused toggle buttons; absent rows highlighted red, late rows highlighted yellow; Save button bulk-upserts to backend
- **Summary tab** — 3 StatCards (student count, class avg %, avg sessions/student) + per-student table with color-coded progress bars and percentages
- Route: `/teacher/attendance`

**Parent page** (`frontend/src/pages/parent/AttendancePage.jsx`):
- 3 overview StatCards (students, overall %, total sessions)
- Per-child expandable cards: large % indicator, progress bar, expandable history table (date / subject / status badge)
- Route: `/parent/attendance`

---

## 3. Student Progress Dashboard

**Goal:** Give parents a visual, per-subject breakdown of their student's lesson completion and exercise scores.

### Backend

No new model — aggregates existing `ExerciseSubmission`, `Lesson`, and `SubjectGroup` data.

**New helper function** `_build_progress(student)` (`content/views.py`):
- Finds the best submission (highest %) per exercise section
- A lesson is **completed** when all its exercise sections have a passing submission (≥ 70%)
- Returns: overall stats + per-subject-group breakdown + per-lesson completion/score

**New API endpoint:**
- `GET /api/content/progress/student/<id>/` — parent must own the student; teachers can view any
- Response shape: `{ student, overall: { lessons_completed, lessons_total, completion_pct, avg_score }, subject_groups: [...] }`

**URL registered** in `content/urls.py`.

### Frontend

**New API function** (added to `frontend/src/api/content.js`):
- `getStudentProgress(studentId)`

**Parent page** (`frontend/src/pages/parent/ProgressPage.jsx`):
- Student selector tab buttons when parent has multiple children
- 4 StatCards: Lessons Completed, Completion Rate, Avg Score, Active Subjects
- Overall progress bar
- Collapsible subject group accordions — each shows: colored dot (track color), title, completion %, lesson count, avg score badge, progress bar
- Per-lesson rows inside accordions: green circle (completed ≥70%) / empty circle / no-exercise label, score badge, last attempt date
- Route: `/parent/progress`

---

## Files changed summary

| File | Change |
|---|---|
| `accounts/models.py` | Added `Notification` model + 2 attendance permission codenames |
| `accounts/utils.py` | Added `notify()` helper |
| `accounts/views.py` | Added 3 notification views + `notify()` triggers in 3 existing views |
| `accounts/urls.py` | Added 3 notification URL patterns |
| `accounts/permissions.py` | Added `PERM_MANAGE_ATTENDANCE`, `PERM_VIEW_ATTENDANCE`, their DRF classes, updated role map |
| `content/views.py` | Added `notify()` import + lesson-publish trigger + `_build_progress()` + `StudentProgressView` |
| `content/urls.py` | Added progress URL pattern |
| `LMS/settings.py` | Added `'attendance'` to `INSTALLED_APPS` |
| `LMS/urls.py` | Mounted `api/attendance/` |
| `attendance/__init__.py` | New app |
| `attendance/apps.py` | `AttendanceConfig` |
| `attendance/models.py` | `AttendanceRecord` model |
| `attendance/views.py` | 3 views (by-group, summary, parent) |
| `attendance/serializers.py` | 3 serializers |
| `attendance/urls.py` | 3 URL patterns |
| `attendance/migrations/0001_initial.py` | Initial migration |
| `accounts/migrations/0007_…_notification.py` | Notification model migration |
| `frontend/src/api/notifications.js` | New — 3 notification API functions |
| `frontend/src/api/content.js` | Added attendance + progress API functions |
| `frontend/src/components/Layout.jsx` | Added `NotificationBell` component + 3 new sidebar links (Attendance ×2, Progress) |
| `frontend/src/App.jsx` | Added 5 new routes (notifications, teacher attendance, parent attendance, parent progress) |
| `frontend/src/pages/NotificationsPage.jsx` | New — full notifications list page |
| `frontend/src/pages/teacher/AttendancePage.jsx` | New — teacher attendance UI |
| `frontend/src/pages/parent/AttendancePage.jsx` | New — parent attendance view |
| `frontend/src/pages/parent/ProgressPage.jsx` | New — student progress dashboard |
