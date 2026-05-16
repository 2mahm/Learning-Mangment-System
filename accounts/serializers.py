import re

from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import Permission
from django.utils import timezone
from rest_framework import serializers

from .models import Center, CustomUser, Grade, Invitation, RegistrationRequest, Student, StudentRequest


# ---------------------------------------------------------------------------
# Center
# ---------------------------------------------------------------------------

class CenterSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Center
        fields = ['id', 'name', 'city', 'state', 'country', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


# ---------------------------------------------------------------------------
# Shared fields
# ---------------------------------------------------------------------------

class GradeField(serializers.PrimaryKeyRelatedField):
    """Accepts either a grade PK (int/numeric string) or a grade name string."""

    def to_internal_value(self, data):
        if isinstance(data, str) and not data.strip().lstrip('-').isdigit():
            qs = self.get_queryset()
            try:
                return qs.get(name=data)
            except Grade.DoesNotExist:
                raise serializers.ValidationError(f"Grade '{data}' not found.")
            except Grade.MultipleObjectsReturned:
                raise serializers.ValidationError(
                    f"Multiple grades named '{data}' exist. Send the grade ID instead."
                )
        return super().to_internal_value(data)


# ---------------------------------------------------------------------------
# Grade
# ---------------------------------------------------------------------------

class GradeSerializer(serializers.ModelSerializer):
    center_name = serializers.CharField(source='center.name', read_only=True)

    class Meta:
        model  = Grade
        fields = ['id', 'name', 'center', 'center_name', 'sort_order']
        read_only_fields = ['id', 'center_name']


# ---------------------------------------------------------------------------
# Invitation
# ---------------------------------------------------------------------------

class InvitationCreateSerializer(serializers.ModelSerializer):
    # Writable list of Permission PKs; only meaningful for center_admin role
    permission_ids = serializers.PrimaryKeyRelatedField(
        source='permissions',
        many=True,
        queryset=Permission.objects.all(),
        required=False,
    )
    center = serializers.PrimaryKeyRelatedField(
        queryset=Center.objects.filter(is_active=True),
        required=True,
    )

    class Meta:
        model = Invitation
        fields = ['id', 'email', 'role', 'token', 'expires_at', 'center', 'permission_ids']
        read_only_fields = ['id', 'token']

    def validate_email(self, value):
        if value:
            duplicate = Invitation.objects.filter(
                email=value,
                is_used=False,
                expires_at__gt=timezone.now(),
            ).exists()
            if duplicate:
                raise serializers.ValidationError(
                    'An active invitation has already been sent to this email address.'
                )
        return value

    def validate(self, data):
        perms = data.get('permissions', [])
        if perms and data.get('role') != 'center_admin':
            raise serializers.ValidationError({
                'permission_ids': 'Permissions can only be assigned to center_admin invitations.'
            })
        return data

    def create(self, validated_data):
        # M2M must be set after the instance is saved
        permissions = validated_data.pop('permissions', [])
        invitation = super().create(validated_data)
        if permissions:
            invitation.permissions.set(permissions)
        return invitation


class InvitationListSerializer(serializers.ModelSerializer):
    created_by_email = serializers.EmailField(source='created_by.email', read_only=True)
    permission_ids    = serializers.SerializerMethodField()
    permission_count  = serializers.SerializerMethodField()
    center_id   = serializers.IntegerField(source='center.id',   read_only=True)
    center_name = serializers.CharField(source='center.name', read_only=True)

    class Meta:
        model = Invitation
        fields = [
            'id', 'email', 'role', 'token', 'is_used',
            'expires_at', 'created_by_email',
            'center_id', 'center_name',
            'permission_ids', 'permission_count',
        ]

    def get_permission_ids(self, obj):
        return list(obj.permissions.values_list('id', flat=True))

    def get_permission_count(self, obj):
        return obj.permissions.count()


# ---------------------------------------------------------------------------
# Public registration
# ---------------------------------------------------------------------------

class RegisterSerializer(serializers.Serializer):
    token            = serializers.UUIDField(write_only=True)
    name             = serializers.CharField(max_length=150)
    email            = serializers.EmailField()
    password         = serializers.CharField(min_length=12, write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})

        password = data['password']
        email    = data['email']
        pwd_errors = []
        if len(re.findall(r'\d', password)) < 2:
            pwd_errors.append('at least 2 numbers')
        if len(re.findall(r'[^a-zA-Z0-9]', password)) < 2:
            pwd_errors.append('at least 2 special characters')
        if not re.search(r'[A-Z]', password):
            pwd_errors.append('at least 1 uppercase letter')
        if password == email:
            pwd_errors.append('must not match your email address')
        if pwd_errors:
            raise serializers.ValidationError(
                {'password': 'Password must contain ' + ', '.join(pwd_errors) + '.'}
            )

        try:
            invitation = Invitation.objects.get(token=data['token'])
        except Invitation.DoesNotExist:
            raise serializers.ValidationError({'token': 'Invalid invitation token.'})

        if not invitation.is_valid():
            raise serializers.ValidationError({'token': 'Invitation is expired or already used.'})

        if invitation.email and invitation.email != data['email']:
            raise serializers.ValidationError(
                {'email': 'This invitation is restricted to a specific email address.'}
            )

        if CustomUser.objects.filter(email=data['email']).exists():
            raise serializers.ValidationError({'email': 'A user with this email already exists.'})

        if RegistrationRequest.objects.filter(email=data['email'], status='pending').exists():
            raise serializers.ValidationError(
                {'email': 'A pending registration request with this email already exists.'}
            )

        data['invitation'] = invitation
        return data

    def create(self, validated_data):
        invitation = validated_data['invitation']
        return RegistrationRequest.objects.create(
            name=validated_data['name'],
            email=validated_data['email'],
            password=make_password(validated_data['password']),
            role=invitation.role,
            invitation=invitation,
        )


