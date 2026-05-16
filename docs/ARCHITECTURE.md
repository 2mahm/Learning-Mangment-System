# Architecture

## Overview

LACM is a **Learning and Content Management** platform built as a full-stack web application with a decoupled frontend and backend. It supports multiple roles, invitation-based user onboarding, hierarchical content creation, and multi-center isolation.

---

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Backend framework | Django | 6.0.4 |
| REST API | Django REST Framework | 3.17.1 |
| Database | PostgreSQL (prod) / SQLite (dev) | — |
| DB driver | psycopg2-binary | 2.9.10 |
| Frontend framework | React | 19.2.4 |
| Frontend build tool | Vite | 8.0.4 |
| Routing | React Router DOM | 7.14.1 |
| HTTP client | Axios | 1.15.0 |
| Rich text editor | Tiptap | 3.22.3 |
| Exercise player (student) | SurveyJS Form Library | 2.5.20 |
| Exercise builder (teacher) | Custom React UI | — |
| Containerization | Docker + Docker Compose | — |

---

## High-Level Architecture

```
┌────────────────────────────────────────────────────────┐
│                     Browser Client                      │
│              React 19 + Vite (port 3000)                │
└──────────────────────┬─────────────────────────────────┘
                       │ HTTP/REST (JSON)
                       │
┌──────────────────────▼─────────────────────────────────┐
│               Django REST Framework                      │
│                  (port 8000)                             │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  accounts   │  │   content   │  │  LMS (config)   │ │
│  │     app     │  │     app     │  │  settings / urls│ │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────┘ │
│         │                │                               │
│         └────────────────┘                               │
│                    │                                     │
│             ORM (Django)                                 │
└──────────────────────┬─────────────────────────────────┘
                       │
┌──────────────────────▼─────────────────────────────────┐
│            PostgreSQL / SQLite Database                  │
└────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
lacm-v1.2/
├── LMS/                  # Django project configuration
│   ├── settings.py       # Environment-aware configuration
│   ├── urls.py           # Root URL dispatcher
│   ├── wsgi.py           # WSGI entry point (production)
│   └── asgi.py           # ASGI entry point (async)
│
├── accounts/             # User management app
│   ├── models.py         # User, Center, Invitation, Registration, Student models
│   ├── views.py          # Auth, registration, user CRUD, student endpoints
│   ├── serializers.py    # DRF serializers
│   ├── urls.py           # URL patterns for /api/
│   ├── permissions.py    # Custom DRF permission classes
│   └── authentication.py # StudentTokenAuthentication backend
│
├── content/              # Course content app
│   ├── models.py         # SubjectGroup, Lesson, LessonSection, BookFile models
│   ├── views.py          # Content CRUD endpoints
│   ├── serializers.py    # Content serializers
│   ├── urls.py           # URL patterns for /api/content/
│   └── permissions.py    # Content-specific permission checks
│
├── frontend/             # React application
│   ├── src/              # React components and pages
│   ├── vite.config.js    # Vite dev server and build config
│   ├── package.json      # Node.js dependencies
│   └── Dockerfile        # Frontend container
│
├── media/                # User-uploaded files (served by Django in dev)
├── manage.py             # Django CLI
├── req.txt               # Python dependencies
├── Dockerfile            # Backend container
├── docker-compose.yml    # Multi-container orchestration
└── entrypoint.sh         # Container startup script
```

---

## Django Apps

### `accounts` App

Handles all user-related functionality:

- **Custom user model** (`CustomUser`) with roles: `admin`, `center_admin`, `teacher`, `parent`
- **Invitation-based registration** — admins generate tokens, users register via token links
- **Approval workflow** — registration requests go through an admin approval step before accounts are created
- **Student management** — parents submit student requests; admins approve and generate student credentials
- **Permission-Based Access Control (PBAC)** — fine-grained permissions assigned per user, checked via Django's `has_perm()` system

### `content` App

Handles all course content:

- **SubjectGroups** — teacher-owned courses with a subject track and center assignments
- **Lessons** — ordered within a subject group, with publish/draft status
- **LessonSections** — hierarchical (tree) sections supporting three content types: `title`, `content` (Tiptap rich text), and `exercise` (SurveyJS JSON)
- **BookFiles** — file attachments (PDFs, docs, images, audio) for a subject group
- **Media upload** — standalone image upload for use inside rich-text content

