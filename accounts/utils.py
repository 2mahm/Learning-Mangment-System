import logging
import os

from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)


def _get_login_url() -> str:
    base_url = os.environ.get("SITE_BASE_URL", "https://www.moarit.com").rstrip("/")
    return f"{base_url}/login"


def _send_email(subject: str, template_name: str, context: dict, to_email: str) -> None:
    from_email = os.environ.get("EMAIL_HOST_USER", "noreply@example.com")
    html_body = render_to_string(f"emails/{template_name}", context)
    text_body = "\n".join(
        line.strip() for line in html_body.splitlines() if line.strip()
        and not line.strip().startswith("<")
    )
    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=from_email,
        to=[to_email],
    )
    msg.attach_alternative(html_body, "text/html")
    msg.send(fail_silently=False)


def send_invite_email(to_email: str, link: str, role: str = "", center_name: str = "", expires_at: str = "") -> None:
    _send_email(
        subject="You're invited to join LMS Platform",
        template_name="invitation.html",
        context={"link": link, "role": role, "center_name": center_name, "expires_at": expires_at},
        to_email=to_email,
    )


def send_registration_approved_email(to_email: str, name: str, role: str = "", center_name: str = "", login_url: str = "") -> None:
    _send_email(
        subject="Your registration has been approved — LMS Platform",
        template_name="registration_approved.html",
        context={"name": name, "role": role, "center_name": center_name, "login_url": login_url or _get_login_url()},
        to_email=to_email,
    )


def send_student_request_received_email(to_email: str, parent_name: str, student_name: str, grade: str) -> None:
    _send_email(
        subject="Student request received — LMS Platform",
        template_name="student_request_received.html",
        context={"parent_name": parent_name, "student_name": student_name, "grade": grade},
        to_email=to_email,
    )


def notify(recipient_id: int, type: str, title: str, message: str = '', link: str = '') -> None:
    from .models import Notification
    Notification.objects.create(
        recipient_id=recipient_id,
        type=type,
        title=title,
        message=message,
        link=link,
    )


def send_student_approved_email(to_email: str, parent_name: str, student_name: str, grade: str, username: str, password: str, login_url: str = "") -> None:
    _send_email(
        subject=f"Student account created for {student_name} — LMS Platform",
        template_name="student_approved.html",
        context={
            "parent_name": parent_name,
            "student_name": student_name,
            "grade": grade,
            "username": username,
            "password": password,
            "login_url": login_url or _get_login_url(),
        },
        to_email=to_email,
    )
