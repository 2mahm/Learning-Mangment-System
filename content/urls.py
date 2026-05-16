from django.urls import path

from .views import (
    BookFileDetailView,
    BookFileListCreateView,
    ChildSectionReorderView,
    ExerciseMyResultView,
    ExerciseResultsView,
    ExerciseStatsView,
    ExerciseSubmitView,
    GroupStudentsView,
    LessonDetailView,
    LessonListCreateView,
    LessonReorderView,
    ParentStudentPerformanceView,
    PublishedLessonDetailView,
    PublishedLessonListView,
    PublishedSubjectGroupListView,
    SectionDetailView,
    SectionListCreateView,
    SectionMediaUploadView,
    SectionReorderView,
    StudentProgressView,
    SubjectGroupDetailView,
    SubjectGroupListCreateView,
)

urlpatterns = [
    # -----------------------------------------------------------------------
    # Subject Groups
    # -----------------------------------------------------------------------
    path(
        'subject-groups/',
        SubjectGroupListCreateView.as_view(),
        name='subject-group-list',
    ),
    path(
        'subject-groups/<uuid:pk>/',
        SubjectGroupDetailView.as_view(),
        name='subject-group-detail',
    ),

    # -----------------------------------------------------------------------
    # Lessons  (nested under subject group for list/create, flat for detail)
    # -----------------------------------------------------------------------
    path(
        'subject-groups/<uuid:group_pk>/lessons/',
        LessonListCreateView.as_view(),
        name='lesson-list',
    ),
    path(
        'subject-groups/<uuid:group_pk>/students/',
        GroupStudentsView.as_view(),
        name='group-students',
    ),
    path(
        'subject-groups/<uuid:group_pk>/lessons/reorder/',
        LessonReorderView.as_view(),
        name='lesson-reorder',
    ),
    path(
        'lessons/<uuid:pk>/',
        LessonDetailView.as_view(),
        name='lesson-detail',
    ),

    # -----------------------------------------------------------------------
    # Sections  (nested under lesson for list/create, flat for detail)
    # -----------------------------------------------------------------------
    path(
        'lessons/<uuid:lesson_pk>/sections/',
        SectionListCreateView.as_view(),
        name='section-list',
    ),
    path(
        'lessons/<uuid:lesson_pk>/sections/reorder/',
        SectionReorderView.as_view(),
        name='section-reorder',
    ),
    path(
        'sections/<uuid:pk>/',
        SectionDetailView.as_view(),
        name='section-detail',
    ),
    path(
        'sections/<uuid:section_pk>/children/reorder/',
        ChildSectionReorderView.as_view(),
        name='child-section-reorder',
    ),

    # -----------------------------------------------------------------------
    # Book Files  (nested under subject group for list/upload, flat for detail)
    # -----------------------------------------------------------------------
    path(
        'subject-groups/<uuid:group_pk>/files/',
        BookFileListCreateView.as_view(),
        name='book-file-list',
    ),
    path(
        'files/<uuid:pk>/',
        BookFileDetailView.as_view(),
        name='book-file-detail',
    ),

    # -----------------------------------------------------------------------
    # Section media upload  (teacher — images for the rich text editor)
    # -----------------------------------------------------------------------
    path(
        'media/',
        SectionMediaUploadView.as_view(),
        name='section-media-upload',
    ),

    # -----------------------------------------------------------------------
    # Parent: student performance
    # -----------------------------------------------------------------------
    path(
        'parent/performance/',
        ParentStudentPerformanceView.as_view(),
        name='parent-performance',
    ),

    # -----------------------------------------------------------------------
    # Exercise submission and results
    # -----------------------------------------------------------------------
    path(
        'sections/<uuid:section_pk>/submit/',
        ExerciseSubmitView.as_view(),
        name='exercise-submit',
    ),
    path(
        'sections/<uuid:section_pk>/my-result/',
        ExerciseMyResultView.as_view(),
        name='exercise-my-result',
    ),
    path(
        'sections/<uuid:section_pk>/results/',
        ExerciseResultsView.as_view(),
        name='exercise-results',
    ),
    path(
        'lessons/<uuid:lesson_pk>/exercise-stats/',
        ExerciseStatsView.as_view(),
        name='exercise-stats',
    ),

    # -----------------------------------------------------------------------
    # Student Progress Dashboard
    # -----------------------------------------------------------------------
    path(
        'progress/student/<int:student_id>/',
        StudentProgressView.as_view(),
        name='student-progress',
    ),

    # -----------------------------------------------------------------------
    # Published content — read-only for students / parents
    # -----------------------------------------------------------------------
    path(
        'published/subject-groups/',
        PublishedSubjectGroupListView.as_view(),
        name='published-subject-group-list',
    ),
    path(
        'published/subject-groups/<uuid:group_pk>/lessons/',
        PublishedLessonListView.as_view(),
        name='published-lesson-list',
    ),
    path(
        'published/lessons/<uuid:pk>/',
        PublishedLessonDetailView.as_view(),
        name='published-lesson-detail',
    ),
]