---

## Authentication Architecture

Two separate token types exist to isolate student access from staff access:

```
┌──────────────────────────────────────────────────┐
│              Authentication Backends              │
│                                                   │
│  1. StudentTokenAuthentication (custom)           │
│     Header: Authorization: StudentToken <hex>     │
│     → Resolves to student's parent CustomUser     │
│     → Limited permission set                      │
│                                                   │
│  2. TokenAuthentication (DRF built-in)            │
│     Header: Authorization: Token <drf-token>      │
│     → Resolves to CustomUser directly             │
│     → Full permission checking via PBAC           │
│                                                   │
│  3. SessionAuthentication (DRF built-in)          │
│     → Cookie-based, for Django admin              │
└──────────────────────────────────────────────────┘
```

---

## Permission System (PBAC)

Permissions are Django's built-in `auth.Permission` objects assigned to users (not roles). Each view declares which codenames are required. Staff users (`is_staff=True`) bypass all permission checks.

```
User
 └── permissions (M2M to auth.Permission)
       └── codename: "can_manage_content", "can_view_users", etc.

View
 └── get_permissions() → [HasPermission("can_manage_content")]
       └── permission.has_permission(request) → request.user.has_perm(codename)
```

Default permission sets by role (applied at account approval time):

| Role | Default Permissions |
|---|---|
| `parent` | `can_login`, `can_view_students`, `can_add_student`, `can_view_content` |
| `teacher` | `can_login`, `can_manage_content`, `can_view_content` |
| `center_admin` | All parent + teacher permissions + full admin set |

---

## Content Architecture

LessonSections use a **self-referential tree structure**:

```
Lesson
 └── LessonSection (depth=0, parent=null)       ← top-level
       └── LessonSection (depth=1, parent=...)  ← child
             └── LessonSection (depth=2, ...)   ← grandchild
```

Content types per section:
- `title` — heading/divider, no body
- `content` — Tiptap-compatible rich text JSON stored in `content_body`
- `exercise` — custom exercise JSON stored in `content_body` (see [EXERCISE_SYSTEM.md](EXERCISE_SYSTEM.md))

Ordering uses an explicit integer `sort_order` field. Reorder endpoints accept an ordered list of UUIDs and update `sort_order` in bulk.

---

## Multi-Center Isolation

Centers represent physical learning institutions. Isolation is applied at two levels:

1. **Teacher-to-Center assignment** — teachers are linked to centers via `TeacherProfile.centers` (M2M). They can only manage content visible to their assigned centers.
2. **SubjectGroup-to-Center assignment** — each subject group is explicitly assigned to one or more centers via `SubjectGroup.centers` (M2M). Published content is filtered by center.

---

## Data Flow: Registration

```
Admin creates Invitation (role, optional email, expiry)
       ↓
System generates UUID token
       ↓
Admin shares token link with user
       ↓
User visits /register?token=<uuid>  → validates token
       ↓
User submits registration form      → creates RegistrationRequest (pending)
       ↓
Admin reviews requests              → approve or reject
       ↓
On approval → CustomUser created, DRF token generated, permissions assigned
```

---

## Data Flow: Content Publishing

```
Teacher creates SubjectGroup (draft)
       ↓
Teacher creates Lessons inside it
       ↓
Teacher adds LessonSections (title / content / exercise)
       ↓
Teacher marks Lesson as published=True
       ↓
Students/Parents authenticated with can_view_content
can access /api/content/published/* endpoints
```

---

## Docker Architecture

```
docker-compose.yml
 ├── db           → PostgreSQL 14  (port 5432)
 ├── backend      → Django / DRF   (port 8000)  depends on db
 └── frontend     → React / Vite   (port 3000)  depends on backend
```

The `entrypoint.sh` script in the backend container runs `migrate` and starts the development server automatically on container boot.

---

## API Design Principles

- **APIView-based** — explicit, method-level control over each endpoint; no ViewSets
- **Separate serializers for read and write** — list serializers are minimal; detail serializers nest related data; write serializers focus on validation
- **UUID primary keys** on all content models to avoid enumeration attacks
- **Soft deletes** on `SubjectGroup` and `LessonSection` (`active=False`) to preserve referential integrity
- **Hard deletes** on `Lesson` (cascades sections) — intentional, content is owned by teacher
