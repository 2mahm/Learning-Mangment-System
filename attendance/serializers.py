from rest_framework import serializers

from .models import AttendanceRecord


class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.name', read_only=True)

    class Meta:
        model  = AttendanceRecord
        fields = ['id', 'student_id', 'student_name', 'date', 'status', 'notes']


class AttendanceBulkItemSerializer(serializers.Serializer):
    student_id = serializers.IntegerField()
    status     = serializers.ChoiceField(choices=['present', 'absent', 'late', 'excused'])
    notes      = serializers.CharField(required=False, allow_blank=True, default='')


class AttendanceSummarySerializer(serializers.Serializer):
    student_id     = serializers.IntegerField()
    student_name   = serializers.CharField()
    present_count  = serializers.IntegerField()
    absent_count   = serializers.IntegerField()
    late_count     = serializers.IntegerField()
    excused_count  = serializers.IntegerField()
    total_sessions = serializers.IntegerField()
    percentage     = serializers.FloatField()
