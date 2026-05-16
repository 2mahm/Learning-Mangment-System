# Database Documentation

## Overview

LACM uses **PostgreSQL** in production and **SQLite** in local development. The database is managed through Django's ORM and migration system.

- **ORM:** Django ORM
- **Migration tool:** `python manage.py migrate`
- **Production DB:** PostgreSQL 14
- **Development DB:** SQLite (`db.sqlite3`)

---

## Schema Diagram

```
Center
 ├── CustomUser (center FK, nullable)
 ├── TeacherProfile.centers (M2M)
 ├── Invitation (center FK, nullable)
 └── SubjectGroup.centers (M2M)

CustomUser
 ├── TeacherProfile (OneToOne)
 ├── ParentProfile (OneToOne)
 ├── Invitation.created_by (FK)
 ├── RegistrationRequest (via Invitation)
 ├── SubjectGroup.teacher (FK)
 └── Lesson.teacher (FK)

ParentProfile
 ├── StudentRequest (FK)
 └── Student (FK)

SubjectGroup
 ├── Lesson (FK)
 └── BookFile (FK)

Lesson
 └── LessonSection (FK)

LessonSection
 └── LessonSection (self-referential parent FK)
```

---

## Tables

### `accounts_center`

Represents a physical learning center or institution.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | Integer | PK, auto-increment | — |
| `name` | VARCHAR | NOT NULL, UNIQUE | Center name |
| `city` | VARCHAR | NOT NULL | City |
| `state` | VARCHAR | NOT NULL | State / region |
| `country` | VARCHAR | NOT NULL | Country |
| `is_active` | Boolean | NOT NULL, default=True | Soft-delete flag |
| `created_at` | Timestamp | NOT NULL, auto_now_add | Creation timestamp |

---

### `accounts_customuser`

Custom user model replacing Django's default `auth.User`.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | Integer | PK, auto-increment | — |
| `password` | VARCHAR | NOT NULL | Hashed password |
| `last_login` | Timestamp | NULL | Last login timestamp |
| `is_superuser` | Boolean | NOT NULL | Django superuser flag |
| `name` | VARCHAR | NOT NULL | Full name |
| `email` | EmailField | NOT NULL, UNIQUE | Login identifier |
| `role` | VARCHAR | NOT NULL | `admin`, `center_admin`, `teacher`, `parent` |
| `is_active` | Boolean | NOT NULL, default=False | Account active flag |
| `is_staff` | Boolean | NOT NULL | Django staff/admin flag |
| `center_id` | Integer | FK → `accounts_center`, NULL | Assigned center (parent/center_admin) |

**Note:** `email` is the `USERNAME_FIELD`. Users are inactive (`is_active=False`) until a registration request is approved.

---

### `accounts_invitation`

Invitation tokens used to control who can register.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | Integer | PK, auto-increment | — |
| `email` | EmailField | NULL | Optional — restricts registration to this email |
| `role` | VARCHAR | NOT NULL | Intended role: `teacher`, `parent`, `center_admin` |
| `token` | UUID | NOT NULL, UNIQUE | The registration token |
| `is_used` | Boolean | NOT NULL, default=False | Whether token has been consumed |
| `expires_at` | Timestamp | NOT NULL | Token expiry |
| `center_id` | Integer | FK → `accounts_center`, NULL | Center context for the invite |
| `created_by_id` | Integer | FK → `accounts_customuser` | Admin who created the invitation |

**M2M:**
- `accounts_invitation_permissions` → `auth_permission` — default permissions to assign to the invited user on approval

---

### `accounts_registrationrequest`

Stores submitted registration forms pending admin review.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | Integer | PK, auto-increment | — |
| `name` | VARCHAR | NOT NULL | Applicant name |
| `email` | EmailField | NOT NULL | Applicant email |
| `password` | VARCHAR | NOT NULL | Hashed password (stored until approval) |
| `role` | VARCHAR | NOT NULL | Role from invitation |
| `invitation_id` | Integer | FK → `accounts_invitation` | Source invitation |
| `status` | VARCHAR | NOT NULL, default=`pending` | `pending`, `approved`, `rejected` |
| `created_at` | Timestamp | NOT NULL, auto_now_add | Submission timestamp |

