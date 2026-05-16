import uuid

from django.conf import settings
from django.db import models
from accounts.models import Center, Grade


SUBJECT_TRACK_CHOICES = [
    ('arabic', 'Arabic'),
    ('quran', 'Quran'),
    ('culture', 'Culture'),
]


class SubjectGroup(models.Model):
    """
    A teacher's book or course (e.g. "Quran Recitation Beginners", "Arabic Level 2").
    Groups several lessons under a single subject and track.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='subject_groups',
    )
    subject_track = models.CharField(max_length=20, choices=SUBJECT_TRACK_CHOICES)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    centers = models.ManyToManyField(
        Center,
        blank=True,
        related_name='subject_groups',
    )
    target_grades = models.ManyToManyField(
        Grade,
        blank=True,
        related_name='subject_groups',
    )
    sort_order = models.PositiveIntegerField(default=0)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['sort_order', 'created_at']

    def __str__(self):
        return f"{self.title} ({self.subject_track})"


class Lesson(models.Model):
    """
    A single lesson inside a SubjectGroup. Has an ordered list of sections.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subject_group = models.ForeignKey(
        SubjectGroup,
        on_delete=models.CASCADE,
        related_name='lessons',
    )
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='lessons',
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    published = models.BooleanField(default=False)
    target_grades = models.ManyToManyField(
        Grade,
        blank=True,
        related_name='lessons',
    )
    assigned_students = models.ManyToManyField(
        'accounts.Student',
        blank=True,
        related_name='assigned_lessons',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'created_at']

    def __str__(self):
        return f"{self.title}"


class LessonSection(models.Model):
    """
    A section (or sub-section) inside a lesson.

    type = 'title'    → heading only, no content body
    type = 'content'  → rich text / HTML stored in content_body
    type = 'exercise' → SurveyJS JSON schema stored in content_body

    Nesting is achieved via the self-referential parent FK.
    depth is stored for efficient querying (0 = top-level, 1 = child, etc.)
    """
    SECTION_TYPE_CHOICES = [
        ('title', 'Title'),
        ('content', 'Content'),
        ('exercise', 'Exercise'),
        ('quran_display', 'Quran Display'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lesson = models.ForeignKey(
        Lesson,
        on_delete=models.CASCADE,
        related_name='sections',
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='children',
    )
    sort_order = models.PositiveIntegerField(default=0)
    depth = models.PositiveIntegerField(default=0)
    type = models.CharField(max_length=20, choices=SECTION_TYPE_CHOICES)
    title = models.CharField(max_length=255, blank=True)
    content_body = models.JSONField(null=True, blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ['sort_order']

    def __str__(self):
        return f"{self.title or '(untitled)'} [{self.type}]"


# ---------------------------------------------------------------------------
# Book / course files attached to a SubjectGroup
# ---------------------------------------------------------------------------

def book_file_upload_path(instance, filename):
    return f'book_files/{instance.subject_group_id}/{filename}'


class BookFile(models.Model):
    FILE_TYPE_CHOICES = [
        ('pdf', 'PDF'),
        ('doc', 'Word Document'),
        ('image', 'Image'),
        ('audio', 'Audio'),
        ('other', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subject_group = models.ForeignKey(
        SubjectGroup,
        on_delete=models.CASCADE,
        related_name='book_files',
    )
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to=book_file_upload_path)
    file_type = models.CharField(max_length=10, choices=FILE_TYPE_CHOICES, default='other')
    sort_order = models.PositiveIntegerField(default=0)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['sort_order', 'uploaded_at']

    def __str__(self):
        return f"{self.title} ({self.subject_group.title})"


class ExerciseSubmission(models.Model):
    """One graded attempt by a student on an exercise (LessonSection type='exercise')."""
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    section     = models.ForeignKey(
        LessonSection,
        on_delete=models.CASCADE,
        related_name='submissions',
        limit_choices_to={'type': 'exercise'},
    )
    student     = models.ForeignKey(
        'accounts.Student',
        on_delete=models.CASCADE,
        related_name='exercise_submissions',
    )
    answers     = models.JSONField(default=dict)
    score       = models.PositiveIntegerField(default=0)
    total       = models.PositiveIntegerField(default=0)
    details     = models.JSONField(default=list)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-submitted_at']

    @property
    def percentage(self):
        return round(self.score / self.total * 100) if self.total else 0

    def __str__(self):
        return f"{self.student} — {self.section} — {self.score}/{self.total}"
