# Changelog

## v1.2.6 — 2026-04-21

### Security / UX

#### Hide Invitation Token from URL
- Invitation tokens are no longer visible in the browser address bar after a user clicks an invitation link
- `frontend/src/pages/InviteRedirect.jsx` — stores the token in `sessionStorage` before navigating to `/register`, so the UUID never appears in the address bar
- `frontend/src/pages/Register.jsx` — reads the token from `sessionStorage` instead of URL query params; if the token arrives via URL (e.g. from an email link that expands to `/register?token=<uuid>`), it is immediately migrated to `sessionStorage` and the query param is stripped using `history.replace`; token is cleared from `sessionStorage` after successful submission
- No backend changes required

---

## v1.2.5 — 2026-04-21

### New Features

#### Delete Invitation
- New `DELETE /api/invitations/<pk>/` endpoint (`InvitationDeleteView` in `accounts/views.py`)
  - Requires `can_create_invitation` permission (same as creating)
  - Center admins can only delete invitations belonging to their own center
  - Returns `204 No Content` on success, `404` if not found, `403` if center mismatch
- Registered new URL pattern `invitations/<int:pk>/` in `accounts/urls.py`
- Added **Delete** button (red, trash icon) to every row in the invitations table in `frontend/src/pages/admin/Invitations.jsx`
  - Shows a confirmation dialog before deleting
  - Removes the row instantly from local state on success — no full list refetch needed
  - Appears for all invitations (used and active)

---

## v1.2.3 — 2026-04-21

### New Features

#### User Profile Page (all roles)
- Added `/profile` route accessible to every authenticated user (admin, center_admin, teacher, parent)
- New `frontend/src/pages/ProfilePage.jsx` — two-panel page with:
  - **Account Information** — edit own name and email address
  - **Change Password** — change password with current-password verification, minimum 8 characters, confirmation check
- Sidebar updated in `Layout.jsx` — "My Profile" link added for all roles above the Sign Out button

#### Self-Service Profile API (`PATCH /api/me/`)
- Extended `MeView` in `accounts/views.py` to handle `PATCH` requests
- Any authenticated user can update their own `name` and/or `email`
- Password change supported in the same request: requires `current_password`, `new_password` (min 8 chars), and `confirm_password`
- All validation errors returned as field-level messages (email uniqueness, wrong current password, password mismatch)
- On success, `refreshUser()` is called on the frontend so the sidebar name updates immediately

#### Parent: Change Student Password
- New `POST /api/students/<pk>/change-password/` endpoint (`StudentPasswordView` in `accounts/views.py`)
  - Verifies the student belongs to the requesting parent before making any changes
  - Accepts `new_password` (min 4 chars) and `confirm_password`
  - Hashes the new password with `make_password` before storing
- Each approved-student card in `frontend/src/pages/parent/Students.jsx` now has a **"Change Password"** toggle button
  - Expands an inline form (new password + confirm) directly inside the card
  - Shows a success message for 2.5 seconds then auto-collapses the form

### Changes
- `accounts/urls.py` — registered `students/<int:pk>/change-password/` URL pattern
- `frontend/src/App.jsx` — added `/profile` route wrapped in `<ProtectedRoute>` (no extra permission required)

---

## v1.2.2 — 2026-04-20

### New Features

#### HTML Email Templates
- Created `accounts/templates/emails/` directory with four fully-styled responsive HTML templates:
  - `invitation.html` — invitation email with registration button, role, center name, and expiry date
  - `registration_approved.html` — account approval notification with role/center info and login button
  - `student_request_received.html` — receipt confirmation to parent showing student name and grade, with "what happens next" guidance
  - `student_approved.html` — credentials delivery to parent with username, password, grade, and student login button
- All templates use inline CSS for maximum email-client compatibility
- Templates are rendered via Django's `render_to_string` through the shared `_send_email` helper in `accounts/utils.py`

#### Email Triggers Wired into API Views (`accounts/views.py`)
| Event | Recipient | Email Sent |
|---|---|---|
| `POST /api/invitations/` | Invited email address | `send_invite_email` — invitation link |
| `POST /api/registration-requests/<id>/approve/` | Newly approved user | `send_registration_approved_email` — approval notice + login link |
| `POST /api/student-requests/` | Parent (submitter) | `send_student_request_received_email` — request receipt |
| `POST /api/student-requests/<id>/approve/` | Parent of approved student | `send_student_approved_email` — student credentials |
- All email calls are wrapped in `try/except` — failures are logged but never break the API response

