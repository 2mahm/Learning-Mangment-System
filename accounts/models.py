import secrets
import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class Center(models.Model):
    name    = models.CharField(max_length=255, unique=True)
    city    = models.CharField(max_length=100, blank=True)
    state   = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Grade(models.Model):
    name       = models.CharField(max_length=100)
    center     = models.ForeignKey('Center', on_delete=models.CASCADE, related_name='grades')
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = [('name', 'center')]
        ordering = ['sort_order', 'name']

    def __str__(self):
        return f"{self.name} ({self.center.name})"


class CustomUserManager(BaseUserManager):
    def create_user(self, email, name, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, name=name, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, name, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('role', 'admin')
        return self.create_user(email, name, password, **extra_fields)


class CustomUser(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('teacher', 'Teacher'),
        ('parent', 'Parent'),
        ('center_admin', 'Center Admin'),
        ('admin', 'Admin'),
    ]

    name = models.CharField(max_length=150)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    is_active = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    center = models.ForeignKey(
        'Center',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users',
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    objects = CustomUserManager()

    class Meta:
        permissions = [
            # Access control
            ('can_login',               'Can log in to the system'),
            # Invitation management
            ('can_view_invitations',    'Can view invitations'),
            ('can_create_invitation',   'Can create invitations'),
            # Registration request management
            ('can_view_requests',       'Can view registration requests'),
            ('can_approve_request',     'Can approve registration requests'),
            ('can_reject_request',      'Can reject registration requests'),
            # User management
            ('can_view_users',          'Can view users'),
            ('can_edit_user',           'Can edit users'),
            ('can_delete_user',         'Can delete users'),
            ('can_manage_permissions',  'Can manage user permissions'),
            # Student management
            ('can_view_students',           'Can view students'),
            ('can_add_student',             'Can add students'),
            # Student request management
            ('can_view_student_requests',   'Can view student add requests'),
            ('can_approve_student_request', 'Can approve student add requests'),
            ('can_reject_student_request',  'Can reject student add requests'),
            # Content management
            ('can_manage_content', 'Can create and edit subject groups, lessons, and sections'),
            ('can_view_content',   'Can view published lessons and subject groups'),
            ('can_manage_grades',  'Can create, edit, and delete grades'),
            # Attendance
            ('can_manage_attendance', 'Can record and edit attendance'),
            ('can_view_attendance',   'Can view attendance records'),
        ]

    def __str__(self):
        return f"{self.name} ({self.email})"


class Invitation(models.Model):
    ROLE_CHOICES = [
        ('teacher', 'Teacher'),
        ('parent', 'Parent'),
        ('center_admin', 'Center Admin'),
    ]

    email = models.EmailField(blank=True, null=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    is_used = models.BooleanField(default=False)
    expires_at = models.DateTimeField()
    center = models.ForeignKey(
        'Center',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invitations',
    )
    created_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        related_name='invitations',
    )
    # Pre-assigned permissions for center_admin invitations
    permissions = models.ManyToManyField(
        'auth.Permission',
        blank=True,
        related_name='assigned_invitations',
    )

    def is_valid(self):
        return not self.is_used and self.expires_at > timezone.now()

    def __str__(self):
        return f"Invitation({self.role}, token={self.token})"


class RegistrationRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    name = models.CharField(max_length=150)
    email = models.EmailField()
    password = models.CharField(max_length=128)  # stored hashed
    role = models.CharField(max_length=20)
    invitation = models.ForeignKey(
        Invitation,
        on_delete=models.PROTECT,
        related_name='requests',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"RegistrationRequest({self.email}, {self.status})"


class TeacherProfile(models.Model):
    user = models.OneToOneField(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='teacher_profile',
    )
    subject = models.CharField(max_length=100, blank=True)
    centers = models.ManyToManyField('Center', blank=True, related_name='teachers')

    def __str__(self):
        return f"TeacherProfile({self.user.email})"


class ParentProfile(models.Model):
    user = models.OneToOneField(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='parent_profile',
    )

    def __str__(self):
        return f"ParentProfile({self.user.email})"


class StudentRequest(models.Model):
    STATUS_CHOICES = [
        ('pending',  'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    name = models.CharField(max_length=150)
    grade = models.ForeignKey(
        'Grade',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='student_requests',
    )
    parent = models.ForeignKey(
        ParentProfile,
        on_delete=models.CASCADE,
        related_name='student_requests',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"StudentRequest({self.name}, {self.status})"


class Student(models.Model):
    name = models.CharField(max_length=150)
    grade = models.ForeignKey(
        'Grade',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='students',
    )
    parent = models.ForeignKey(
        ParentProfile,
        on_delete=models.CASCADE,
        related_name='students',
    )
    # Credentials assigned by admin at approval time
    username = models.CharField(max_length=50, unique=True, null=True, blank=True)
    password = models.CharField(max_length=128, blank=True)  # stored hashed
    token    = models.CharField(max_length=64, unique=True, blank=True)
    avatar   = models.ImageField(upload_to='student_avatars/', null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = secrets.token_hex(32)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Student({self.name}, grade={self.grade.name if self.grade_id else ''})"


class Notification(models.Model):
    TYPE_CHOICES = [
        ('request_approved',    'Registration Approved'),
        ('request_rejected',    'Registration Rejected'),
        ('student_approved',    'Student Approved'),
        ('lesson_published',    'Lesson Published'),
        ('attendance_recorded', 'Attendance Recorded'),
    ]

    recipient  = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='notifications')
    type       = models.CharField(max_length=50, choices=TYPE_CHOICES)
    title      = models.CharField(max_length=255)
    message    = models.TextField(blank=True)
    is_read    = models.BooleanField(default=False)
    link       = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification({self.recipient.email}, {self.type}, read={self.is_read})"
