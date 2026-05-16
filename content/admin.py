from django.contrib import admin

from .models import BookFile, ExerciseSubmission, Lesson, LessonSection, SubjectGroup


@admin.register(ExerciseSubmission)
class ExerciseSubmissionAdmin(admin.ModelAdmin):
    list_display    = ['student', 'section', 'score', 'total', 'pct', 'submitted_at']
    list_filter     = ['submitted_at']
    search_fields   = ['student__name', 'section__title']
    ordering        = ['-submitted_at']
    readonly_fields = ['id', 'answers', 'details', 'submitted_at']

    @admin.display(description='%')
    def pct(self, obj):
        return f'{obj.percentage}%'


@admin.register(SubjectGroup)
class SubjectGroupAdmin(admin.ModelAdmin):
    list_display = ['title', 'subject_track', 'teacher', 'active', 'sort_order', 'created_at']
    list_filter = ['subject_track', 'active']
    search_fields = ['title', 'teacher__email', 'teacher__name']
    ordering = ['sort_order', 'created_at']
    readonly_fields = ['id', 'created_at']


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ['title', 'subject_group', 'teacher', 'published', 'sort_order', 'created_at']
    list_filter = ['published']
    search_fields = ['title', 'teacher__email', 'subject_group__title']
    ordering = ['subject_group', 'sort_order']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(LessonSection)
class LessonSectionAdmin(admin.ModelAdmin):
    list_display = ['title', 'lesson', 'type', 'depth', 'sort_order', 'active']
    list_filter = ['type', 'active']
    search_fields = ['title', 'lesson__title']
    ordering = ['lesson', 'sort_order']
    readonly_fields = ['id']


@admin.register(BookFile)
class BookFileAdmin(admin.ModelAdmin):
    list_display = ['title', 'subject_group', 'file_type', 'sort_order', 'uploaded_at']
    list_filter = ['file_type']
    search_fields = ['title', 'subject_group__title']
    ordering = ['subject_group', 'sort_order']
    readonly_fields = ['id', 'uploaded_at']