---

### `accounts_teacherprofile`

Extends `CustomUser` with teacher-specific data.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | Integer | PK, auto-increment | — |
| `user_id` | Integer | FK → `accounts_customuser`, UNIQUE | OneToOne with user |
| `subject` | VARCHAR | NULL | Teacher's subject specialty |

**M2M:**
- `accounts_teacherprofile_centers` → `accounts_center` — centers the teacher is assigned to

---

### `accounts_parentprofile`

Extends `CustomUser` for parent users.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | Integer | PK, auto-increment | — |
| `user_id` | Integer | FK → `accounts_customuser`, UNIQUE | OneToOne with user |

---

### `accounts_studentrequest`

A parent's request to enroll a student.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | Integer | PK, auto-increment | — |
| `name` | VARCHAR | NOT NULL | Student name |
| `grade` | VARCHAR | NOT NULL | Student grade |
| `parent_id` | Integer | FK → `accounts_parentprofile` | Requesting parent |
| `status` | VARCHAR | NOT NULL, default=`pending` | `pending`, `approved`, `rejected` |
| `created_at` | Timestamp | NOT NULL, auto_now_add | Submission timestamp |

---

### `accounts_student`

An approved student with portal login credentials.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | Integer | PK, auto-increment | — |
| `name` | VARCHAR | NOT NULL | Student name |
| `grade` | VARCHAR | NOT NULL | Student grade |
| `parent_id` | Integer | FK → `accounts_parentprofile` | Parent/guardian |
| `username` | VARCHAR | UNIQUE, NULL | Auto-generated portal username |
| `password` | VARCHAR | NULL | Hashed portal password |
| `token` | VARCHAR | UNIQUE | Auto-generated hex authentication token |

**Note:** `username` and `password` are set by admin when approving a `StudentRequest`. The `token` is generated automatically and used with `StudentTokenAuthentication`.

---

### `content_subjectgroup`

A teacher's course or book. The top-level content container.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Auto-generated UUID |
| `teacher_id` | Integer | FK → `accounts_customuser` | Owning teacher |
| `subject_track` | VARCHAR | NOT NULL | `arabic`, `quran`, `culture` |
| `title` | VARCHAR | NOT NULL | Group title |
| `description` | TextField | NOT NULL | Description |
| `sort_order` | Integer (unsigned) | NOT NULL, default=0 | Display order |
| `active` | Boolean | NOT NULL, default=True | Soft-delete flag |
| `created_at` | Timestamp | NOT NULL, auto_now_add | Creation timestamp |

**M2M:**
- `content_subjectgroup_centers` → `accounts_center` — centers where this group is visible

---

### `content_lesson`

A single lesson within a subject group.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Auto-generated UUID |
| `subject_group_id` | UUID | FK → `content_subjectgroup` | Parent group |
| `teacher_id` | Integer | FK → `accounts_customuser` | Lesson author |
| `title` | VARCHAR | NOT NULL | Lesson title |
| `description` | TextField | NOT NULL | Lesson description |
| `sort_order` | Integer (unsigned) | NOT NULL, default=0 | Display order within group |
| `published` | Boolean | NOT NULL, default=False | Whether visible to students |
| `created_at` | Timestamp | NOT NULL, auto_now_add | Creation timestamp |
| `updated_at` | Timestamp | NOT NULL, auto_now | Last update timestamp |

---

### `content_lessonsection`

