from rest_framework import serializers

from accounts.models import Center, Grade, Student
from accounts.serializers import GradeSerializer
from .models import BookFile, Lesson, LessonSection, SubjectGroup


# ---------------------------------------------------------------------------
# Subject Group
# ---------------------------------------------------------------------------

class SubjectGroupSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source='teacher.name', read_only=True)
    centers      = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Center.objects.filter(is_active=True),
        required=False,
    )
    center_names = serializers.SerializerMethodField()
    target_grades = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Grade.objects.all(),
        required=False,
    )
    target_grade_details = serializers.SerializerMethodField()
    lesson_count = serializers.SerializerMethodField()
    file_count   = serializers.SerializerMethodField()

    class Meta:
        model = SubjectGroup
        fields = [
            'id', 'teacher_name', 'centers', 'center_names', 'subject_track', 'title', 'description',
            'target_grades', 'target_grade_details', 'sort_order', 'active', 'created_at',
            'lesson_count', 'file_count',
        ]
        read_only_fields = ['id', 'teacher_name', 'center_names', 'target_grade_details', 'created_at', 'lesson_count', 'file_count']

    def get_center_names(self, obj):
        return [c.name for c in obj.centers.all()]

    def get_target_grade_details(self, obj):
        return GradeSerializer(obj.target_grades.all(), many=True).data

    def get_lesson_count(self, obj):
        return obj.lessons.count()

    def get_file_count(self, obj):
        return obj.book_files.count()


# ---------------------------------------------------------------------------
# Book File
# ---------------------------------------------------------------------------

class BookFileSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = BookFile
        fields = ['id', 'title', 'file', 'file_url', 'file_type', 'sort_order', 'uploaded_at']
        read_only_fields = ['id', 'file_url', 'uploaded_at']
        extra_kwargs = {
            'file': {'write_only': True},
        }

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None


# ---------------------------------------------------------------------------
# Lesson
# ---------------------------------------------------------------------------

class LessonListSerializer(serializers.ModelSerializer):
    """Used for list views and create/update — no sections included."""
    target_grades = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Grade.objects.all(),
        required=False,
    )
    target_grade_details = serializers.SerializerMethodField()
    assigned_students = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Student.objects.all(),
        required=False,
    )
    assigned_student_names = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = [
            'id', 'subject_group', 'title', 'description',
            'sort_order', 'published',
            'target_grades', 'target_grade_details',
            'assigned_students', 'assigned_student_names',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'subject_group', 'target_grade_details', 'assigned_student_names', 'created_at', 'updated_at']

    def get_target_grade_details(self, obj):
        return GradeSerializer(obj.target_grades.all(), many=True).data

    def get_assigned_student_names(self, obj):
        return [{'id': s.id, 'name': s.name} for s in obj.assigned_students.all()]


class LessonDetailSerializer(serializers.ModelSerializer):
    """Used for the lesson editor — includes the full nested section tree."""
    sections = serializers.SerializerMethodField()
    target_grades = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Grade.objects.all(),
        required=False,
    )
    target_grade_details = serializers.SerializerMethodField()
    assigned_students = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Student.objects.all(),
        required=False,
    )
    assigned_student_names = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = [
            'id', 'subject_group', 'title', 'description',
            'sort_order', 'published',
            'target_grades', 'target_grade_details',
            'assigned_students', 'assigned_student_names',
            'created_at', 'updated_at', 'sections',
        ]
        read_only_fields = ['id', 'subject_group', 'target_grade_details', 'assigned_student_names', 'created_at', 'updated_at']

    def get_sections(self, obj):
        top_level = (
            obj.sections
            .filter(parent__isnull=True, active=True)
            .order_by('sort_order')
        )
        return LessonSectionSerializer(top_level, many=True).data

    def get_target_grade_details(self, obj):
        return GradeSerializer(obj.target_grades.all(), many=True).data

    def get_assigned_student_names(self, obj):
        return [{'id': s.id, 'name': s.name} for s in obj.assigned_students.all()]


# ---------------------------------------------------------------------------
# Lesson Section
# ---------------------------------------------------------------------------

class LessonSectionSerializer(serializers.ModelSerializer):
    """
    Read serializer — recursively nests children so the frontend gets
    the full section tree in one response.
    """
    children = serializers.SerializerMethodField()

    class Meta:
        model = LessonSection
        fields = [
            'id', 'parent', 'sort_order', 'depth',
            'type', 'title', 'content_body', 'active', 'children',
        ]

    def get_children(self, obj):
        active_children = obj.children.filter(active=True).order_by('sort_order')
        return LessonSectionSerializer(active_children, many=True).data


class LessonSectionWriteSerializer(serializers.ModelSerializer):
    """
    Write serializer for creating a section.
    depth and sort_order are computed server-side.
    """

    class Meta:
        model = LessonSection
        fields = ['id', 'parent', 'type', 'title', 'content_body']
        read_only_fields = ['id']

    def create(self, validated_data):
        lesson = self.context['lesson']
        parent = validated_data.get('parent')

        depth = 0 if not parent else parent.depth + 1
        sort_order = LessonSection.objects.filter(
            lesson=lesson,
            parent=parent,
            active=True,
        ).count()

        return LessonSection.objects.create(
            lesson=lesson,
            depth=depth,
            sort_order=sort_order,
            **validated_data,
        )


class SectionUpdateSerializer(serializers.ModelSerializer):
    """Partial update — only these fields can be changed after creation."""

    class Meta:
        model = LessonSection
        fields = ['type', 'title', 'content_body']


# ---------------------------------------------------------------------------
# Published content (student / parent view — read only)
# ---------------------------------------------------------------------------

class PublishedSubjectGroupSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source='teacher.name', read_only=True)
    center_names = serializers.SerializerMethodField()
    published_lesson_count = serializers.SerializerMethodField()
    target_grade_details = serializers.SerializerMethodField()

    class Meta:
        model = SubjectGroup
        fields = [
            'id', 'teacher_name', 'center_names', 'subject_track',
            'title', 'description', 'target_grade_details', 'published_lesson_count',
        ]

    def get_center_names(self, obj):
        return [c.name for c in obj.centers.all()]

    def get_target_grade_details(self, obj):
        return GradeSerializer(obj.target_grades.all(), many=True).data

    def get_published_lesson_count(self, obj):
        return obj.lessons.filter(published=True).count()


# ---------------------------------------------------------------------------
# Reorder
# ---------------------------------------------------------------------------

class ReorderSerializer(serializers.Serializer):
    order = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        help_text='Ordered list of UUIDs — first item gets sort_order=0.',
    )
