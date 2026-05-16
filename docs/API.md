# API Documentation

## Base URL

```
http://localhost:8000/api/
```

---

## Authentication

The API supports three authentication methods:

### 1. Token Authentication (Staff / Teachers / Parents / Center Admins)

Include the token in the `Authorization` header:

```
Authorization: Token <token>
```

Obtain a token via the login endpoint:

```http
POST /api/auth/login/
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "yourpassword"
}
```

**Response:**
```json
{
  "token": "9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b"
}
```

---

### 2. Student Token Authentication

Students use a separate token type:

```
Authorization: StudentToken <hex-token>
```

Obtain via the student login endpoint:

```http
POST /api/student-login/
Content-Type: application/json

{
  "username": "student_username",
  "password": "studentpassword"
}
```

---

### 3. Session Authentication

Used by the Django admin interface (`/admin/`).

---

## Accounts Endpoints

### Authentication

#### `POST /api/auth/login/`
Authenticate with email and password.

**Request:**
```json
{ "email": "user@example.com", "password": "password" }
```

**Response:**
```json
{ "token": "<auth_token>" }
```

---

#### `POST /api/student-login/`
Authenticate as a student using username and password.

**Request:**
```json
{ "username": "student_user", "password": "password" }
```

**Response:**
```json
{
  "token": "<student_hex_token>",
  "student": { "id": 1, "name": "Student Name", "grade": "5" }
}
```

---

### Current User

#### `GET /api/me/`
Returns the authenticated user's profile and permissions.

**Auth required:** Yes

**Response:**
```json
{
  "id": 1,
  "name": "User Name",
  "email": "user@example.com",
  "role": "teacher",
  "permissions": ["can_login", "can_manage_content", "can_view_content"]
}
```

---

### Centers

#### `GET /api/centers/`
List all active centers. Public — used for dropdowns in registration forms.

**Response:**
```json
[
  { "id": 1, "name": "Cairo Center", "city": "Cairo", "state": "", "country": "Egypt" }
]
```

---

#### `POST /api/centers/`
Create a new center.

**Auth required:** Yes (staff only)

**Request:**
```json
{ "name": "New Center", "city": "Alexandria", "state": "", "country": "Egypt" }
```

---

#### `GET /api/centers/<id>/`
Get center details.

**Auth required:** Yes (staff only)

---

#### `PATCH /api/centers/<id>/`
Update center information.

**Auth required:** Yes (staff only)

---

#### `DELETE /api/centers/<id>/`
Soft-delete (deactivate) a center.

**Auth required:** Yes (staff only)

---

### Invitations

#### `GET /api/invitations/`
List all invitations.

**Auth required:** Yes (`can_view_invitations`)

---

#### `POST /api/invitations/`
Create an invitation for a teacher, parent, or center admin. Generates a unique token link.

**Auth required:** Yes (`can_create_invitation`)

**Request:**
```json
{
  "role": "teacher",
  "email": "optional@restriction.com",
  "center": 1,
  "expires_at": "2026-06-01T00:00:00Z"
}
```

**Response:**
```json
{
  "id": 1,
  "token": "a1b2c3d4-...",
  "role": "teacher",
  "email": null,
  "expires_at": "2026-06-01T00:00:00Z",
  "is_used": false
}
```

---

### Registration

#### `GET /api/register/?token=<uuid>`
Validate an invitation token before showing the registration form.

**Auth required:** No

**Response:**
```json
{
  "role": "teacher",
  "restricted_email": null,
  "expires_at": "2026-06-01T00:00:00Z"
}
```

**Errors:**
- `404` — Token not found
- `400` — Token already used or expired

---

#### `POST /api/register/`
Submit a registration form using an invitation token. Creates a pending `RegistrationRequest`.

**Auth required:** No

**Request:**
```json
{
  "token": "a1b2c3d4-...",
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword"
}
```

---

### Registration Requests

#### `GET /api/registration-requests/`
List registration requests. Filterable by status.

**Auth required:** Yes (`can_view_requests`)

**Query params:** `?status=pending|approved|rejected`

---

#### `POST /api/registration-requests/<id>/approve/`
Approve a registration request. Creates the user account.

**Auth required:** Yes (`can_approve_request`)

---

