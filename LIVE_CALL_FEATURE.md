# Live Call Feature — Implementation Plan

## Context
The LMS (lacm-v1.2) needs a live video/audio call feature between teachers and students. Currently there are no real-time features (no WebSockets, no video). The project has a Django/DRF backend and a React 19 frontend. We will embed Jitsi Meet (public meet.jit.si) for the call itself and add a `live` Django app to track sessions via a REST API.

**User choices:**
- Both group sessions (teacher + whole subject group) and 1-on-1 sessions (teacher + one student)
- Sessions can be scheduled in advance (have a `scheduled_at` datetime before going active)
- Public meet.jit.si (no self-hosted server needed)

---

## 1. Backend — New `live` Django App

### 1a. Create app & register
- Create `lacm-v1.2/live/` with `__init__.py`, `models.py`, `serializers.py`, `views.py`, `urls.py`, `permissions.py`, `admin.py`
- Add `'live'` to `INSTALLED_APPS` in `LMS/settings.py`
- Add `JITSI_DOMAIN = 'meet.jit.si'` at the bottom of `LMS/settings.py`
- Mount in `LMS/urls.py`: `path('api/live/', include('live.urls'))`

### 1b. Model — `LiveSession`

```python
class LiveSession(models.Model):
    SESSION_TYPE = [('group', 'Group'), ('private', 'Private')]
    STATUS      = [('scheduled', 'Scheduled'), ('active', 'Active'), ('ended', 'Ended')]

    id            = UUIDField(primary_key=True, default=uuid4)
    session_type  = CharField(choices=SESSION_TYPE, default='group')
    teacher       = ForeignKey(settings.AUTH_USER_MODEL, related_name='hosted_sessions')
    subject_group = ForeignKey(SubjectGroup, null=True, blank=True, related_name='live_sessions')
    student       = ForeignKey(Student, null=True, blank=True, related_name='live_sessions')  # only for 1-on-1
    title         = CharField(max_length=255)
    room_name     = CharField(max_length=200, unique=True)   # auto-generated UUID slug
    status        = CharField(choices=STATUS, default='scheduled')
    scheduled_at  = DateTimeField(null=True, blank=True)     # None = immediate on start
    started_at    = DateTimeField(null=True, blank=True)
    ended_at      = DateTimeField(null=True, blank=True)
    created_at    = DateTimeField(auto_now_add=True)
```

Validation rule (enforced in serializer): either `subject_group` or `student` must be set, not both, and `session_type` must match.

### 1c. API Endpoints

| Method | URL | Who | Action |
|---|---|---|---|
| GET/POST | `/api/live/sessions/` | Teacher | List own sessions; create new session |
| GET/PATCH/DELETE | `/api/live/sessions/<uuid>/` | Teacher | Detail, update title/scheduled_at, delete |
| POST | `/api/live/sessions/<uuid>/start/` | Teacher | Set status=active, started_at=now() |
| POST | `/api/live/sessions/<uuid>/end/` | Teacher | Set status=ended, ended_at=now() |
| GET | `/api/live/groups/<uuid>/sessions/` | Student (StudentToken) | List active+scheduled sessions for that group |
| GET | `/api/live/students/<id>/sessions/` | Student (StudentToken) | List active+scheduled 1-on-1 sessions for that student |

**Auth:** Teacher endpoints use existing `CanManageContent` + object-level owner check. Student endpoints use existing `StudentTokenAuthentication` + `CanViewContent`.

### 1d. Permissions
No new permission codenames needed. Reuse:
- `CanManageContent` → teacher writes
- `CanViewContent` → student reads
- Add `IsTeacherOwner` in `live/permissions.py` for object-level checks

---

## 2. Frontend — npm install

```bash
cd lacm-v1.2/frontend
npm install @jitsi/react-sdk
```

---

## 3. Frontend — API Layer

**New file:** `frontend/src/api/live.js`

```js
// Teacher
getLiveSessions(params)          // GET /live/sessions/?group=&student=&status=
createLiveSession(data)          // POST /live/sessions/
updateLiveSession(id, data)      // PATCH /live/sessions/<id>/
deleteLiveSession(id)            // DELETE /live/sessions/<id>/
startLiveSession(id)             // POST /live/sessions/<id>/start/
endLiveSession(id)               // POST /live/sessions/<id>/end/

// Student
getSessionsForGroup(groupId)     // GET /live/groups/<uuid>/sessions/
getSessionsForStudent(studentId) // GET /live/students/<id>/sessions/
```

---

## 4. Teacher UI Changes

