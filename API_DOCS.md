# LMS API Documentation

Base URL: `http://localhost:8000`

---

## Authentication

All protected endpoints require a token in the `Authorization` header:

```
Authorization: Token <your_token>
```

Obtain a token by calling the login endpoint below.

---

## Table of Contents

1. [Login](#1-login)
2. [Invitations](#2-invitations)
   - [Create Invitation](#21-create-invitation)
   - [List Invitations](#22-list-invitations)
3. [Registration](#3-registration)
   - [Validate Token](#31-validate-token)
   - [Submit Registration Form](#32-submit-registration-form)
4. [Registration Requests](#4-registration-requests)
   - [List Requests](#41-list-registration-requests)
   - [Approve Request](#42-approve-registration-request)
   - [Reject Request](#43-reject-registration-request)
5. [Students](#5-students)
   - [List Students](#51-list-students)
   - [Create Student](#52-create-student)

---

## 1. Login

Authenticate and receive an API token.

```
POST /api/auth/login/
```

**Auth required:** No

**Request Body**

```json
{
  "username": "admin@example.com",
  "password": "yourpassword"
}
```

> `username` is the user's email address.

**Response `200 OK`**

```json
{
  "token": "9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b"
}
```

**Error Responses**

| Status | Body |
|--------|------|
| `400 Bad Request` | `{"non_field_errors": ["Unable to log in with provided credentials."]}` |

---

## 2. Invitations

### 2.1 Create Invitation

Create a new invitation link for a teacher, parent, or center admin.

```
POST /api/invitations/
```

**Auth required:** Yes — `can_create_invitation` permission

**Request Body**

```json
{
  "role": "teacher",
  "center": 1,
  "expires_at": "2026-05-01T00:00:00Z",
  "email": "john@example.com",
  "permission_ids": [1, 2, 3]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `role` | string | Yes | `"teacher"`, `"parent"`, or `"center_admin"` |
| `center` | integer | Yes | Center ID the invitation belongs to |
| `expires_at` | datetime (ISO 8601) | Yes | When the invitation expires |
| `email` | string | No | Restrict the invitation to one specific email address. If set, an invite email is sent automatically. |
| `permission_ids` | array of integers | No | Pre-assign permissions for `center_admin` role only |

**Response `201 Created`**

```json
{
  "id": 1,
  "email": "john@example.com",
  "role": "teacher",
  "token": "550e8400-e29b-41d4-a716-446655440000",
  "expires_at": "2026-05-01T00:00:00Z",
  "invite_link": "https://bit.ly/3xYzAbc"
}
```

| Field | Description |
|-------|-------------|
| `invite_link` | Bitly-shortened registration URL. Falls back to `{SITE_BASE_URL}/register?token={uuid}` if Bitly is unavailable. |

> If `email` is provided, an invitation email is automatically sent to that address containing the `invite_link`.

**Error Responses**

| Status | Body |
|--------|------|
| `400 Bad Request` | `{"role": ["\"student\" is not a valid choice."]}` |
| `401 Unauthorized` | `{"detail": "Authentication credentials were not provided."}` |
| `403 Forbidden` | `{"detail": "You do not have permission to perform this action."}` |

---

### 2.2 List Invitations

Retrieve all invitations.

```
GET /api/invitations/
```

**Auth required:** Yes — Admin

**Response `200 OK`**

```json
[
  {
    "id": 1,
    "email": "john@example.com",
    "role": "teacher",
    "token": "550e8400-e29b-41d4-a716-446655440000",
    "is_used": false,
    "expires_at": "2026-05-01T00:00:00Z",
    "created_by_email": "admin@example.com"
  }
]
```

---

## 3. Registration

### 3.1 Validate Token

Check whether an invitation token is valid before showing the registration form.

```
GET /api/register/?token=<uuid>
```

**Auth required:** No

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | UUID | Yes | The invitation token from the invitation link |

**Response `200 OK`**

```json
{
  "role": "teacher",
  "restricted_email": "john@example.com",
  "expires_at": "2026-05-01T00:00:00Z"
}
```

> `restricted_email` is `null` if the invitation has no email restriction.

**Error Responses**

| Status | Body |
|--------|------|
| `400 Bad Request` | `{"error": "token query parameter is required."}` |
| `400 Bad Request` | `{"error": "Invitation is expired or already used."}` |
| `404 Not Found` | `{"error": "Invalid token."}` |

---

### 3.2 Submit Registration Form

Submit a registration form linked to an invitation. Creates a **pending** `RegistrationRequest` — no user account is created yet.

```
POST /api/register/
```

**Auth required:** No

**Request Body**

```json
{
  "token": "550e8400-e29b-41d4-a716-446655440000",
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword123",
  "confirm_password": "securepassword123"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | UUID | Yes | The invitation token |
| `name` | string | Yes | Full name of the registrant |
| `email` | string | Yes | Must match restricted email if one was set on the invitation |
| `password` | string | Yes | Minimum 8 characters |
| `confirm_password` | string | Yes | Must match `password` |

**Response `201 Created`**

```json
{
  "message": "Registration request submitted successfully. Please wait for admin approval.",
  "request_id": 3
}
```

**Error Responses**

| Status | Body |
|--------|------|
| `400 Bad Request` | `{"confirm_password": ["Passwords do not match."]}` |
| `400 Bad Request` | `{"token": ["Invalid invitation token."]}` |
| `400 Bad Request` | `{"token": ["Invitation is expired or already used."]}` |
| `400 Bad Request` | `{"email": ["This invitation is restricted to a specific email address."]}` |
| `400 Bad Request` | `{"email": ["A user with this email already exists."]}` |
| `400 Bad Request` | `{"email": ["A pending registration request with this email already exists."]}` |

---

## 4. Registration Requests

### 4.1 List Registration Requests

Retrieve registration requests filtered by status.

```
GET /api/registration-requests/?status=pending
```

**Auth required:** Yes — Admin

**Query Parameters**

| Parameter | Type | Default | Options |
|-----------|------|---------|---------|
| `status` | string | `pending` | `pending`, `approved`, `rejected` |

**Response `200 OK`**

```json
[
  {
    "id": 3,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "teacher",
    "status": "pending",
    "created_at": "2026-04-15T10:30:00Z",
    "invitation_token": "550e8400-e29b-41d4-a716-446655440000"
  }
]
```

---

### 4.2 Approve Registration Request

Approve a pending request. This will:
- Create a `User` account (active)
- Create `TeacherProfile` or `ParentProfile`
- Mark the invitation as used

```
POST /api/registration-requests/<id>/approve/
```

**Auth required:** Yes — Admin

**Request Body**

None — no body required.

**Response `200 OK`**

```json
{
  "message": "User john@example.com approved and created successfully."
}
```

**Error Responses**

| Status | Body |
|--------|------|
| `400 Bad Request` | `{"error": "A user with this email already exists."}` |
| `404 Not Found` | `{"error": "Pending registration request not found."}` |

---

### 4.3 Reject Registration Request

Reject a pending request. The record is kept for audit purposes; no user is created.

```
POST /api/registration-requests/<id>/reject/
```

**Auth required:** Yes — Admin

**Request Body**

None — no body required.

**Response `200 OK`**

```json
{
  "message": "Registration request rejected."
}
```

**Error Responses**

| Status | Body |
|--------|------|
| `404 Not Found` | `{"error": "Pending registration request not found."}` |

---

## 5. Students

### 5.1 List Students

Retrieve all students belonging to the authenticated parent.

```
GET /api/students/
```

**Auth required:** Yes — Parent (`role = "parent"`)

**Response `200 OK`**

```json
[
  {
    "id": 1,
    "name": "Sara Doe",
    "grade": "Grade 3"
  },
  {
    "id": 2,
    "name": "Ali Doe",
    "grade": "Grade 5"
  }
]
```

**Error Responses**

| Status | Body |
|--------|------|
| `403 Forbidden` | `{"error": "Only parents can access this endpoint."}` |
| `404 Not Found` | `{"error": "Parent profile not found."}` |

---

### 5.2 Create Student

Add a new student under the authenticated parent's profile.

```
POST /api/students/
```

**Auth required:** Yes — Parent (`role = "parent"`)

**Request Body**

```json
{
  "name": "Sara Doe",
  "grade": "Grade 3"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Student's full name |
| `grade` | string | Yes | e.g. `"Grade 3"`, `"Year 7"` |

**Response `201 Created`**

```json
{
  "id": 1,
  "name": "Sara Doe",
  "grade": "Grade 3"
}
```

**Error Responses**

| Status | Body |
|--------|------|
| `400 Bad Request` | `{"name": ["This field is required."]}` |
| `403 Forbidden` | `{"error": "Only parents can create students."}` |
| `404 Not Found` | `{"error": "Parent profile not found."}` |

---

## Full Registration Flow

```
1.  Admin  →  POST /api/auth/login/
                  ← token

2.  Admin  →  POST /api/invitations/          { role, center, expires_at, email? }
                  ← invite_link (Bitly short URL or full URL fallback)
                  → if email provided: invitation email auto-sent to invitee

3.  Admin copies invite_link from response and shares it manually (if no email)

4.  User   →  GET  /api/register/?token=<uuid>
                  ← role, restricted_email, expires_at, center_id, center_name

5.  User   →  POST /api/register/             { token, name, email, password, confirm_password }
                  ← request_id (status = pending)

6.  Admin  →  GET  /api/registration-requests/
                  ← list of pending requests

7.  Admin  →  POST /api/registration-requests/<id>/approve/
                  ← User + Profile created, invitation marked used
                  → approval email auto-sent to new user

    OR

7.  Admin  →  POST /api/registration-requests/<id>/reject/
                  ← request marked rejected (no user created)

8.  User   →  POST /api/auth/login/           { username: email, password }
                  ← token

9.  Parent →  POST /api/student-requests/     { name, grade }
                  ← student request submitted (status = pending)
                  → confirmation email auto-sent to parent

10. Admin  →  POST /api/student-requests/<id>/approve/  { username, password }
                  ← student account created
                  → credentials email auto-sent to parent
```