#### `POST /api/registration-requests/<id>/reject/`
Reject a registration request.

**Auth required:** Yes (`can_reject_request`)

---

### User Management

#### `GET /api/users/`
List all users.

**Auth required:** Yes (`can_view_users`)

---

#### `GET /api/users/<id>/`
Get user details.

**Auth required:** Yes (`can_view_users`)

---

#### `PATCH /api/users/<id>/`
Update user information.

**Auth required:** Yes (`can_edit_user`)

---

#### `DELETE /api/users/<id>/`
Delete a user.

**Auth required:** Yes (`can_delete_user`)

---

#### `PUT /api/users/<id>/permissions/`
Set a user's permission codenames.

**Auth required:** Yes (`can_manage_permissions`)

**Request:**
```json
{
  "permissions": ["can_login", "can_view_students", "can_add_student"]
}
```

---

#### `GET /api/users/<id>/centers/`
Get the list of centers assigned to a teacher.

**Auth required:** Yes (`can_view_users`)

---

#### `PUT /api/users/<id>/centers/`
Update a teacher's assigned centers.

**Auth required:** Yes (`can_edit_user`)

**Request:**
```json
{ "centers": [1, 2, 3] }
```

---

### Permissions

#### `GET /api/permissions/`
List all available permission codenames in the accounts app.

**Auth required:** Yes (`can_manage_permissions`)

---

### Students

#### `GET /api/students/`
Parents list their approved students.

**Auth required:** Yes (`can_view_students`)

---

### Student Add Requests

#### `GET /api/student-requests/`
Parents see their own requests. Admins see all pending requests.

**Auth required:** Yes

---

#### `POST /api/student-requests/`
A parent submits a request to add a student.

**Auth required:** Yes (`can_add_student`)

**Request:**
```json
{ "name": "Child Name", "grade": "3" }
```

---

#### `POST /api/student-requests/<id>/approve/`
Approve a student request. Generates login credentials.

**Auth required:** Yes (`can_approve_student_request`)

---

#### `POST /api/student-requests/<id>/reject/`
Reject a student add request.

**Auth required:** Yes (`can_reject_student_request`)

---

## Content Endpoints

All content endpoints are prefixed with `/api/content/`.

### Subject Groups

#### `GET /api/content/subject-groups/`
List the authenticated teacher's active subject groups.

**Auth required:** Yes (`can_manage_content`)

---

#### `POST /api/content/subject-groups/`
Create a new subject group.

**Auth required:** Yes (`can_manage_content`)

**Request:**
```json
{
  "title": "Arabic Level 1",
  "description": "Beginner Arabic course",
  "subject_track": "arabic",
  "centers": [1, 2]
}
```

---

#### `GET /api/content/subject-groups/<uuid>/`
Get subject group details.

**Auth required:** Yes (`can_manage_content`)

---

#### `PATCH /api/content/subject-groups/<uuid>/`
Update a subject group.

**Auth required:** Yes (`can_manage_content`)

---

#### `DELETE /api/content/subject-groups/<uuid>/`
Soft-delete a subject group (sets `active=False`).

**Auth required:** Yes (`can_manage_content`)

---

### Lessons

#### `GET /api/content/subject-groups/<uuid>/lessons/`
List lessons within a subject group, ordered by `sort_order`.

**Auth required:** Yes (`can_manage_content`)

---

#### `POST /api/content/subject-groups/<uuid>/lessons/`
Create a lesson in a subject group.

**Auth required:** Yes (`can_manage_content`)

**Request:**
```json
{
  "title": "Lesson 1: Introduction",
  "description": "Overview of the course"
}
```

---

#### `POST /api/content/subject-groups/<uuid>/lessons/reorder/`
Reorder lessons within a subject group.

**Auth required:** Yes (`can_manage_content`)

**Request:**
```json
{ "order": ["uuid-1", "uuid-2", "uuid-3"] }
```

---

#### `GET /api/content/lessons/<uuid>/`
Get a lesson with its full nested section tree.

**Auth required:** Yes

---

#### `PATCH /api/content/lessons/<uuid>/`
Update lesson metadata (title, description, published status).

**Auth required:** Yes (`can_manage_content`)

---

#### `DELETE /api/content/lessons/<uuid>/`
Delete a lesson and all its sections (hard delete).

