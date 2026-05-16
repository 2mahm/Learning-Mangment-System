# LACM v1.2 — Learning Centre Management System

A Django + React LMS with role-based access, invitation-based registration, Bitly URL shortening, and Gmail email notifications.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Django 6.0, Django REST Framework |
| Frontend | React 18, Vite |
| Database | PostgreSQL (Docker) / SQLite (local dev) |
| Auth | DRF Token Authentication |
| Email | Gmail SMTP via Django |
| URL Shortener | Bitly API v4 |

---

## Project Structure

```
lacm-v1.2/
├── LMS/                  # Django project settings & URLs
├── accounts/             # Users, invitations, registration, permissions
│   ├── models.py
│   ├── views.py
│   ├── serializers.py
│   ├── permissions.py
│   └── utils.py          # Bitly shortening + email helpers
├── content/              # Course content app
├── frontend/             # React/Vite SPA
├── docker-compose.yml
├── .env                  # Local environment variables (not committed)
├── .env.example          # Template — copy this to .env
└── requirements.txt
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description | Example |
|---|---|---|
| `SECRET_KEY` | Django secret key | `django-insecure-...` |
| `DEBUG` | Enable debug mode | `True` |
| `ALLOWED_HOSTS` | Comma-separated allowed hosts | `localhost,127.0.0.1` |
| `CSRF_TRUSTED_ORIGINS` | Comma-separated trusted origins for CSRF | `http://localhost:3000` |
| `DB_HOST` | Postgres host — **leave empty for local SQLite** | *(empty)* |
| `DB_NAME` | Postgres database name | `lms` |
| `DB_USER` | Postgres user | `lms` |
| `DB_PASSWORD` | Postgres password | `lms_secret` |
| `DB_PORT` | Postgres port | `5432` |
| `BITLY_TOKEN` | Bitly API token for link shortening | `11c241b9...` |
| `SITE_BASE_URL` | Public base URL used in invitation links | `https://www.moarit.com` |
| `EMAIL_HOST_USER` | Gmail address for sending emails | `you@gmail.com` |
| `EMAIL_HOST_PASSWORD` | Gmail App Password (not your real password) | `xxxx xxxx xxxx xxxx` |

> **Gmail App Password:** go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), generate a password for "Mail", and paste it into `EMAIL_HOST_PASSWORD`.

> **Bitly Token:** go to [app.bitly.com/settings/api](https://app.bitly.com/settings/api) to generate a token. Bitly does **not** shorten `localhost` URLs — set `SITE_BASE_URL` to a real domain.

> **`DB_HOST` local rule:** keep it **empty** in `.env` so Django uses SQLite locally. Docker Compose overrides it to `db` inside the container via the `environment:` block.

---

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 18+

### Backend

```bash
cd lacm-v1.2
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Backend runs at `http://localhost:8000`.

### Frontend

```bash
cd lacm-v1.2/frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`.

---

## Docker (Production-like)

```bash
cd lacm-v1.2
docker compose up -d --build
```

| Service | URL |
|---|---|
| Frontend | `http://localhost:3000` |
| Backend API | `http://localhost:8000` |

Docker Compose loads `.env` automatically via `env_file: .env` on the backend service. The `environment:` block then overrides `DB_HOST=db` so Postgres is used inside the container.

```bash
# Run migrations inside the container
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
```

---

## Features

### Invitation-Based Registration

1. Admin creates an invitation (role, center, optional email restriction, expiry)
2. Backend generates a UUID token, builds `{SITE_BASE_URL}/register?token={uuid}`, shortens it via Bitly
3. The shortened link is returned in the `invite_link` field and optionally emailed to the invitee
4. User opens the link, fills in the registration form → creates a **pending** `RegistrationRequest`
5. Admin approves → user account is created with the correct role and permissions

### Bitly URL Shortening

Handled in `accounts/utils.py`:

- `shorten_url(long_url)` — calls Bitly API, falls back to the original URL on error
- `get_invite_link(token)` — builds the full registration URL then shortens it
- Falls back silently if `BITLY_TOKEN` is missing or Bitly is unreachable

### Email Notifications

Handled in `accounts/utils.py` using Django's SMTP email backend:

| Function | Trigger | Recipient |
|---|---|---|
| `send_invite_email` | Invitation created (if email set) | Invitee |
| `send_registration_approved_email` | Admin approves request | New user |
| `send_student_request_received_email` | Parent submits student request | Parent |
| `send_student_approved_email` | Admin approves student | Parent |

HTML email templates live in `accounts/templates/emails/`.

### Role & Permission System

| Role | Default Permissions |
|---|---|
| `teacher` | `can_login`, `can_view_content`, `can_manage_content` |
| `parent` | `can_login`, `can_view_students`, `can_add_student` |
| `center_admin` | `can_login` + custom set chosen at invitation time |
| `is_staff` (superadmin) | All permissions implicitly |

---

## API Reference

See [API_DOCS.md](API_DOCS.md) for full endpoint documentation.