### Changes
- `accounts/utils.py` — updated `send_invite_email` signature to accept `role`, `center_name`, and `expires_at` for richer template context
- `accounts/views.py` — added `import logging` and `logger = logging.getLogger(__name__)` for email error logging

---

## v1.2.1 — 2026-04-20

### New Features

#### Bitly URL Shortening
- Added `accounts/utils.py` with `shorten_url(long_url)` and `get_invite_link(token)` helpers
- All invitation links are automatically shortened via the Bitly API v4
- Falls back to the full URL silently if `BITLY_TOKEN` is missing or Bitly is unreachable
- Token is read from the `BITLY_TOKEN` environment variable — never hardcoded

#### Email Notifications (Gmail SMTP)
- Added Gmail SMTP configuration to `LMS/settings.py` (`EMAIL_BACKEND`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USE_TLS`, `DEFAULT_FROM_EMAIL`)
- Credentials (`EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`) read from environment variables — never hardcoded
- Added private helpers in `accounts/utils.py`:
  - `_get_login_url()` — builds the login URL from `SITE_BASE_URL`
  - `_send_email(subject, template_name, context, to_email)` — shared DRY helper; renders HTML via `render_to_string`, strips tags for plain-text fallback, sends via `EmailMultiAlternatives` with `fail_silently=False`
- Added public email functions in `accounts/utils.py`:
  - `send_invite_email(to_email, link, role, center_name, expires_at)` — invitation email
  - `send_registration_approved_email(to_email, name, role, center_name)` — approval notification
  - `send_student_request_received_email(to_email, parent_name, student_name, grade)` — request receipt
  - `send_student_approved_email(to_email, parent_name, student_name, grade, username, password)` — credentials delivery
- HTML email templates in `accounts/templates/emails/`

#### Invitation Link in API Response
- `POST /api/invitations/` now returns `invite_link` in the response body
- `invite_link` is the Bitly-shortened URL (or full URL if shortening failed)

### Frontend Changes

#### Invitations Page (`frontend/src/pages/admin/Invitations.jsx`)
- After creating an invitation, the displayed link now shows `invite_link` from the API (Bitly short URL) instead of constructing a localhost URL
- Token is masked in the display box (`token=••••••••`) for security
- Dev link shown below the short link **only in development mode** (`import.meta.env.DEV`) — a clickable `http://localhost:3000/register?token=...` for local testing
- Copy button copies the Bitly short link

### Configuration Changes

#### Environment Variables — `.env` / `.env.example`
| Variable | Description |
|---|---|
| `BITLY_TOKEN` | Bitly API access token |
| `SITE_BASE_URL` | Public domain used to build invitation URLs (e.g. `https://www.moarit.com`) |
| `EMAIL_HOST_USER` | Gmail address used to send emails |
| `EMAIL_HOST_PASSWORD` | Gmail App Password (not your account password) |
| `CSRF_TRUSTED_ORIGINS` | Comma-separated list of trusted origins for CSRF (e.g. `http://localhost:3000`) |

> `DB_HOST` must be **empty** in `.env` for local development (uses SQLite). Docker Compose sets it to `db` via the `environment:` block.

#### `LMS/settings.py`
- Added `load_dotenv` to load `.env` at startup
- Added `CSRF_TRUSTED_ORIGINS` setting (reads from env, defaults to `http://localhost:3000`)
- Added Gmail SMTP email backend configuration
- Removed `SessionAuthentication` from DRF `DEFAULT_AUTHENTICATION_CLASSES` — eliminates CSRF token requirement for API requests

#### `docker-compose.yml`
- Added `env_file: .env` to the backend service — all variables from `.env` are injected into the container automatically
- `BITLY_TOKEN` and `SITE_BASE_URL` are no longer hardcoded in the compose file

### Bug Fixes
- Fixed CSRF error: `Origin checking failed - http://localhost:3000 does not match any trusted origins`
- Fixed CSRF error: `CSRF token missing` on API POST requests
- Fixed invitation links always showing `http://localhost:3000/register?token=...` instead of the shortened URL
- Fixed `BITLY_TOKEN is not set; skipping URL shortening` warning caused by missing `load_dotenv` call
- Fixed Django crashing locally with `could not translate host name "db"` when `DB_HOST=db` was set in `.env`
