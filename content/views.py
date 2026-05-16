import os
import random
import uuid as uuid_lib

from django.conf import settings
from django.core.files.storage import default_storage
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework.permissions import IsAuthenticated

from accounts.models import Student
from accounts.utils import notify
from .models import BookFile, ExerciseSubmission, Lesson, LessonSection, SubjectGroup
from .permissions import CanManageContent, CanViewContent
from .serializers import (
    BookFileSerializer,
    LessonDetailSerializer,
    LessonListSerializer,
    LessonSectionSerializer,
    LessonSectionWriteSerializer,
    PublishedSubjectGroupSerializer,
    ReorderSerializer,
    SectionUpdateSerializer,
    SubjectGroupSerializer,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _soft_delete_descendants(section):
    """Recursively soft-delete all active children of a section."""
    for child in section.children.filter(active=True):
        _soft_delete_descendants(child)
        child.active = False
        child.save(update_fields=['active'])


def _student_from_request(request):
    """Return the Student if the request was authenticated via StudentToken, else None."""
    return request.auth if isinstance(request.auth, Student) else None


def _grade_exercise(exercise_body, answers):
    """
    Compare student answers against stored correct answers.
    Returns (score: int, total: int, details: list).
    Only questions with a non-None 'correct' field (or matching pairs) count.
    """
    questions = exercise_body.get('questions', [])
    details, score, total = [], 0, 0

    for q in questions:
        qid  = q.get('id')
        qtype = q.get('type', '')

        # ── Ordering: each item in the correct position counts as one point ──
        if qtype == 'ordering':
            items = q.get('items', [])
            correct_order  = [item['id'] for item in items]
            student_order  = answers.get(qid, [])
            if not isinstance(student_order, list):
                student_order = []
            correct_count = sum(
                1 for i, iid in enumerate(student_order)
                if i < len(correct_order) and iid == correct_order[i]
            )
            total += len(items)
            score += correct_count
            details.append({
                'id': qid, 'text': q.get('text', ''), 'type': 'ordering',
                'items': items,
                'student_answer': student_order,
                'correct_answer': correct_order,
                'is_correct': correct_count == len(items),
                'correct_count': correct_count,
            })
            continue

        # ── Matching: each pair counts as one point ──────────────────────────
        if qtype == 'matching':
            pairs = q.get('pairs', [])
            student_map = answers.get(qid, {})
            if not isinstance(student_map, dict):
                student_map = {}
            correct_map = {p['id']: p['right'] for p in pairs}
            correct_count = sum(
                1 for p in pairs if student_map.get(p['id']) == p['right']
            )
            total += len(pairs)
            score += correct_count
            details.append({
                'id': qid, 'text': q.get('text', ''), 'type': 'matching',
                'pairs': pairs,
                'student_answer': student_map,
                'correct_answer': correct_map,
                'is_correct': correct_count == len(pairs),
                'correct_count': correct_count,
            })
            continue

        # ── All other types ──────────────────────────────────────────────────
        correct     = q.get('correct')
        student_ans = str(answers.get(qid, '')).strip()

        if correct is None:
            details.append({
                'id': qid, 'text': q.get('text', ''), 'type': qtype,
                'image': q.get('image'), 'choices': q.get('choices'),
                'student_answer': student_ans, 'correct_answer': None, 'is_correct': None,
            })
            continue

        total += 1
        if qtype in ('text', 'fill_blank', 'word_scramble'):
            is_correct = (
                student_ans == str(correct).strip()
                if q.get('caseSensitive')
                else student_ans.lower() == str(correct).strip().lower()
            )
        else:
            is_correct = student_ans == str(correct)

        if is_correct:
            score += 1

        details.append({
            'id': qid, 'text': q.get('text', ''), 'type': qtype,
            'image': q.get('image'), 'choices': q.get('choices'),
            'student_answer': student_ans, 'correct_answer': correct,
            'is_correct': is_correct,
        })

    return score, total, details


# ---------------------------------------------------------------------------
# Subject Groups
# ---------------------------------------------------------------------------

class SubjectGroupListCreateView(APIView):
    """
    GET  /content/subject-groups/  — list this teacher's active subject groups
    POST /content/subject-groups/  — create a new subject group
    """
    permission_classes = [CanManageContent]

    def get(self, request):
        groups = SubjectGroup.objects.filter(teacher=request.user, active=True)
        serializer = SubjectGroupSerializer(groups, many=True)
        return Response(serializer.data)

    def post(self, request):
        # Validate all selected centers belong to this teacher
        center_ids = request.data.get('centers', [])
        if not center_ids:
            return Response({'centers': 'At least one center must be selected.'}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(center_ids, list):
            center_ids = [center_ids]
        teacher_center_ids = set(request.user.teacher_profile.centers.values_list('id', flat=True))
        invalid = [cid for cid in center_ids if int(cid) not in teacher_center_ids]
        if invalid:
            return Response({'centers': 'You are not assigned to one or more selected centers.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = SubjectGroupSerializer(data=request.data)
        if serializer.is_valid():
            # Default sort_order: append after existing groups
            if 'sort_order' not in request.data:
                sort_order = SubjectGroup.objects.filter(
                    teacher=request.user, active=True
                ).count()
                serializer.save(teacher=request.user, sort_order=sort_order)
            else:
                serializer.save(teacher=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SubjectGroupDetailView(APIView):
    """
    GET    /content/subject-groups/<pk>/  — retrieve
    PATCH  /content/subject-groups/<pk>/  — update
    DELETE /content/subject-groups/<pk>/  — soft delete
    """
    permission_classes = [CanManageContent]

    def _get_group(self, pk, user):
        try:
            return SubjectGroup.objects.get(pk=pk, teacher=user, active=True), None
        except SubjectGroup.DoesNotExist:
            return None, Response(
                {'error': 'Subject group not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

    def get(self, request, pk):
        group, err = self._get_group(pk, request.user)
        if err:
            return err
        return Response(SubjectGroupSerializer(group).data)

    def patch(self, request, pk):
        group, err = self._get_group(pk, request.user)
        if err:
            return err
        serializer = SubjectGroupSerializer(group, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        group, err = self._get_group(pk, request.user)
        if err:
            return err
        group.active = False
        group.save(update_fields=['active'])
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Lessons
# ---------------------------------------------------------------------------

class LessonListCreateView(APIView):
    """
    GET  /content/subject-groups/<group_pk>/lessons/  — list lessons in a subject group
    POST /content/subject-groups/<group_pk>/lessons/  — create a lesson
    """
    permission_classes = [CanManageContent]

    def _get_group(self, group_pk, user):
        try:
            return SubjectGroup.objects.get(pk=group_pk, teacher=user, active=True), None
        except SubjectGroup.DoesNotExist:
            return None, Response(
                {'error': 'Subject group not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

    def get(self, request, group_pk):
        group, err = self._get_group(group_pk, request.user)
        if err:
            return err
        lessons = group.lessons.order_by('sort_order', 'created_at')
        return Response(LessonListSerializer(lessons, many=True).data)

    def post(self, request, group_pk):
        group, err = self._get_group(group_pk, request.user)
        if err:
            return err
        serializer = LessonListSerializer(data=request.data)
        if serializer.is_valid():
            sort_order = serializer.validated_data.get(
                'sort_order', group.lessons.count()
            )
            serializer.save(
                subject_group=group,
                teacher=request.user,
                sort_order=sort_order,
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LessonReorderView(APIView):
    """
    POST /content/subject-groups/<group_pk>/lessons/reorder/
    Body: {"order": ["<uuid>", "<uuid>", ...]}
    """
    permission_classes = [CanManageContent]

    def post(self, request, group_pk):
        try:
            group = SubjectGroup.objects.get(pk=group_pk, teacher=request.user, active=True)
        except SubjectGroup.DoesNotExist:
            return Response(
                {'error': 'Subject group not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = ReorderSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        ids = serializer.validated_data['order']
        lessons = Lesson.objects.filter(pk__in=ids, subject_group=group)
        if lessons.count() != len(ids):
            return Response(
                {'error': 'One or more lesson IDs are invalid.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        id_to_order = {uid: idx for idx, uid in enumerate(ids)}
        for lesson in lessons:
            lesson.sort_order = id_to_order[lesson.pk]
            lesson.save(update_fields=['sort_order'])

        return Response({'message': 'Lessons reordered.'})


class LessonDetailView(APIView):
    """
    GET    /content/lessons/<pk>/  — full lesson detail with section tree
    PATCH  /content/lessons/<pk>/  — update lesson metadata
    DELETE /content/lessons/<pk>/  — delete lesson (hard delete; sections cascade)
    """
    permission_classes = [CanManageContent]

    def _get_lesson(self, pk, user):
        try:
            return Lesson.objects.get(pk=pk, teacher=user), None
        except Lesson.DoesNotExist:
            return None, Response(
                {'error': 'Lesson not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

    def get(self, request, pk):
        lesson, err = self._get_lesson(pk, request.user)
        if err:
            return err
        return Response(LessonDetailSerializer(lesson).data)

    def patch(self, request, pk):
        lesson, err = self._get_lesson(pk, request.user)
        if err:
            return err
        was_published = lesson.published
        serializer = LessonListSerializer(lesson, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            # Notify parents when a lesson is published for the first time
            if not was_published and serializer.instance.published:
                self._notify_lesson_published(serializer.instance)
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def _notify_lesson_published(self, lesson):
        from accounts.models import CustomUser
        group = lesson.subject_group
        center_ids = list(group.centers.values_list('id', flat=True))
        if center_ids:
            parent_ids = CustomUser.objects.filter(
                role='parent', center_id__in=center_ids, is_active=True, is_deleted=False,
            ).values_list('id', flat=True)
        else:
            parent_ids = CustomUser.objects.filter(
                role='parent', is_active=True, is_deleted=False,
            ).values_list('id', flat=True)
        for pid in parent_ids:
            notify(
                recipient_id=pid,
                type='lesson_published',
                title='New Lesson Available',
                message=f'"{lesson.title}" has been published in {group.title}.',
                link='/parent/progress',
            )

    def delete(self, request, pk):
        lesson, err = self._get_lesson(pk, request.user)
        if err:
            return err
        lesson.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Lesson Sections
# ---------------------------------------------------------------------------

class SectionListCreateView(APIView):
    """
    GET  /content/lessons/<lesson_pk>/sections/  — top-level section tree
    POST /content/lessons/<lesson_pk>/sections/  — create a section (top-level or child)
    """
    permission_classes = [CanManageContent]

    def _get_lesson(self, lesson_pk, user):
        try:
            return Lesson.objects.get(pk=lesson_pk, teacher=user), None
        except Lesson.DoesNotExist:
            return None, Response(
                {'error': 'Lesson not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

    def get(self, request, lesson_pk):
        lesson, err = self._get_lesson(lesson_pk, request.user)
        if err:
            return err
        top_level = lesson.sections.filter(parent__isnull=True, active=True).order_by('sort_order')
        return Response(LessonSectionSerializer(top_level, many=True).data)

    def post(self, request, lesson_pk):
        lesson, err = self._get_lesson(lesson_pk, request.user)
        if err:
            return err

        # If a parent is provided, validate it belongs to this lesson
        parent_id = request.data.get('parent')
        if parent_id:
            try:
                LessonSection.objects.get(pk=parent_id, lesson=lesson, active=True)
            except LessonSection.DoesNotExist:
                return Response(
                    {'error': 'Parent section not found in this lesson.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        serializer = LessonSectionWriteSerializer(
            data=request.data,
            context={'lesson': lesson},
        )
        if serializer.is_valid():
            section = serializer.save()
            return Response(
                LessonSectionSerializer(section).data,
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SectionReorderView(APIView):
    """
    POST /content/lessons/<lesson_pk>/sections/reorder/
    Reorders the top-level sections of a lesson.
    Body: {"order": ["<uuid>", "<uuid>", ...]}
    """
    permission_classes = [CanManageContent]

    def post(self, request, lesson_pk):
        try:
            lesson = Lesson.objects.get(pk=lesson_pk, teacher=request.user)
        except Lesson.DoesNotExist:
            return Response(
                {'error': 'Lesson not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = ReorderSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        ids = serializer.validated_data['order']
        sections = LessonSection.objects.filter(
            pk__in=ids, lesson=lesson, parent__isnull=True, active=True
        )
        if sections.count() != len(ids):
            return Response(
                {'error': 'One or more section IDs are invalid or not top-level.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        id_to_order = {uid: idx for idx, uid in enumerate(ids)}
        for section in sections:
            section.sort_order = id_to_order[section.pk]
            section.save(update_fields=['sort_order'])

        return Response({'message': 'Sections reordered.'})


class SectionDetailView(APIView):
    """
    PATCH  /content/sections/<pk>/  — update title, type, or content_body
    DELETE /content/sections/<pk>/  — soft-delete section and all its descendants
    """
    permission_classes = [CanManageContent]

    def _get_section(self, pk, user):
        try:
            section = LessonSection.objects.select_related('lesson').get(
                pk=pk, active=True
            )
        except LessonSection.DoesNotExist:
            return None, Response(
                {'error': 'Section not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        if section.lesson.teacher_id != user.pk:
            return None, Response(
                {'error': 'Section not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return section, None

    def patch(self, request, pk):
        section, err = self._get_section(pk, request.user)
        if err:
            return err
        serializer = SectionUpdateSerializer(section, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(LessonSectionSerializer(section).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        section, err = self._get_section(pk, request.user)
        if err:
            return err
        _soft_delete_descendants(section)
        section.active = False
        section.save(update_fields=['active'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChildSectionReorderView(APIView):
    """
    POST /content/sections/<section_pk>/children/reorder/
    Reorders the direct children of a given section.
    Body: {"order": ["<uuid>", "<uuid>", ...]}
    """
    permission_classes = [CanManageContent]

    def post(self, request, section_pk):
        try:
            parent_section = LessonSection.objects.select_related('lesson').get(
                pk=section_pk, active=True
            )
        except LessonSection.DoesNotExist:
            return Response(
                {'error': 'Section not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        if parent_section.lesson.teacher_id != request.user.pk:
            return Response(
                {'error': 'Section not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = ReorderSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        ids = serializer.validated_data['order']
        children = LessonSection.objects.filter(
            pk__in=ids, parent=parent_section, active=True
        )
        if children.count() != len(ids):
            return Response(
                {'error': 'One or more child section IDs are invalid.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        id_to_order = {uid: idx for idx, uid in enumerate(ids)}
        for child in children:
            child.sort_order = id_to_order[child.pk]
            child.save(update_fields=['sort_order'])

        return Response({'message': 'Children reordered.'})


# ---------------------------------------------------------------------------
# Book Files
# ---------------------------------------------------------------------------

class BookFileListCreateView(APIView):
    """
    GET  /content/subject-groups/<group_pk>/files/  — list files attached to a subject group
    POST /content/subject-groups/<group_pk>/files/  — upload a new file (multipart/form-data)
    """
    permission_classes = [CanManageContent]
    parser_classes = [MultiPartParser, FormParser]

    def _get_group(self, group_pk, user):
        try:
            return SubjectGroup.objects.get(pk=group_pk, teacher=user, active=True), None
        except SubjectGroup.DoesNotExist:
            return None, Response(
                {'error': 'Subject group not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

    def get(self, request, group_pk):
        group, err = self._get_group(group_pk, request.user)
        if err:
            return err
        files = group.book_files.order_by('sort_order', 'uploaded_at')
        serializer = BookFileSerializer(files, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request, group_pk):
        group, err = self._get_group(group_pk, request.user)
        if err:
            return err
        serializer = BookFileSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            sort_order = serializer.validated_data.get(
                'sort_order', group.book_files.count()
            )
            serializer.save(subject_group=group, sort_order=sort_order)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class BookFileDetailView(APIView):
    """
    PATCH  /content/files/<pk>/  — update title or sort_order
    DELETE /content/files/<pk>/  — delete file record and remove file from storage
    """
    permission_classes = [CanManageContent]

    def _get_file(self, pk, user):
        try:
            book_file = BookFile.objects.select_related('subject_group').get(pk=pk)
        except BookFile.DoesNotExist:
            return None, Response(
                {'error': 'File not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        if book_file.subject_group.teacher_id != user.pk:
            return None, Response(
                {'error': 'File not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return book_file, None

    def patch(self, request, pk):
        book_file, err = self._get_file(pk, request.user)
        if err:
            return err
        serializer = BookFileSerializer(
            book_file, data=request.data, partial=True, context={'request': request}
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        book_file, err = self._get_file(pk, request.user)
        if err:
            return err
        book_file.file.delete(save=False)  # remove from storage
        book_file.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Section media upload
# ---------------------------------------------------------------------------

class SectionMediaUploadView(APIView):
    """
    POST /content/media/
    Accepts a single image file, saves it under media/section_media/, and
    returns the absolute URL so TipTap can embed it immediately.
    """
    permission_classes = [CanManageContent]
    parser_classes     = [MultiPartParser, FormParser]

    ALLOWED_TYPES = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}
    MAX_BYTES     = 5 * 1024 * 1024  # 5 MB

    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response(
                {'error': 'No file provided.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if file.content_type not in self.ALLOWED_TYPES:
            return Response(
                {'error': 'Only JPEG, PNG, GIF, and WebP images are supported.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if file.size > self.MAX_BYTES:
            return Response(
                {'error': 'Image must be under 5 MB.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ext       = os.path.splitext(file.name)[1].lower() or '.jpg'
        filename  = f'{uuid_lib.uuid4().hex}{ext}'
        saved     = default_storage.save(f'section_media/{filename}', file)
        url       = settings.MEDIA_URL + saved

        return Response({'url': url}, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Exercise submission and results
# ---------------------------------------------------------------------------

class ExerciseSubmitView(APIView):
    """
    POST /content/sections/<section_pk>/submit/
    Authenticated student submits answers. Grades server-side. Returns full result.
    Body: { "answers": { "<question_id>": "<answer_value>", ... } }
    """
    permission_classes = [CanViewContent]

    def post(self, request, section_pk):
        student = _student_from_request(request)
        if not student:
            return Response(
                {'error': 'Only students can submit exercises.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            section = LessonSection.objects.select_related(
                'lesson__subject_group'
            ).get(pk=section_pk, type='exercise', active=True)
        except LessonSection.DoesNotExist:
            return Response({'error': 'Exercise not found.'}, status=status.HTTP_404_NOT_FOUND)

        if request.user.center_id and not section.lesson.subject_group.centers.filter(
            id=request.user.center_id
        ).exists():
            return Response({'error': 'Exercise not found.'}, status=status.HTTP_404_NOT_FOUND)

        answers = request.data.get('answers', {})
        if not isinstance(answers, dict):
            return Response(
                {'error': 'answers must be an object.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        score, total, details = _grade_exercise(section.content_body or {}, answers)
        sub = ExerciseSubmission.objects.create(
            section=section, student=student,
            answers=answers, score=score, total=total, details=details,
        )
        return Response({
            'id': str(sub.id), 'score': score, 'total': total,
            'percentage': sub.percentage, 'details': details,
            'submitted_at': sub.submitted_at,
        }, status=status.HTTP_201_CREATED)


class ExerciseMyResultView(APIView):
    """
    GET /content/sections/<section_pk>/my-result/
    Returns the authenticated student's latest submission for this exercise.
    """
    permission_classes = [CanViewContent]

    def get(self, request, section_pk):
        student = _student_from_request(request)
        if not student:
            return Response(
                {'error': 'Only students can view their results.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        sub = ExerciseSubmission.objects.filter(
            section_id=section_pk, student=student
        ).first()
        if not sub:
            return Response({'attempted': False})
        return Response({
            'attempted': True, 'id': str(sub.id),
            'score': sub.score, 'total': sub.total, 'percentage': sub.percentage,
            'details': sub.details, 'submitted_at': sub.submitted_at,
        })


class ParentStudentPerformanceView(APIView):
    """
    GET /content/parent/performance/
    Parent views all their students' exercise submissions with per-question details.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            parent_profile = request.user.parent_profile
        except Exception:
            return Response({'error': 'Parent profile not found.'}, status=status.HTTP_403_FORBIDDEN)

        students = parent_profile.students.select_related('grade').all()
        result = []

        for student in students:
            submissions = (
                ExerciseSubmission.objects
                .filter(student=student)
                .select_related('section__lesson__subject_group')
                .order_by('-submitted_at')
            )
            submissions_data = [
                {
                    'id': str(sub.id),
                    'section_title': sub.section.title or '',
                    'lesson_title': sub.section.lesson.title,
                    'subject_group_title': sub.section.lesson.subject_group.title,
                    'score': sub.score,
                    'total': sub.total,
                    'percentage': sub.percentage,
                    'submitted_at': sub.submitted_at,
                    'details': sub.details,
                }
                for sub in submissions
            ]
            result.append({
                'id': student.id,
                'name': student.name,
                'grade_name': student.grade.name if student.grade else '',
                'submissions': submissions_data,
            })

        return Response(result)


class ExerciseResultsView(APIView):
    """
    GET /content/sections/<section_pk>/results/
    Teacher only. All submissions for one exercise; latest per student flagged.
    """
    permission_classes = [CanManageContent]

    def get(self, request, section_pk):
        try:
            section = LessonSection.objects.get(
                pk=section_pk, type='exercise', active=True,
                lesson__teacher=request.user,
            )
        except LessonSection.DoesNotExist:
            return Response({'error': 'Exercise not found.'}, status=status.HTTP_404_NOT_FOUND)

        subs = (
            ExerciseSubmission.objects
            .filter(section=section)
            .select_related('student__grade')
            .order_by('-submitted_at')
        )
        seen, data = set(), []
        for s in subs:
            is_latest = s.student_id not in seen
            if is_latest:
                seen.add(s.student_id)
            data.append({
                'id': str(s.id), 'student_name': s.student.name,
                'student_grade': s.student.grade.name if s.student.grade_id else '', 'score': s.score,
                'total': s.total, 'percentage': s.percentage,
                'submitted_at': s.submitted_at, 'is_latest': is_latest,
            })
        return Response({
            'section_title': section.title or 'Untitled Exercise',
            'total_students': len(seen),
            'submissions': data,
        })


class ExerciseStatsView(APIView):
    """
    GET /content/lessons/<lesson_pk>/exercise-stats/
    Teacher only. Student x exercise performance grid for an entire lesson.
    """
    permission_classes = [CanManageContent]

    def get(self, request, lesson_pk):
        try:
            lesson = Lesson.objects.get(pk=lesson_pk, teacher=request.user)
        except Lesson.DoesNotExist:
            return Response({'error': 'Lesson not found.'}, status=status.HTTP_404_NOT_FOUND)

        sections = list(
            lesson.sections.filter(type='exercise', active=True).order_by('sort_order')
        )
        exercises_meta = [
            {'id': str(s.id), 'title': s.title or f'Exercise {i + 1}'}
            for i, s in enumerate(sections)
        ]

        from collections import defaultdict
        student_map = defaultdict(lambda: {'name': '', 'grade': '', 'results': {}})

        for sec in sections:
            subs = (
                ExerciseSubmission.objects
                .filter(section=sec)
                .select_related('student__grade')
                .order_by('student_id', '-submitted_at')
            )
            seen_students = set()
            for sub in subs:
                if sub.student_id not in seen_students:
                    seen_students.add(sub.student_id)
                    sid = sub.student_id
                    student_map[sid]['name']  = sub.student.name
                    student_map[sid]['grade'] = sub.student.grade.name if sub.student.grade_id else ''
                    student_map[sid]['results'][str(sec.id)] = {
                        'score': sub.score, 'total': sub.total,
                        'percentage': sub.percentage,
                    }

        students_list = sorted([
            {
                'name': v['name'], 'grade': v['grade'],
                'results': [v['results'].get(ex['id']) for ex in exercises_meta],
            }
            for v in student_map.values()
        ], key=lambda x: x['name'])

        return Response({
            'lesson_title': lesson.title,
            'exercises': exercises_meta,
            'students': students_list,
        })


# ---------------------------------------------------------------------------
# Students available for a subject group (teacher assignment picker)
# ---------------------------------------------------------------------------

class GroupStudentsView(APIView):
    """
    GET /content/subject-groups/<group_pk>/students/
    Returns students whose parent's center is one of the group's centers.
    Used by teachers to pick specific students when assigning a lesson.
    """
    permission_classes = [CanManageContent]

    def get(self, request, group_pk):
        try:
            group = SubjectGroup.objects.prefetch_related('centers').get(
                pk=group_pk, teacher=request.user, active=True
            )
        except SubjectGroup.DoesNotExist:
            return Response({'error': 'Subject group not found.'}, status=status.HTTP_404_NOT_FOUND)

        students = Student.objects.filter(
            parent__user__center__in=group.centers.all()
        ).select_related('parent__user', 'grade').order_by('name')

        data = [
            {
                'id': s.id,
                'name': s.name,
                'grade_id': s.grade_id,
                'grade_name': s.grade.name if s.grade else None,
            }
            for s in students
        ]
        return Response(data)


# ---------------------------------------------------------------------------
# Published content — read-only, for authenticated students / parents
# Filtered by center: users with a center only see content for that center.
# Staff (is_staff, center=None) bypass the filter and see all content.
# ---------------------------------------------------------------------------

class PublishedSubjectGroupListView(APIView):
    """
    GET /content/published/subject-groups/
    All active subject groups that have at least one published lesson,
    scoped to the requesting user's center.
    """
    permission_classes = [CanViewContent]

    def get(self, request):
        groups = (
            SubjectGroup.objects
            .filter(active=True)
            .select_related('teacher')
            .prefetch_related('centers')
            .order_by('subject_track', 'sort_order', 'created_at')
        )
        if request.user.center_id:
            groups = groups.filter(centers=request.user.center)
        student = _student_from_request(request)
        if student:
            groups = [
                g for g in groups
                if not g.target_grades.exists() or g.target_grades.filter(id=student.grade_id).exists()
            ]
        serializer = PublishedSubjectGroupSerializer(groups, many=True)
        return Response(serializer.data)


class PublishedLessonListView(APIView):
    """
    GET /content/published/subject-groups/<group_pk>/lessons/
    Published lessons within a subject group, enforcing center isolation.
    """
    permission_classes = [CanViewContent]

    def get(self, request, group_pk):
        try:
            group = SubjectGroup.objects.select_related('teacher').prefetch_related('centers').get(
                pk=group_pk, active=True
            )
        except SubjectGroup.DoesNotExist:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Enforce center isolation
        if request.user.center_id and not group.centers.filter(id=request.user.center_id).exists():
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        lessons = group.lessons.filter(published=True).order_by('sort_order', 'created_at')
        student = _student_from_request(request)
        if student:
            lessons = [
                l for l in lessons
                if not l.target_grades.exists()
                or l.target_grades.filter(id=student.grade_id).exists()
                or l.assigned_students.filter(id=student.id).exists()
            ]
        return Response(LessonListSerializer(lessons, many=True).data)


class PublishedLessonDetailView(APIView):
    """
    GET /content/published/lessons/<pk>/
    Full detail of a single published lesson including section tree,
    enforcing center isolation.
    """
    permission_classes = [CanViewContent]

    def get(self, request, pk):
        try:
            lesson = Lesson.objects.select_related('subject_group').prefetch_related('subject_group__centers').get(pk=pk, published=True)
        except Lesson.DoesNotExist:
            return Response({'error': 'Lesson not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Enforce center isolation
        if request.user.center_id and not lesson.subject_group.centers.filter(id=request.user.center_id).exists():
            return Response({'error': 'Lesson not found.'}, status=status.HTTP_404_NOT_FOUND)

        student = _student_from_request(request)
        if student and lesson.target_grades.exists():
            explicitly_assigned = lesson.assigned_students.filter(id=student.id).exists()
            grade_match = lesson.target_grades.filter(id=student.grade_id).exists()
            if not grade_match and not explicitly_assigned:
                return Response({'error': 'Lesson not found.'}, status=status.HTTP_404_NOT_FOUND)

        data = dict(LessonDetailSerializer(lesson).data)

        def _strip_question(q):
            if q.get('type') == 'word_scramble':
                # letters must reach the student (they are the puzzle tiles)
                return {k: v for k, v in q.items() if k not in ('caseSensitive',)}
            if q.get('type') == 'matching':
                pairs = q.get('pairs', [])
                options = [p['right'] for p in pairs]
                random.shuffle(options)
                sq = {k: v for k, v in q.items() if k != 'pairs'}
                sq['lefts']   = [{'id': p['id'], 'text': p['left']} for p in pairs]
                sq['options'] = options
                return sq
            return {k: v for k, v in q.items() if k not in ('correct', 'caseSensitive')}

        def _strip(sections):
            stripped = []
            for raw in sections:
                s = dict(raw)
                if s.get('type') == 'exercise' and isinstance(s.get('content_body'), dict):
                    body = dict(s['content_body'])
                    body['questions'] = [_strip_question(q) for q in body.get('questions', [])]
                    s['content_body'] = body
                if s.get('children'):
                    s['children'] = _strip(s['children'])
                stripped.append(s)
            return stripped

        data['sections'] = _strip(data.get('sections', []))
        return Response(data)


# ---------------------------------------------------------------------------
# Student Progress Dashboard
# ---------------------------------------------------------------------------

def _build_progress(student):
    """Aggregate lesson completion and exercise scores for a student."""
    all_submissions = ExerciseSubmission.objects.filter(student=student).select_related('section')

    # Best submission per exercise section (highest percentage)
    best = {}
    for sub in all_submissions:
        sid = sub.section_id
        if sid not in best or sub.percentage > best[sid]['pct']:
            best[sid] = {'pct': sub.percentage, 'submitted_at': sub.submitted_at}

    student_center = student.grade.center if student.grade else None
    groups_qs = SubjectGroup.objects.filter(active=True)
    if student_center:
        groups_qs = groups_qs.filter(centers=student_center)
    groups = (
        groups_qs
        .prefetch_related('centers', 'target_grades')
        .order_by('sort_order', 'created_at')
    )

    result_groups = []
    total_completed = 0
    total_lessons_with_exercises = 0
    all_scores = []

    for group in groups:
        lessons = group.lessons.filter(published=True).order_by('sort_order', 'created_at')
        lessons = [
            l for l in lessons
            if not l.target_grades.exists()
            or l.target_grades.filter(id=student.grade_id).exists()
            or l.assigned_students.filter(id=student.id).exists()
        ]
        if not lessons:
            continue

        group_completed = 0
        group_scores = []
        lesson_data_list = []

        for lesson in lessons:
            exercise_sections = list(
                lesson.sections.filter(type='exercise', active=True)
            )
            if not exercise_sections:
                lesson_data_list.append({
                    'id': str(lesson.id), 'title': lesson.title,
                    'has_exercises': False, 'completed': None,
                    'score': None, 'submitted_at': None,
                })
                continue

            total_lessons_with_exercises += 1
            scores = [best[s.id]['pct'] for s in exercise_sections if s.id in best]
            all_passed = len(scores) == len(exercise_sections) and all(p >= 70 for p in scores)
            avg_score = round(sum(scores) / len(scores)) if scores else None
            last_sub = max(
                (best[s.id]['submitted_at'] for s in exercise_sections if s.id in best),
                default=None,
            )
            if all_passed:
                group_completed += 1
                total_completed += 1
            if avg_score is not None:
                group_scores.append(avg_score)
                all_scores.append(avg_score)

            lesson_data_list.append({
                'id': str(lesson.id), 'title': lesson.title,
                'has_exercises': True, 'completed': all_passed,
                'score': avg_score,
                'submitted_at': last_sub.isoformat() if last_sub else None,
            })

        group_total = len([l for l in lesson_data_list if l['has_exercises']])
        result_groups.append({
            'id': str(group.id), 'title': group.title,
            'subject_track': group.subject_track,
            'lessons_completed': group_completed,
            'lessons_total': group_total,
            'completion_pct': round(group_completed / group_total * 100) if group_total else 0,
            'avg_score': round(sum(group_scores) / len(group_scores)) if group_scores else None,
            'lessons': lesson_data_list,
        })

    avg_score_all = round(sum(all_scores) / len(all_scores)) if all_scores else None
    return {
        'student': {
            'id': student.id,
            'name': student.name,
            'grade_name': student.grade.name if student.grade else '',
        },
        'overall': {
            'lessons_completed': total_completed,
            'lessons_total': total_lessons_with_exercises,
            'completion_pct': round(total_completed / total_lessons_with_exercises * 100)
                              if total_lessons_with_exercises else 0,
            'avg_score': avg_score_all,
        },
        'subject_groups': result_groups,
    }


class StudentProgressView(APIView):
    """
    GET /content/progress/student/<int:student_id>/
    Parent can view their own student; teachers can view any student in their groups.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, student_id):
        from accounts.models import Student as StudentModel, ParentProfile
        try:
            student = StudentModel.objects.select_related('grade', 'parent__user').get(pk=student_id)
        except StudentModel.DoesNotExist:
            return Response({'error': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Authorization: parent must own the student; teachers may access any
        if request.user.role == 'parent':
            try:
                parent_profile = request.user.parent_profile
            except ParentProfile.DoesNotExist:
                return Response({'error': 'Parent profile not found.'}, status=status.HTTP_404_NOT_FOUND)
            if student.parent_id != parent_profile.id:
                return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
        elif not (request.user.role == 'teacher' or request.user.is_staff):
            return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

        return Response(_build_progress(student))
