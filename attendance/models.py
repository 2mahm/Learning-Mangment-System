import uuid

from django.conf import settings
from django.db import models


class AttendanceRecord(models.Model):
    STATUS_CHOICES = [
        ('present', 'Present'),
        ('absent',  'Absent'),
        ('late',    'Late'),
        ('excused', 'Excused'),
    ]

    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subject_group = models.ForeignKey(
        'content.SubjectGroup',
        on_delete=models.CASCADE,
        related_name='attendance_records',
    )
    student = models.ForeignKey(
        'accounts.Student',
        on_delete=models.CASCADE,
        related_name='attendance_records',
    )
    date        = models.DateField()
    status      = models.CharField(max_length=20, choices=STATUS_CHOICES, default='present')
    notes       = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='recorded_attendance',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('subject_group', 'student', 'date')
        ordering = ['-date', 'student__name']

    def __str__(self):
        return f"{self.student.name} – {self.date} – {self.status}"