A hierarchical section within a lesson. Supports unlimited nesting depth.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Auto-generated UUID |
| `lesson_id` | UUID | FK → `content_lesson` | Parent lesson |
| `parent_id` | UUID | FK → self (nullable) | Parent section (null = top-level) |
| `sort_order` | Integer (unsigned) | NOT NULL, default=0 | Display order among siblings |
| `depth` | Integer (unsigned) | NOT NULL, default=0 | Nesting depth (0 = top-level) |
| `type` | VARCHAR | NOT NULL | `title`, `content`, `exercise` |
| `title` | VARCHAR | NOT NULL | Section heading |
| `content_body` | JSON | NULL | Rich text (Tiptap) or quiz (SurveyJS) JSON |
| `active` | Boolean | NOT NULL, default=True | Soft-delete flag |

**Content body by type:**
- `title` → `content_body` is NULL
- `content` → Tiptap ProseMirror JSON document
- `exercise` → SurveyJS survey schema JSON

---

### `content_bookfile`

A file attachment for a subject group.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Auto-generated UUID |
| `subject_group_id` | UUID | FK → `content_subjectgroup` | Parent group |
| `title` | VARCHAR | NOT NULL | Display name |
| `file` | FileField | NOT NULL | Stored at `book_files/<group_id>/<filename>` |
| `file_type` | VARCHAR | NOT NULL | `pdf`, `doc`, `image`, `audio`, `other` |
| `sort_order` | Integer (unsigned) | NOT NULL, default=0 | Display order |
| `uploaded_at` | Timestamp | NOT NULL, auto_now_add | Upload timestamp |

---

## Django Auth Tables (built-in)

These standard Django tables are also present:

| Table | Purpose |
|---|---|
| `auth_permission` | All permission definitions |
| `auth_group` | Permission groups (not used by app logic) |
| `auth_group_permissions` | Group-permission M2M |
| `authtoken_token` | DRF auth tokens (one per user) |
| `accounts_customuser_user_permissions` | User-permission M2M (PBAC) |
| `accounts_customuser_groups` | User-group M2M |
| `django_admin_log` | Django admin action log |
| `django_content_type` | Content type registry |
| `django_migrations` | Applied migrations tracker |
| `django_session` | Session storage |

---

## Key Design Decisions

### UUID Primary Keys on Content Models
`SubjectGroup`, `Lesson`, `LessonSection`, and `BookFile` use UUID PKs to prevent URL enumeration (teachers cannot guess other teachers' content IDs).

### Soft Deletes
`SubjectGroup` and `LessonSection` use `active=False` instead of hard deletion. This preserves history and avoids cascading deletes across the content tree. All queries filter `active=True` by default.

### Self-Referential LessonSection
The `parent` FK and `depth` field together form a simple adjacency-list tree. The `depth` field is maintained by the application on write and used to limit nesting depth if needed. Read serializers recursively serialize children.

### Student Token Isolation
Students do not have a `CustomUser` record. Instead, they authenticate via `Student.token` (a hex string). The `StudentTokenAuthentication` backend resolves this token to the student's parent's `CustomUser`, applying only the parent's (limited) permissions.

### Hashed Password in RegistrationRequest
The password is hashed and stored in `RegistrationRequest.password` during the pending period, then moved to `CustomUser.password` on approval. This prevents storing plaintext passwords even temporarily.

---

## Database Configuration

Set via environment variables:

| Variable | Default | Description |
|---|---|---|
| `DB_HOST` | _(empty)_ | If set, uses PostgreSQL; otherwise uses SQLite |
| `DB_NAME` | `lms` | Database name |
| `DB_USER` | `lms` | Database user |
| `DB_PASSWORD` | `lms_secret` | Database password |
| `DB_PORT` | `5432` | PostgreSQL port |

**Django settings logic:**
```python
if os.environ.get('DB_HOST'):
    DATABASES = { 'default': { 'ENGINE': 'django.db.backends.postgresql', ... } }
else:
    DATABASES = { 'default': { 'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'db.sqlite3' } }
```

---

## Migrations

Create migration files after model changes:
```bash
python manage.py makemigrations
```

Apply all pending migrations:
```bash
python manage.py migrate
```

Migrations are stored in:
- `accounts/migrations/`
- `content/migrations/`
