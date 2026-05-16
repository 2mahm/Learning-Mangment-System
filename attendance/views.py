from collections import defaultdict

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Student
from accounts.permissions import CanManageAttendance, CanViewAttendance
from content.models import SubjectGroup
from .models import AttendanceRecord
from .serializers import (
    AttendanceBulkItemSerializer,
    AttendanceRecordSerializer,
    AttendanceSummarySerializer,
)


def _get_group_for_teacher(group_pk, teacher):
    try:
        return SubjectGroup.objects.get(pk=group_pk, teacher=teacher, active=True)
    except SubjectGroup.DoesNotExist:
        return None


# ---------------------------------------------------------------------------
# Teacher: list / bulk-upsert attendance for a subject group on a given date
# ---------------------------------------------------------------------------

class AttendanceByGroupView(APIView):
    """
    GET  /api/attendance/subject-groups/<uuid>/?date=YYYY-MM-DD
         Returns attendance records for the group on a date.
         If no date given, returns today's records.

    POST /api/attendance/subject-groups/<uuid>/
         Body: [{"student_id": 1, "status": "present", "notes": ""}]
         Bulk upsert – creates or updates each record for the date in body.
         Body may also include a top-level "date" key; defaults to today.
    """
    permission_classes = [CanManageAttendance]

    def get(self, request, group_pk):
        group = _get_group_for_teacher(group_pk, request.user)
        if not group:
            return Response({'error': 'Subject group not found.'}, status=status.HTTP_404_NOT_FOUND)

        date = request.query_params.get('date')
        qs = AttendanceRecord.objects.filter(subject_group=group).select_related('student')
        if date:
            qs = qs.filter(date=date)
        return Response(AttendanceRecordSerializer(qs, many=True).data)

    def post(self, request, group_pk):
        group = _get_group_for_teacher(group_pk, request.user)
        if not group:
            return Response({'error': 'Subject group not found.'}, status=status.HTTP_404_NOT_FOUND)

        date = request.data.get('date') if isinstance(request.data, dict) else None
        records_data = request.data.get('records', request.data) if isinstance(request.data, dict) else request.data
        if not date and isinstance(request.data, dict):
            date = request.data.get('date')

        # Support both {"date": "...", "records": [...]} and just a flat list
        if isinstance(request.data, list):
            records_data = request.data
            date = None
        elif isinstance(request.data, dict):
            date = request.data.get('date')
            records_data = request.data.get('records', [])

        if not date:
            from django.utils import timezone
            date = timezone.now().date().isoformat()

        serializer = AttendanceBulkItemSerializer(data=records_data, many=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        saved = []
        for item in serializer.validated_data:
            student_id = item['student_id']
            try:
                student = Student.objects.get(pk=student_id)
            except Student.DoesNotExist:
                return Response(
                    {'error': f'Student {student_id} not found.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            record, _ = AttendanceRecord.objects.update_or_create(
                subject_group=group,
                student=student,
                date=date,
                defaults={
                    'status': item['status'],
                    'notes': item.get('notes', ''),
                    'recorded_by': request.user,
                },
            )
            saved.append(record)

        return Response(AttendanceRecordSerializer(saved, many=True).data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Teacher: per-student summary for a subject group
# ---------------------------------------------------------------------------

class AttendanceSummaryView(APIView):
    """GET /api/attendance/subject-groups/<uuid>/summary/"""
    permission_classes = [CanManageAttendance]

    def get(self, request, group_pk):
        group = _get_group_for_teacher(group_pk, request.user)
        if not group:
            return Response({'error': 'Subject group not found.'}, status=status.HTTP_404_NOT_FOUND)

        records = AttendanceRecord.objects.filter(subject_group=group).select_related('student')

        # Aggregate per student
        counts = defaultdict(lambda: {'student_name': '', 'present': 0, 'absent': 0, 'late': 0, 'excused': 0})
        for r in records:
            sid = r.student_id
            counts[sid]['student_name'] = r.student.name
            counts[sid][r.status] += 1

        summary = []
        for sid, c in counts.items():
            total = c['present'] + c['absent'] + c['late'] + c['excused']
            pct = round(c['present'] / total * 100, 1) if total else 0.0
            summary.append({
                'student_id':     sid,
                'student_name':   c['student_name'],
                'present_count':  c['present'],
                'absent_count':   c['absent'],
                'late_count':     c['late'],
                'excused_count':  c['excused'],
                'total_sessions': total,
                'percentage':     pct,
            })

        summary.sort(key=lambda x: x['student_name'])
        return Response(AttendanceSummarySerializer(summary, many=True).data)


# ---------------------------------------------------------------------------
# Parent: view attendance for all their students
# ---------------------------------------------------------------------------

class ParentAttendanceView(APIView):
    """GET /api/attendance/parent/ – parent sees all their students' attendance history."""
    permission_classes = [IsAuthenticated, CanViewAttendance]

    def get(self, request):
        if request.user.role != 'parent':
            return Response({'error': 'Only parents can access this endpoint.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            parent_profile = request.user.parent_profile
        except Exception:
            return Response({'error': 'Parent profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        students = Student.objects.filter(parent=parent_profile)
        result = []
        for student in students:
            records = (
                AttendanceRecord.objects
                .filter(student=student)
                .select_related('subject_group')
                .order_by('-date')
            )
            # Monthly summary
            month_counts = defaultdict(lambda: {'present': 0, 'absent': 0, 'late': 0, 'total': 0})
            history = []
            for r in records:
                month_key = r.date.strftime('%Y-%m')
                month_counts[month_key]['total'] += 1
                month_counts[month_key][r.status if r.status in ('present', 'absent', 'late') else 'present'] += 1
                history.append({
                    'date':         r.date.isoformat(),
                    'subject':      r.subject_group.title,
                    'status':       r.status,
                    'notes':        r.notes,
                })

            total_all = len(history)
            present_all = sum(1 for r in records if r.status == 'present')
            overall_pct = round(present_all / total_all * 100, 1) if total_all else 0.0

            result.append({
                'student_id':   student.id,
                'student_name': student.name,
                'grade_name':   student.grade.name if student.grade else '',
                'overall_pct':  overall_pct,
                'total_sessions': total_all,
                'history':      history,
            })

        return Response(result)
