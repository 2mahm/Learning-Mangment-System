# Setup & Running Guide

## Prerequisites

| Tool | Version | Required for |
|---|---|---|
| Python | 3.12+ | Backend |
| pip | latest | Python packages |
| Node.js | 18+ | Frontend |
| npm | 9+ | Frontend packages |
| Docker | latest | Docker setup |
| Docker Compose | latest | Docker setup |
| PostgreSQL | 14+ | Production DB (optional locally) |

---

## Option A: Docker Compose (Recommended)

This runs the full stack — PostgreSQL, Django backend, and React frontend — in containers with no manual setup.

### 1. Clone the repository

```bash
git clone <repo-url>
cd lacm-v1.2
```

### 2. Create environment file

```bash
cp .env.example .env
```

Edit `.env` and set a strong `SECRET_KEY`:
```env
SECRET_KEY=replace-with-a-strong-random-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DB_HOST=db
DB_NAME=lms
DB_USER=lms
DB_PASSWORD=lms_secret
DB_PORT=5432
VITE_BACKEND_URL=http://localhost:8000
```

### 3. Start all services

```bash
docker-compose up -d
```

The `entrypoint.sh` script inside the backend container automatically runs migrations on startup.

### 4. Create an admin user

```bash
docker-compose exec backend python manage.py createsuperuser
```

### 5. Access the application

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000/api/ |
| Django Admin | http://localhost:8000/admin/ |

### Stopping the stack

```bash
docker-compose down
```

To also remove the database volume:

```bash
docker-compose down -v
```

---

## Option B: Local Development (SQLite)

This runs the backend and frontend separately on your machine using SQLite as the database — no Docker or PostgreSQL needed.

### Step 1 — Backend setup

#### 1a. Create a Python virtual environment

```bash
cd lacm-v1.2
python -m venv venv
```

Activate it:
- **Windows:** `venv\Scripts\activate`
- **macOS/Linux:** `source venv/bin/activate`

#### 1b. Install Python dependencies

```bash
pip install -r req.txt
```

#### 1c. Configure environment (optional for local dev)

Create a `.env` file or export variables. For local SQLite dev, you only need:

```env
SECRET_KEY=any-local-dev-key
DEBUG=True
```

Leave `DB_HOST` unset — Django will automatically use SQLite.

#### 1d. Run database migrations

```bash
python manage.py migrate
```

#### 1e. Create a superuser (admin account)

```bash
python manage.py createsuperuser
```

You will be prompted for:
- **Email** — used to log in
- **Name** — display name
- **Password**

#### 1f. Start the Django development server

```bash
python manage.py runserver
```

Backend is now running at: http://localhost:8000

---

### Step 2 — Frontend setup

Open a **new terminal** (keep the Django server running in the first one).

#### 2a. Install Node.js dependencies

```bash
cd frontend
npm install
```

#### 2b. Configure the backend URL

Create `frontend/.env`:
```env
VITE_BACKEND_URL=http://localhost:8000
```

#### 2c. Start the Vite dev server

```bash
npm run dev
```

Frontend is now running at: http://localhost:3000

---

## First-Time Application Setup

After starting the app, the admin needs to configure the system:

### 1. Log into Django Admin

Go to http://localhost:8000/admin/ and log in with the superuser credentials.

### 2. Create a Center

Go to the Django Admin or use the API:

```http
POST /api/centers/
Authorization: Token <your-token>

{ "name": "Main Center", "city": "Cairo", "state": "", "country": "Egypt" }
```

### 3. Create an Invitation

Generate an invitation link for a teacher or parent:

```http
POST /api/invitations/
Authorization: Token <your-token>

{
  "role": "teacher",
  "center": 1,
  "expires_at": "2026-12-31T00:00:00Z"
}
```

Share the token with the user: `http://localhost:3000/register?token=<uuid>`

### 4. Approve Registration Requests

After users register, approve their requests:

```http
POST /api/registration-requests/<id>/approve/
Authorization: Token <your-token>
```

---

## Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | _(insecure fallback)_ | Django secret key — **always set in production** |
| `DEBUG` | `True` | Set to `False` in production |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | Comma-separated list of allowed hosts |
| `DB_HOST` | _(empty)_ | PostgreSQL host — leave empty for SQLite |
| `DB_NAME` | `lms` | PostgreSQL database name |
| `DB_USER` | `lms` | PostgreSQL user |
| `DB_PASSWORD` | `lms_secret` | PostgreSQL password |
| `DB_PORT` | `5432` | PostgreSQL port |
| `VITE_BACKEND_URL` | — | Frontend: full URL of the Django backend |

---

## Common Django Management Commands

| Command | Description |
|---|---|
| `python manage.py runserver` | Start development server |
| `python manage.py migrate` | Apply pending database migrations |
| `python manage.py makemigrations` | Generate migration files after model changes |
| `python manage.py createsuperuser` | Create an admin user interactively |
| `python manage.py shell` | Open Django interactive Python shell |
| `python manage.py dbshell` | Open a database SQL shell |
| `python manage.py collectstatic` | Collect static files for production |

---

## Frontend Build Commands

Run from the `frontend/` directory:

| Command | Description |
|---|---|
| `npm run dev` | Start Vite development server (hot reload) |
| `npm run build` | Build production bundle to `frontend/dist/` |
| `npm run preview` | Preview the production build locally |

---

## Production Deployment Notes

1. **Set `DEBUG=False`** and configure `ALLOWED_HOSTS` with your actual domain.
2. **Use a strong, random `SECRET_KEY`** — never use the fallback key.
3. **Run `collectstatic`** and serve `/static/` via Nginx or a CDN.
4. **Serve `/media/`** via Nginx (not Django's dev server).
5. **Use Gunicorn or uWSGI** instead of `manage.py runserver`.
6. **Set up HTTPS** — DRF token authentication transmits tokens in headers; use TLS to protect them.

Example Gunicorn startup:
```bash
gunicorn LMS.wsgi:application --bind 0.0.0.0:8000 --workers 4
```

---

## Troubleshooting

### Port already in use

```bash
# Find and kill the process using the port
# Windows:
netstat -ano | findstr :8000
taskkill /PID <pid> /F

# macOS/Linux:
lsof -ti:8000 | xargs kill
```

### Database migration conflicts

```bash
python manage.py migrate --run-syncdb
```

### Frontend can't reach the backend

Check that `VITE_BACKEND_URL` in `frontend/.env` matches the running backend URL (including port). If using Docker, ensure the frontend container can resolve the backend service name.

### Permission denied on media uploads

Ensure the `media/` directory is writable by the Django process:
```bash
chmod -R 755 media/
```

### Docker: database not ready

If the backend starts before PostgreSQL is ready, restart the backend container:
```bash
docker-compose restart backend
```
