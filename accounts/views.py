import logging
import os
import re
import secrets
import string
import uuid

from django.conf import settings
from django.contrib.auth import authenticate
from django.db import IntegrityError

logger = logging.getLogger(__name__)
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import Permission
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Center, CustomUser, Grade, Invitation, Notification, ParentProfile, RegistrationRequest, Student, StudentRequest, TeacherProfile
from .utils import (
    notify,
    send_invite_email,
    send_registration_approved_email,
    send_student_approved_email,
    send_student_request_received_email,
)
from .permissions import (
    PERM_ADD_STUDENT,
    is_full_admin,
    PERM_APPROVE_STUDENT_REQUEST,
    PERM_LOGIN,
    PERM_MANAGE_CONTENT,
    PERM_REJECT_STUDENT_REQUEST,
    PERM_VIEW_CONTENT,
    PERM_VIEW_STUDENT_REQUESTS,
    PERM_VIEW_STUDENTS,
    ROLE_PERMISSIONS,
    CanAddStudent,
    CanApproveRequest,
    CanApproveStudentRequest,
    CanCreateInvitation,
    CanDeleteUser,
    CanEditUser,
    CanManageGrades,
    CanManagePermissions,
    CanRejectRequest,
    CanRejectStudentRequest,
    CanViewInvitations,
    CanViewRequests,
    CanViewStudentRequests,
    CanViewStudents,
    CanViewUsers,
)
from .serializers import (
    CenterSerializer,
    GradeSerializer,
    InvitationCreateSerializer,
    InvitationListSerializer,
    PermissionSerializer,
    RegisterSerializer,
    RegistrationRequestSerializer,
    StudentRequestCreateSerializer,
    StudentRequestListSerializer,
    StudentSerializer,
    UserDetailSerializer,
    UserListSerializer,
    UserUpdateSerializer,
)


# ---------------------------------------------------------------------------
# Centers
# ---------------------------------------------------------------------------