### 4a. New route + page: `/teacher/live/:sessionId`
**New file:** `frontend/src/pages/teacher/TeacherLiveSession.jsx`
- Full-screen, no Layout sidebar (same pattern as `LessonEditor.jsx`)
- On mount: calls `startLiveSession(sessionId)` if status is `scheduled`
- Renders `<JitsiMeeting domain="meet.jit.si" roomName={session.room_name} ...>`
- Top bar: session title, "End Session" button
- `onReadyToClose` → calls `endLiveSession()` → navigate back to subject group detail

### 4b. "Live" tab in `SubjectGroupDetail.jsx`
**Modify:** `frontend/src/pages/teacher/SubjectGroupDetail.jsx`
- Add a third "Live" tab alongside the existing Lessons and Files tabs
- Tab shows: list of sessions (scheduled + ended), "Schedule Session" button (opens modal), "Start Immediately" button
- Schedule modal: title, session type (Group / 1-on-1), if 1-on-1 → student picker, optional scheduled_at datetime picker
- Active session shows "Rejoin" button
- Scheduled future sessions show "Start Now" + "Edit" + "Delete" buttons

### 4c. TeacherDashboard upcoming sessions
**Modify:** `frontend/src/pages/teacher/TeacherDashboard.jsx`
- Add a small "Upcoming Sessions" section using `getLiveSessions({status:'scheduled'})`
- Each row shows: title, type, subject group, scheduled time, "Start" button → navigates to `/teacher/live/:sessionId`

---

## 5. Student UI Changes

### 5a. New route + page: `/student/live/:groupId`
**New file:** `frontend/src/pages/student/StudentLiveCall.jsx`
- Follows Kiddo theme (`kiddo-theme.css`, `kiddo-wrap` container)
- Reads `lms_student` from localStorage (no useAuth — same as all other student pages)
- On mount: calls `getSessionsForGroup(groupId)` (filters active sessions)
- If active session exists → renders `<JitsiMeeting>` with `displayName=student.name`
- If only scheduled sessions → shows countdown/scheduled time card: "Your class starts at [time]"
- If no session → friendly "No live class right now!" message with back button
- `onReadyToClose` → navigate back to `/student/content`

### 5b. "Join Live" button in `StudentPortalContent.jsx`
**Modify:** `frontend/src/pages/student/StudentPortalContent.jsx`
- Per subject group card: add "Join Live Class" button
- Navigates to `/student/live/<groupId>`

---

## 6. Routing Changes — `App.jsx`
**Modify:** `frontend/src/App.jsx`

Add two routes:
```jsx
<Route path="/teacher/live/:sessionId" element={
  <ProtectedRoute requireRole="teacher"><TeacherLiveSession /></ProtectedRoute>
} />
<Route path="/student/live/:groupId" element={<StudentLiveCall />} />
```

---

## 7. Critical Files to Create/Modify

### New files
| File | Purpose |
|---|---|
| `live/__init__.py` | Package marker |
| `live/models.py` | `LiveSession` model |
| `live/serializers.py` | Create/read/update serializers |
| `live/views.py` | 6 API views |
| `live/urls.py` | URL patterns |
| `live/permissions.py` | `IsTeacherOwner` |
| `live/admin.py` | Register model |
| `frontend/src/api/live.js` | API helper functions |
| `frontend/src/pages/teacher/TeacherLiveSession.jsx` | Full-screen teacher call page |
| `frontend/src/pages/student/StudentLiveCall.jsx` | Kiddo-themed student call page |

### Existing files to modify
| File | Change |
|---|---|
| `LMS/settings.py` | Add `'live'` to INSTALLED_APPS, add `JITSI_DOMAIN` |
| `LMS/urls.py` | Mount `live.urls` at `api/live/` |
| `frontend/src/App.jsx` | Add 2 new routes |
| `frontend/src/pages/teacher/SubjectGroupDetail.jsx` | Add "Live" tab with session management |
| `frontend/src/pages/teacher/TeacherDashboard.jsx` | Add "Upcoming Sessions" widget |
| `frontend/src/pages/student/StudentPortalContent.jsx` | Add "Join Live Class" button per group |

---

## 8. Verification Steps

1. **Backend:** `python manage.py makemigrations live && python manage.py migrate` — no errors
2. **API smoke test:** POST `/api/live/sessions/` as teacher → creates session with UUID room_name; PATCH status to active; GET from student endpoint → returns same session
3. **Teacher flow:** Login as teacher → go to Subject Group Detail → Live tab → Schedule a session → click Start → Jitsi call opens in full screen
4. **Student flow:** Login as student → StudentPortalContent → click "Join Live Class" → sees the call or scheduled message
5. **1-on-1 flow:** Teacher schedules private session selecting a specific student → student sees it via `/api/live/students/<id>/sessions/`
6. **End session:** Teacher clicks "End Session" → status=ended → student page shows "No live class right now"