**Auth required:** Yes (`can_manage_content`)

---

### Lesson Sections

#### `GET /api/content/lessons/<uuid>/sections/`
List top-level sections of a lesson.

**Auth required:** Yes

---

#### `POST /api/content/lessons/<uuid>/sections/`
Create a section (top-level or child of another section).

**Auth required:** Yes (`can_manage_content`)

**Request:**
```json
{
  "title": "Section Title",
  "type": "content",
  "parent": null,
  "content_body": { "type": "doc", "content": [] }
}
```

**Section types:** `title`, `content`, `exercise`

---

#### `POST /api/content/lessons/<uuid>/sections/reorder/`
Reorder top-level sections in a lesson.

**Auth required:** Yes (`can_manage_content`)

**Request:**
```json
{ "order": ["uuid-1", "uuid-2"] }
```

---

#### `PATCH /api/content/sections/<uuid>/`
Update a section's title, type, or content body.

**Auth required:** Yes (`can_manage_content`)

---

#### `DELETE /api/content/sections/<uuid>/`
Soft-delete a section and all its children (`active=False`).

**Auth required:** Yes (`can_manage_content`)

---

#### `POST /api/content/sections/<uuid>/children/reorder/`
Reorder children within a section.

**Auth required:** Yes (`can_manage_content`)

---

### Book Files

#### `GET /api/content/subject-groups/<uuid>/files/`
List files attached to a subject group.

**Auth required:** Yes

---

#### `POST /api/content/subject-groups/<uuid>/files/`
Upload a file to a subject group. Use `multipart/form-data`.

**Auth required:** Yes (`can_manage_content`)

**Fields:** `title`, `file`, `file_type` (`pdf`, `doc`, `image`, `audio`, `other`)

---

#### `GET /api/content/files/<uuid>/`
Get file metadata and download URL.

**Auth required:** Yes

---

#### `PATCH /api/content/files/<uuid>/`
Update file metadata (title, sort_order).

**Auth required:** Yes (`can_manage_content`)

---

#### `DELETE /api/content/files/<uuid>/`
Delete a file and remove it from storage.

**Auth required:** Yes (`can_manage_content`)

---

### Media Upload

#### `POST /api/content/media/`
Upload an image for use in a rich-text (Tiptap) content section.

**Auth required:** Yes (`can_manage_content`)

**Request:** `multipart/form-data` with `file` field.

**Response:**
```json
{ "url": "http://localhost:8000/media/uploads/image.png" }
```

---

### Published Content (Read-only)

These endpoints are accessible to students and parents.

#### `GET /api/content/published/subject-groups/`
List published subject groups visible to the authenticated user.

**Auth required:** Yes (`can_view_content`)

---

#### `GET /api/content/published/subject-groups/<uuid>/lessons/`
List published lessons in a subject group.

**Auth required:** Yes (`can_view_content`)

---

#### `GET /api/content/published/lessons/<uuid>/`
Get a published lesson with its full section tree.

**Auth required:** Yes (`can_view_content`)

---

## Permission Codenames

| Codename | Description |
|---|---|
| `can_login` | User can authenticate |
| `can_view_invitations` | View invitation list |
| `can_create_invitation` | Create new invitations |
| `can_view_requests` | View registration requests |
| `can_approve_request` | Approve registration requests |
| `can_reject_request` | Reject registration requests |
| `can_view_users` | View user list and details |
| `can_edit_user` | Edit user data |
| `can_delete_user` | Delete users |
| `can_manage_permissions` | View and set user permissions |
| `can_view_students` | View student list |
| `can_add_student` | Submit student add request |
| `can_view_student_requests` | View student requests (admin) |
| `can_approve_student_request` | Approve student requests |
| `can_reject_student_request` | Reject student requests |
| `can_manage_content` | Full content CRUD access |
| `can_view_content` | Read-only content access |

---

## Error Responses

All errors follow Django REST Framework's standard format:

```json
{ "detail": "Authentication credentials were not provided." }
```

| HTTP Code | Meaning |
|---|---|
| `400` | Bad request / validation error |
| `401` | Unauthenticated |
| `403` | Forbidden (missing permission) |
| `404` | Resource not found |
| `500` | Internal server error |