# ---------------------------------------------------------------------------
# Registration request
# ---------------------------------------------------------------------------

class RegistrationRequestSerializer(serializers.ModelSerializer):
    invitation_token = serializers.UUIDField(source='invitation.token', read_only=True)

    class Meta:
        model = RegistrationRequest
        fields = ['id', 'name', 'email', 'role', 'status', 'created_at', 'invitation_token']


# ---------------------------------------------------------------------------
# Student
# ---------------------------------------------------------------------------

class StudentSerializer(serializers.ModelSerializer):
    """Approved student – shown to parent. Includes username, never password."""
    grade      = GradeField(queryset=Grade.objects.all(), allow_null=True, required=False)
    grade_name = serializers.CharField(source='grade.name', read_only=True, default=None)

    class Meta:
        model  = Student
        fields = ['id', 'name', 'grade', 'grade_name', 'username']


# ---------------------------------------------------------------------------
# Student requests  (parent → admin approval flow)
# ---------------------------------------------------------------------------

class StudentRequestCreateSerializer(serializers.ModelSerializer):
    """Used by parent to submit a new student-add request."""
    grade      = GradeField(queryset=Grade.objects.all(), allow_null=True, required=False)
    grade_name = serializers.CharField(source='grade.name', read_only=True, default=None)

    class Meta:
        model  = StudentRequest
        fields = ['id', 'name', 'grade', 'grade_name', 'status', 'created_at']
        read_only_fields = ['id', 'status', 'created_at']


class StudentRequestListSerializer(serializers.ModelSerializer):
    """Used by admin to list pending requests; includes parent info."""
    parent_name  = serializers.CharField(source='parent.user.name',  read_only=True)
    parent_email = serializers.CharField(source='parent.user.email', read_only=True)
    grade_name   = serializers.CharField(source='grade.name', read_only=True, default=None)

    class Meta:
        model  = StudentRequest
        fields = ['id', 'name', 'grade', 'grade_name', 'parent_name', 'parent_email', 'status', 'created_at']


# ---------------------------------------------------------------------------
# User management  (admin only)
# ---------------------------------------------------------------------------

class UserListSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CustomUser
        fields = ['id', 'name', 'email', 'role', 'is_active', 'is_staff', 'is_deleted']


class UserDetailSerializer(serializers.ModelSerializer):
    permission_ids = serializers.SerializerMethodField()

    class Meta:
        model  = CustomUser
        fields = ['id', 'name', 'email', 'role', 'is_active', 'is_staff', 'is_deleted', 'permission_ids']

    def get_permission_ids(self, obj):
        # Staff (full admins) implicitly have every permission – return all
        # accounts-app permission IDs so every checkbox appears checked in the UI.
        if obj.is_staff:
            return list(
                Permission.objects
                .filter(content_type__app_label='accounts')
                .values_list('id', flat=True)
            )
        return list(obj.user_permissions.values_list('id', flat=True))


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CustomUser
        fields = ['name', 'email', 'role', 'is_active', 'is_staff', 'is_deleted']

    def validate_email(self, value):
        qs = CustomUser.objects.filter(email=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value


# ---------------------------------------------------------------------------
# Permissions management  (admin only)
# ---------------------------------------------------------------------------

class PermissionSerializer(serializers.ModelSerializer):
    model_name = serializers.SerializerMethodField()

    class Meta:
        model  = Permission
        fields = ['id', 'name', 'codename', 'model_name']

    def get_model_name(self, obj):
        # Group all can_* codenames under a dedicated "Access Control" section
        # so they appear at the top of permission panels in the UI.
        if obj.codename.startswith('can_'):
            return 'Access Control'
        return obj.content_type.model