class CenterListCreateView(APIView):
    """
    GET  /centers/ – public, returns all active centers (used by invitation dropdown).
    POST /centers/ – staff only, creates a new center.
    """
    permission_classes = []

    def get(self, request):
        centers = Center.objects.filter(is_active=True).order_by('name')
        return Response(CenterSerializer(centers, many=True).data)

    def post(self, request):
        if not (request.user and request.user.is_authenticated and request.user.is_staff):
            return Response({'error': 'Only super admins can create centers.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = CenterSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CenterDetailView(APIView):
    """
    GET    /centers/<pk>/ – staff only, returns a single center (including inactive).
    PATCH  /centers/<pk>/ – staff only, edit center fields.
    DELETE /centers/<pk>/ – staff only, deactivates the center (soft delete).
    """
    permission_classes = [IsAuthenticated]

    def _get_center(self, pk):
        try:
            return Center.objects.get(pk=pk)
        except Center.DoesNotExist:
            return None

    def _require_staff(self, request):
        if not request.user.is_staff:
            return Response({'error': 'Only super admins can manage centers.'}, status=status.HTTP_403_FORBIDDEN)
        return None

    def get(self, request, pk):
        err = self._require_staff(request)
        if err:
            return err
        center = self._get_center(pk)
        if not center:
            return Response({'error': 'Center not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(CenterSerializer(center).data)

    def patch(self, request, pk):
        err = self._require_staff(request)
        if err:
            return err
        center = self._get_center(pk)
        if not center:
            return Response({'error': 'Center not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = CenterSerializer(center, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        err = self._require_staff(request)
        if err:
            return err
        center = self._get_center(pk)
        if not center:
            return Response({'error': 'Center not found.'}, status=status.HTTP_404_NOT_FOUND)
        center.is_active = False
        center.save(update_fields=['is_active'])
        return Response({'message': f'Center "{center.name}" deactivated.'})


# ---------------------------------------------------------------------------
# Auth: Login  (replaces obtain_auth_token – enforces can_login permission)
# ---------------------------------------------------------------------------

class LoginView(APIView):
    """POST /auth/login/ – validate credentials, check can_login, return token."""
    permission_classes = []

    def post(self, request):
        email    = request.data.get('username') or request.data.get('email', '')
        password = request.data.get('password', '')

        user = authenticate(request, username=email, password=password)
        if not user:
            return Response({'non_field_errors': ['Unable to log in with provided credentials.']},
                            status=status.HTTP_400_BAD_REQUEST)

        # Staff (is_staff) always allowed; everyone else needs can_login permission
        if not user.is_staff:
            if not user.has_perm(f'accounts.{PERM_LOGIN}'):
                return Response(
                    {'non_field_errors': ['Your account does not have login permission.']},
                    status=status.HTTP_403_FORBIDDEN,
                )

        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key})


# ---------------------------------------------------------------------------
# Me
# ---------------------------------------------------------------------------

class MeView(APIView):
    """GET /me/ – return the authenticated user's profile including permission codenames.
       PATCH /me/ – update own name, email, or password."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        # Staff implicitly hold every permission – return all accounts-app codenames
        # so the frontend can treat them identically to explicitly-assigned permissions.
        if u.is_staff:
            perm_codenames = list(
                Permission.objects
                .filter(content_type__app_label='accounts')
                .values_list('codename', flat=True)
            )
        else:
            perm_codenames = list(
                u.user_permissions
                .filter(content_type__app_label='accounts')
                .values_list('codename', flat=True)
            )
        return Response({
            'id':          u.id,
            'name':        u.name,
            'email':       u.email,
            'role':        u.role,
            'is_staff':    u.is_staff,
            'permissions': perm_codenames,
        })

    def patch(self, request):
        u = request.user
        errors = {}

        name            = request.data.get('name', '').strip()
        email           = request.data.get('email', '').strip()
        current_password = request.data.get('current_password', '')
        new_password    = request.data.get('new_password', '')
        confirm_password = request.data.get('confirm_password', '')

        if name:
            u.name = name

        if email and email != u.email:
            if CustomUser.objects.filter(email=email).exclude(pk=u.pk).exists():
                errors['email'] = 'A user with this email already exists.'
            else:
                u.email = email

        changing_password = bool(current_password or new_password or confirm_password)
        if changing_password:
            if not current_password:
                errors['current_password'] = 'Current password is required.'
            elif not check_password(current_password, u.password):
                errors['current_password'] = 'Current password is incorrect.'
            if not new_password:
                errors['new_password'] = 'New password is required.'
            elif len(new_password) < 8:
                errors['new_password'] = 'Password must be at least 8 characters.'
            if new_password and new_password != confirm_password:
                errors['confirm_password'] = 'Passwords do not match.'

        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        if changing_password and new_password:
            u.password = make_password(new_password)

        u.save()
        return Response({
            'id':       u.id,
            'name':     u.name,
            'email':    u.email,
            'role':     u.role,
            'is_staff': u.is_staff,
        })


# ---------------------------------------------------------------------------
# Invitations  (GET needs can_view_invitations, POST needs can_create_invitation)
# ---------------------------------------------------------------------------

class InvitationView(APIView):

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated(), CanViewInvitations()]
        return [IsAuthenticated(), CanCreateInvitation()]

    def get(self, request):
        invitations = Invitation.objects.select_related('created_by', 'center').order_by('-id')
        # Center admins only see invitations for their own center
        if not request.user.is_staff and request.user.center_id:
            invitations = invitations.filter(center=request.user.center)
        return Response(InvitationListSerializer(invitations, many=True).data)

    def post(self, request):
        data = request.data.copy()
        # Center admins can only create invitations for their own center
        if not request.user.is_staff and request.user.center_id:
            data['center'] = request.user.center_id
        serializer = InvitationCreateSerializer(data=data)
        if serializer.is_valid():
            invitation = serializer.save(created_by=request.user)
            frontend_origin = (
                request.META.get('HTTP_ORIGIN')
                or os.environ.get('SITE_BASE_URL', f"{request.scheme}://{request.get_host()}")
            ).rstrip('/')
            invite_link = f"{frontend_origin}/register?token={invitation.token}"
            response_data = serializer.data.copy()
            response_data['invite_link'] = invite_link
            if invitation.email:
                try:
                    send_invite_email(
                        to_email=invitation.email,
                        link=invite_link,
                        role=invitation.role,
                        center_name=invitation.center.name if invitation.center else "",
                        expires_at=str(invitation.expires_at.date()) if invitation.expires_at else "",
                    )
                except Exception:
                    logger.exception("Failed to send invitation email to %s", invitation.email)
            return Response(response_data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# Invitation delete  (DELETE /api/invitations/<pk>/)
# ---------------------------------------------------------------------------

class InvitationDeleteView(APIView):

    def get_permissions(self):
        return [IsAuthenticated(), CanCreateInvitation()]

    def delete(self, request, pk):
        try:
            invitation = Invitation.objects.get(pk=pk)
        except Invitation.DoesNotExist:
            return Response({'error': 'Invitation not found.'}, status=status.HTTP_404_NOT_FOUND)
        # Center admins can only delete invitations belonging to their own center
        if not request.user.is_staff and request.user.center_id:
            if invitation.center_id != request.user.center_id:
                return Response({'error': 'You do not have permission to delete this invitation.'}, status=status.HTTP_403_FORBIDDEN)
        invitation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Public: Register via invitation token
# ---------------------------------------------------------------------------

class RegisterView(APIView):
    permission_classes = []

    def get(self, request):
        token = request.query_params.get('token')
        if not token:
            return Response({'error': 'token query parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            invitation = Invitation.objects.get(token=token)
        except Invitation.DoesNotExist:
            return Response({'error': 'Invalid token.'}, status=status.HTTP_404_NOT_FOUND)
        if not invitation.is_valid():
            return Response({'error': 'Invitation is expired or already used.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            'role':             invitation.role,
            'restricted_email': invitation.email,
            'expires_at':       invitation.expires_at,
            'center_id':        invitation.center_id,
            'center_name':      invitation.center.name if invitation.center else None,
        })

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            reg_request = serializer.save()
            return Response(
                {'message': 'Registration request submitted successfully. Please wait for admin approval.',
                 'request_id': reg_request.id},
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# Registration Requests
# ---------------------------------------------------------------------------

class RegistrationRequestListView(APIView):

    def get_permissions(self):
        return [IsAuthenticated(), CanViewRequests()]

    def get(self, request):
        status_filter = request.query_params.get('status', 'pending')
        qs = (
            RegistrationRequest.objects
            .select_related('invitation')
            .filter(status=status_filter)
            .order_by('-created_at')
        )
        return Response(RegistrationRequestSerializer(qs, many=True).data)


class RegistrationRequestApproveView(APIView):

    def get_permissions(self):
        return [IsAuthenticated(), CanApproveRequest()]

    def post(self, request, pk):
        try:
            reg_request = RegistrationRequest.objects.select_related('invitation').get(
                pk=pk, status='pending'
            )
        except RegistrationRequest.DoesNotExist:
            return Response({'error': 'Pending registration request not found.'}, status=status.HTTP_404_NOT_FOUND)

        if CustomUser.objects.filter(email=reg_request.email).exists():
            return Response({'error': 'A user with this email already exists.'}, status=status.HTTP_400_BAD_REQUEST)

        invitation_center = reg_request.invitation.center

        user = CustomUser(
            name=reg_request.name,
            email=reg_request.email,
            password=reg_request.password,
            role=reg_request.role,
            is_active=True,
        )
        # Parents and center_admins belong to exactly one center
        if reg_request.role in ('parent', 'center_admin'):
            user.center = invitation_center
        user.save()

        if reg_request.role == 'teacher':
            teacher_profile = TeacherProfile.objects.create(user=user)
            # Assign the invitation's center as the teacher's initial center
            if invitation_center:
                teacher_profile.centers.add(invitation_center)
        elif reg_request.role == 'parent':
            ParentProfile.objects.create(user=user)

        # For center_admin: apply invitation-selected permissions (filtered to allowed set).
        # For all other roles: apply the fixed ROLE_PERMISSIONS defaults.
        role = reg_request.role
        allowed_codenames = ROLE_PERMISSIONS.get(role, [PERM_LOGIN])

        if role == 'center_admin':
            invitation_perms = reg_request.invitation.permissions.filter(
                codename__in=allowed_codenames,
                content_type__app_label='accounts',
            )
            if invitation_perms.exists():
                user.user_permissions.set(invitation_perms)
            # Always ensure can_login
            login_perm = Permission.objects.filter(
                codename=PERM_LOGIN, content_type__app_label='accounts'
            ).first()
            if login_perm:
                user.user_permissions.add(login_perm)
        else:
            default_perms = Permission.objects.filter(
                codename__in=allowed_codenames,
                content_type__app_label='accounts',
            )
            user.user_permissions.set(default_perms)

        reg_request.invitation.is_used = True
        reg_request.invitation.save(update_fields=['is_used'])
        reg_request.status = 'approved'
        reg_request.save(update_fields=['status'])

        frontend_origin = (
            request.META.get('HTTP_ORIGIN')
            or os.environ.get('SITE_BASE_URL', f"{request.scheme}://{request.get_host()}")
        ).rstrip('/')
        login_url = f"{frontend_origin}/login"

        try:
            send_registration_approved_email(
                to_email=user.email,
                name=user.name,
                role=user.role,
                center_name=invitation_center.name if invitation_center else "",
                login_url=login_url,
            )
        except Exception:
            logger.exception("Failed to send approval email to %s", user.email)

        notify(
            recipient_id=user.id,
            type='request_approved',
            title='Registration Approved',
            message=f'Welcome, {user.name}! Your account has been approved. You can now log in.',
            link='/login',
        )

        return Response({'message': f'User {user.email} approved and created successfully.'})


class RegistrationRequestRejectView(APIView):

    def get_permissions(self):
        return [IsAuthenticated(), CanRejectRequest()]

    def post(self, request, pk):
        try:
            reg_request = RegistrationRequest.objects.get(pk=pk, status='pending')
        except RegistrationRequest.DoesNotExist:
            return Response({'error': 'Pending registration request not found.'}, status=status.HTTP_404_NOT_FOUND)
        reg_request.status = 'rejected'
        reg_request.save(update_fields=['status'])
        return Response({'message': 'Registration request rejected.'})


# ---------------------------------------------------------------------------
# User management  (strict admin / is_staff OR fine-grained perms)
# ---------------------------------------------------------------------------

class UserListView(APIView):
    """GET /users/ – list all non-deleted users."""

    def get_permissions(self):
        return [IsAuthenticated(), CanViewUsers()]

    def get(self, request):
        users = CustomUser.objects.filter(is_deleted=False).order_by('id')
        return Response(UserListSerializer(users, many=True).data)


class DeletedUserListView(APIView):
    """GET /users/deleted/ – list soft-deleted users."""

    def get_permissions(self):
        return [IsAuthenticated(), CanViewUsers()]

    def get(self, request):
        users = CustomUser.objects.filter(is_deleted=True).order_by('id')
        return Response(UserListSerializer(users, many=True).data)


class UserDetailView(APIView):
    """GET / PATCH / DELETE /users/<id>/"""

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated(), CanViewUsers()]
        if self.request.method == 'PATCH':
            return [IsAuthenticated(), CanEditUser()]
        # DELETE
        return [IsAuthenticated(), CanDeleteUser()]

    def _get(self, pk):
        try:
            return CustomUser.objects.prefetch_related('user_permissions').get(pk=pk, is_deleted=False)
        except CustomUser.DoesNotExist:
            return None

    def get(self, request, pk):
        user = self._get(pk)
        if not user:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(UserDetailSerializer(user).data)

    def patch(self, request, pk):
        user = self._get(pk)
        if not user:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
        # Prevent admin from removing their own staff status
        if user.pk == request.user.pk and 'is_staff' in request.data:
            if not request.data.get('is_staff', True):
                return Response({'error': 'You cannot remove your own admin privileges.'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = UserUpdateSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            user.refresh_from_db()
            return Response(UserDetailSerializer(user).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        user = self._get(pk)
        if not user:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
        if user.pk == request.user.pk:
            return Response({'error': 'You cannot delete your own account.'}, status=status.HTTP_400_BAD_REQUEST)
        user.is_deleted = True
        user.is_active = False
        user.save(update_fields=['is_deleted', 'is_active'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserPermissionsView(APIView):
    """PUT /users/<id>/permissions/ – replace the user's permissions."""

    def get_permissions(self):
        return [IsAuthenticated(), CanManagePermissions()]

    def put(self, request, pk):
        try:
            user = CustomUser.objects.get(pk=pk)
        except CustomUser.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        if user.is_staff:
            return Response(
                {'error': 'Permissions for staff (super admin) are implicit and cannot be edited here.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        permission_ids = request.data.get('permission_ids', [])
        if not isinstance(permission_ids, list):
            return Response({'error': 'permission_ids must be a list of integers.'}, status=status.HTTP_400_BAD_REQUEST)

        permissions = Permission.objects.filter(id__in=permission_ids)
        user.user_permissions.set(permissions)
        user.refresh_from_db()

        return Response({
            'message':        'Permissions updated successfully.',
            'permission_ids': list(user.user_permissions.values_list('id', flat=True)),
        })


# ---------------------------------------------------------------------------
# Teacher center assignments  (GET + PUT /users/<id>/centers/)
# ---------------------------------------------------------------------------

class TeacherCentersView(APIView):
    """
    GET /users/<id>/centers/ — return the teacher's current centers.
    PUT /users/<id>/centers/ — replace the teacher's centers with the supplied list.
    Requires can_edit_user.  Only valid for teacher-role users.
    """

    def get_permissions(self):
        # Teachers may read their own centers; editing requires can_edit_user
        if self.request.method == 'GET' and str(self.request.user.pk) == str(self.kwargs.get('pk')):
            return [IsAuthenticated()]
        return [IsAuthenticated(), CanEditUser()]

    def _get_teacher(self, pk):
        try:
            user = CustomUser.objects.get(pk=pk, role='teacher')
            return user, user.teacher_profile
        except (CustomUser.DoesNotExist, TeacherProfile.DoesNotExist):
            return None, None

    def get(self, request, pk):
        user, profile = self._get_teacher(pk)
        if not user:
            return Response({'error': 'Teacher not found.'}, status=status.HTTP_404_NOT_FOUND)
        from .serializers import CenterSerializer
        centers = profile.centers.all()
        return Response(CenterSerializer(centers, many=True).data)

    def put(self, request, pk):
        user, profile = self._get_teacher(pk)
        if not user:
            return Response({'error': 'Teacher not found.'}, status=status.HTTP_404_NOT_FOUND)

        center_ids = request.data.get('center_ids', [])
        if not isinstance(center_ids, list):
            return Response({'error': 'center_ids must be a list.'}, status=status.HTTP_400_BAD_REQUEST)

        centers = Center.objects.filter(id__in=center_ids, is_active=True)
        if len(centers) != len(center_ids):
            return Response({'error': 'One or more center IDs are invalid or inactive.'}, status=status.HTTP_400_BAD_REQUEST)

        profile.centers.set(centers)
        from .serializers import CenterSerializer
        return Response(CenterSerializer(profile.centers.all(), many=True).data)


# ---------------------------------------------------------------------------
# Available permissions
# ---------------------------------------------------------------------------

class PermissionListView(APIView):
    """GET /permissions/ – list all accounts-app permissions for the UI."""

    def get_permissions(self):
        return [IsAuthenticated(), CanManagePermissions()]

    def get(self, request):
        perms = (
            Permission.objects
            .select_related('content_type')
            .filter(content_type__app_label='accounts')
            .order_by('content_type__model', 'codename')
        )
        return Response(PermissionSerializer(perms, many=True).data)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_parent_profile(user):
    if user.role != 'parent':
        return None, Response(
            {'error': 'Only parents can access this endpoint.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    try:
        return user.parent_profile, None
    except ParentProfile.DoesNotExist:
        return None, Response(
            {'error': 'Parent profile not found.'},
            status=status.HTTP_404_NOT_FOUND,
        )


# ---------------------------------------------------------------------------
# Parent: list approved students
# ---------------------------------------------------------------------------

class StudentView(APIView):
    """GET /students/ – parent lists their approved (created) students."""

    def get_permissions(self):
        return [IsAuthenticated(), CanViewStudents()]

    def get(self, request):
        parent_profile, error = _get_parent_profile(request.user)
        if error:
            return error
        qs = Student.objects.filter(parent=parent_profile)
        return Response(StudentSerializer(qs, many=True).data)


# ---------------------------------------------------------------------------
# Student requests  (parent creates; admin lists)
# ---------------------------------------------------------------------------

class StudentRequestView(APIView):
    """
    GET  /student-requests/
        Parent  → their own requests (all statuses)
        Admin   → all pending requests
    POST /student-requests/
        Parent  → submit a new student-add request
    """

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), CanAddStudent()]
        return [IsAuthenticated()]

    def get(self, request):
        user = request.user
        if user.role == 'parent':
            parent_profile, error = _get_parent_profile(user)
            if error:
                return error
            qs = StudentRequest.objects.filter(parent=parent_profile).order_by('-created_at')
            return Response(StudentRequestCreateSerializer(qs, many=True).data)

        # Admin / center_admin with can_view_student_requests
        if not CanViewStudentRequests().has_permission(request, self):
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        status_filter = request.query_params.get('status', 'pending')
        qs = (
            StudentRequest.objects
            .select_related('parent__user')
            .filter(status=status_filter)
            .order_by('-created_at')
        )
        return Response(StudentRequestListSerializer(qs, many=True).data)

    def post(self, request):
        parent_profile, error = _get_parent_profile(request.user)
        if error:
            return error
        serializer = StudentRequestCreateSerializer(data=request.data)
        if serializer.is_valid():
            student_req = serializer.save(parent=parent_profile)
            try:
                send_student_request_received_email(
                    to_email=request.user.email,
                    parent_name=request.user.name,
                    student_name=student_req.name,
                    grade=str(student_req.grade),
                )
            except Exception:
                logger.exception("Failed to send student request confirmation to %s", request.user.email)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


def _generate_unique_student_username(name: str) -> str:
    base = re.sub(r'[^a-z0-9]', '', name.lower()) or 'student'

    # Layer 1: 4-digit suffix — covers the common case cheaply
    for _ in range(20):
        username = f"{base}{secrets.randbelow(9000) + 1000}"
        if not Student.objects.filter(username=username).exists():
            return username

    # Layer 2: 6-digit suffix — reduces collision chance to ~1-in-a-million
    for _ in range(20):
        username = f"{base}{secrets.randbelow(900000) + 100000}"
        if not Student.objects.filter(username=username).exists():
            return username

    # Layer 3: UUID hex fallback — cryptographically unique, never collides
    return f"{base}{uuid.uuid4().hex[:8]}"


def _generate_student_password(length: int = 10) -> str:
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


class StudentRequestApproveView(APIView):
    """POST /student-requests/<pk>/approve/ – admin approves and auto-generates credentials."""

    def get_permissions(self):
        return [IsAuthenticated(), CanApproveStudentRequest()]

    def post(self, request, pk):
        try:
            req = StudentRequest.objects.select_related('parent').get(pk=pk, status='pending')
        except StudentRequest.DoesNotExist:
            return Response(
                {'error': 'Pending student request not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        grade_val = request.data.get('grade') or req.grade_id

        grade_obj = None
        if grade_val:
            try:
                grade_str = str(grade_val).strip()
                if grade_str.lstrip('-').isdigit():
                    grade_obj = Grade.objects.get(pk=int(grade_str))
                else:
                    grade_obj = Grade.objects.get(name=grade_str)
            except Grade.DoesNotExist:
                return Response({'grade': 'Invalid grade.'}, status=status.HTTP_400_BAD_REQUEST)

        username = _generate_unique_student_username(req.name)
        password = _generate_student_password()

        try:
            student = Student.objects.create(
                name=req.name,
                grade=grade_obj,
                parent=req.parent,
                username=username,
                password=make_password(password),
            )
        except IntegrityError:
            # Race condition: another request created the same username between check and insert
            username = _generate_unique_student_username(req.name)
            student = Student.objects.create(
                name=req.name,
                grade=grade_obj,
                parent=req.parent,
                username=username,
                password=make_password(password),
            )
        req.status = 'approved'
        req.save(update_fields=['status'])

        frontend_origin = (
            request.META.get('HTTP_ORIGIN')
            or os.environ.get('SITE_BASE_URL', f"{request.scheme}://{request.get_host()}")
        ).rstrip('/')
        login_url = f"{frontend_origin}/login"

        parent_user = req.parent.user
        try:
            send_student_approved_email(
                to_email=parent_user.email,
                parent_name=parent_user.name,
                student_name=student.name,
                grade=student.grade.name if student.grade else '',
                username=username,
                password=password,
                login_url=login_url,
            )
        except Exception:
            logger.exception("Failed to send student approval email to %s", parent_user.email)

        notify(
            recipient_id=parent_user.id,
            type='student_approved',
            title='Student Account Created',
            message=f'Your student "{student.name}" has been approved. Their username is: {username}',
            link='/parent/students',
        )

        return Response({
            'message': f'Student "{student.name}" approved.',
            'student': {
                'id':        student.id,
                'name':      student.name,
                'grade':     student.grade_id,
                'grade_name': student.grade.name if student.grade else None,
                'username':  student.username,
            },
        })


class StudentRequestRejectView(APIView):
    """POST /student-requests/<pk>/reject/"""

    def get_permissions(self):
        return [IsAuthenticated(), CanRejectStudentRequest()]

    def post(self, request, pk):  # noqa: ARG002
        try:
            req = StudentRequest.objects.get(pk=pk, status='pending')
        except StudentRequest.DoesNotExist:
            return Response(
                {'error': 'Pending student request not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        req.status = 'rejected'
        req.save(update_fields=['status'])
        return Response({'message': 'Student request rejected.'})


# ---------------------------------------------------------------------------
# Student login  (public)
# ---------------------------------------------------------------------------

class StudentPasswordView(APIView):
    """POST /students/<pk>/change-password/ – parent changes their student's password."""

    def get_permissions(self):
        return [IsAuthenticated(), CanViewStudents()]

    def post(self, request, pk):
        parent_profile, error = _get_parent_profile(request.user)
        if error:
            return error

        try:
            student = Student.objects.get(pk=pk, parent=parent_profile)
        except Student.DoesNotExist:
            return Response({'error': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

        new_password     = request.data.get('new_password', '')
        confirm_password = request.data.get('confirm_password', '')

        errors = {}
        if not new_password:
            errors['new_password'] = 'New password is required.'
        elif len(new_password) < 4:
            errors['new_password'] = 'Password must be at least 4 characters.'
        if new_password and new_password != confirm_password:
            errors['confirm_password'] = 'Passwords do not match.'

        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        student.password = make_password(new_password)
        student.save(update_fields=['password'])

        return Response({'message': f'Password for "{student.name}" updated successfully.'})


class StudentAvatarView(APIView):
    """POST /student-avatar/ – upload avatar. DELETE – remove avatar."""
    permission_classes = []

    ALLOWED_TYPES = {'image/jpeg', 'image/png', 'image/webp', 'image/gif'}
    MAX_SIZE = 5 * 1024 * 1024  # 5 MB

    def _get_student(self, request):
        auth = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth.startswith('StudentToken '):
            return None
        token = auth[len('StudentToken '):]
        try:
            return Student.objects.get(token=token)
        except Student.DoesNotExist:
            return None

    def post(self, request):
        student = self._get_student(request)
        if not student:
            return Response({'error': 'Unauthorized.'}, status=status.HTTP_401_UNAUTHORIZED)

        file = request.FILES.get('avatar')
        if not file:
            return Response({'error': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)
        if file.content_type not in self.ALLOWED_TYPES:
            return Response({'error': 'Only JPEG, PNG, WebP, or GIF images are allowed.'}, status=status.HTTP_400_BAD_REQUEST)
        if file.size > self.MAX_SIZE:
            return Response({'error': 'File size must not exceed 5 MB.'}, status=status.HTTP_400_BAD_REQUEST)

        # Remove old avatar file if it exists
        if student.avatar:
            old_path = student.avatar.path
            if os.path.isfile(old_path):
                os.remove(old_path)

        ext = os.path.splitext(file.name)[1].lower()
        file.name = f"{uuid.uuid4().hex}{ext}"
        student.avatar = file
        student.save(update_fields=['avatar'])

        avatar_url = request.build_absolute_uri(student.avatar.url)
        return Response({'avatar_url': avatar_url})

    def delete(self, request):
        student = self._get_student(request)
        if not student:
            return Response({'error': 'Unauthorized.'}, status=status.HTTP_401_UNAUTHORIZED)

        if student.avatar:
            old_path = student.avatar.path
            if os.path.isfile(old_path):
                os.remove(old_path)
            student.avatar = None
            student.save(update_fields=['avatar'])

        return Response({'avatar_url': None})


class GradeListCreateView(APIView):
    """
    GET  /grades/ — list grades visible to the current user.
      - Teachers: grades belonging to their assigned centers.
      - Staff / center_admin: all grades (optionally filtered by ?center=<id>).
    POST /grades/ — create a grade (requires can_manage_grades).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        center_id = request.query_params.get('center')
        if request.user.is_staff:
            qs = Grade.objects.select_related('center').all()
            if center_id:
                qs = qs.filter(center_id=center_id)
        elif hasattr(request.user, 'teacher_profile'):
            centers = request.user.teacher_profile.centers.all()
            qs = Grade.objects.select_related('center').filter(center__in=centers)
            if center_id:
                qs = qs.filter(center_id=center_id)
        elif request.user.center_id:
            qs = Grade.objects.select_related('center').filter(center_id=request.user.center_id)
        else:
            qs = Grade.objects.none()
        return Response(GradeSerializer(qs, many=True).data)

    def post(self, request):
        if not CanManageGrades().has_permission(request, self):
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = GradeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        center = serializer.validated_data['center']
        # Staff can manage any center; center_admin can only manage their own center
        if not request.user.is_staff and request.user.center_id != center.id:
            return Response({'error': 'You can only add grades to your own center.'}, status=status.HTTP_403_FORBIDDEN)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class GradeDetailView(APIView):
    """GET/PATCH/DELETE /grades/<pk>/"""
    permission_classes = [IsAuthenticated]

    def _get_grade(self, pk):
        try:
            return Grade.objects.select_related('center').get(pk=pk)
        except Grade.DoesNotExist:
            return None

    def get(self, request, pk):
        grade = self._get_grade(pk)
        if not grade:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(GradeSerializer(grade).data)

    def patch(self, request, pk):
        if not CanManageGrades().has_permission(request, self):
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        grade = self._get_grade(pk)
        if not grade:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not request.user.is_staff and request.user.center_id != grade.center_id:
            return Response({'error': 'You can only edit grades in your own center.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = GradeSerializer(grade, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        if not CanManageGrades().has_permission(request, self):
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        grade = self._get_grade(pk)
        if not grade:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not request.user.is_staff and request.user.center_id != grade.center_id:
            return Response({'error': 'You can only delete grades in your own center.'}, status=status.HTTP_403_FORBIDDEN)
        grade.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class StudentLoginView(APIView):
    """POST /student-login/ – student authenticates with username + password."""
    permission_classes = []

    def post(self, request):
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')

        if not username or not password:
            return Response(
                {'error': 'Username and password are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            student = Student.objects.select_related('parent__user', 'grade').get(username=username)
        except Student.DoesNotExist:
            return Response(
                {'error': 'Invalid username or password.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not check_password(password, student.password):
            return Response(
                {'error': 'Invalid username or password.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        avatar_url = (
            request.build_absolute_uri(student.avatar.url)
            if student.avatar else None
        )

        return Response({
            'id':          student.id,
            'name':        student.name,
            'grade':       student.grade_id,
            'grade_name':  student.grade.name if student.grade else None,
            'username':    student.username,
            'parent_name': student.parent.user.name,
            'token':       student.token,
            'avatar_url':  avatar_url,
        })


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

class NotificationListView(APIView):
    """GET /notifications/ – list the current user's notifications (unread first, last 50)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Notification.objects.filter(recipient=request.user).order_by('is_read', '-created_at')[:50]
        data = [
            {
                'id':         n.id,
                'type':       n.type,
                'title':      n.title,
                'message':    n.message,
                'is_read':    n.is_read,
                'link':       n.link,
                'created_at': n.created_at.isoformat(),
            }
            for n in qs
        ]
        unread_count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({'notifications': data, 'unread_count': unread_count})


class NotificationMarkReadView(APIView):
    """POST /notifications/mark-read/ – mark notifications as read.
    Body: {"ids": [1, 2, 3]}  – specific IDs, or empty body to mark all read."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ids = request.data.get('ids', [])
        qs = Notification.objects.filter(recipient=request.user, is_read=False)
        if ids:
            qs = qs.filter(id__in=ids)
        updated = qs.update(is_read=True)
        return Response({'marked_read': updated})


class NotificationDeleteView(APIView):
    """DELETE /notifications/<pk>/ – delete a single notification."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            n = Notification.objects.get(pk=pk, recipient=request.user)
        except Notification.DoesNotExist:
            return Response({'error': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)
        n.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
