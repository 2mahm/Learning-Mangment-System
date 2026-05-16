"""
Custom permission codenames and DRF permission classes for the accounts app.

All codenames are defined as constants so views can import them without
typo-prone bare strings.  DRF permission classes read the user's *actual*
`user_permissions` M2M – full admins (is_staff) always bypass the check.
"""

from rest_framework.permissions import BasePermission

# ---------------------------------------------------------------------------
# Codename constants
# ---------------------------------------------------------------------------

PERM_LOGIN               = 'can_login'

PERM_VIEW_INVITATIONS    = 'can_view_invitations'
PERM_CREATE_INVITATION   = 'can_create_invitation'

PERM_VIEW_REQUESTS       = 'can_view_requests'
PERM_APPROVE_REQUEST     = 'can_approve_request'
PERM_REJECT_REQUEST      = 'can_reject_request'

PERM_VIEW_USERS          = 'can_view_users'
PERM_EDIT_USER           = 'can_edit_user'
PERM_DELETE_USER         = 'can_delete_user'
PERM_MANAGE_PERMISSIONS  = 'can_manage_permissions'

PERM_VIEW_STUDENTS       = 'can_view_students'
PERM_ADD_STUDENT         = 'can_add_student'

PERM_VIEW_STUDENT_REQUESTS    = 'can_view_student_requests'
PERM_APPROVE_STUDENT_REQUEST  = 'can_approve_student_request'
PERM_REJECT_STUDENT_REQUEST   = 'can_reject_student_request'

PERM_MANAGE_CONTENT  = 'can_manage_content'
PERM_VIEW_CONTENT    = 'can_view_content'
PERM_MANAGE_GRADES   = 'can_manage_grades'

PERM_MANAGE_ATTENDANCE = 'can_manage_attendance'
PERM_VIEW_ATTENDANCE   = 'can_view_attendance'


# ---------------------------------------------------------------------------
# Role permission groups
# Defines the exact set of permissions each role is allowed to hold.
# SUPER_ADMIN (is_staff=True) bypasses all checks implicitly.
# ---------------------------------------------------------------------------

ROLE_PERMISSIONS = {
    'parent': [
        PERM_LOGIN,
        PERM_VIEW_STUDENTS,
        PERM_ADD_STUDENT,
        PERM_VIEW_CONTENT,
        PERM_VIEW_ATTENDANCE,
    ],
    'teacher': [
        PERM_LOGIN,
        PERM_MANAGE_CONTENT,
        PERM_VIEW_CONTENT,
        PERM_MANAGE_ATTENDANCE,
    ],
    'center_admin': [
        PERM_LOGIN,
        PERM_VIEW_INVITATIONS,
        PERM_CREATE_INVITATION,
        PERM_VIEW_REQUESTS,
        PERM_APPROVE_REQUEST,
        PERM_REJECT_REQUEST,
        PERM_VIEW_USERS,
        PERM_EDIT_USER,
        PERM_DELETE_USER,
        PERM_MANAGE_PERMISSIONS,
        PERM_VIEW_STUDENT_REQUESTS,
        PERM_APPROVE_STUDENT_REQUEST,
        PERM_REJECT_STUDENT_REQUEST,
        PERM_VIEW_CONTENT,
        PERM_MANAGE_GRADES,
    ],
}


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def is_full_admin(user):
    """True when user is a Django staff member (bypasses all custom perm checks)."""
    return bool(user and user.is_authenticated and user.is_staff)


def _has_perm(user, codename):
    """
    Return True when the user has the given accounts-app permission OR is staff.
    Uses the standard Django `has_perm('accounts.<codename>')` call so Django's
    permission caching layer is respected.
    """
    if not (user and user.is_authenticated):
        return False
    if user.is_staff:
        return True
    return user.has_perm(f'accounts.{codename}')


# ---------------------------------------------------------------------------
# DRF permission classes
# ---------------------------------------------------------------------------

class CanLogin(BasePermission):
    """Checked inside LoginView before a token is issued."""
    message = 'Your account does not have login permission.'

    def has_permission(self, request, view):
        return _has_perm(request.user, PERM_LOGIN)


class CanViewInvitations(BasePermission):
    message = 'You do not have permission to view invitations.'

    def has_permission(self, request, view):
        return _has_perm(request.user, PERM_VIEW_INVITATIONS)


class CanCreateInvitation(BasePermission):
    message = 'You do not have permission to create invitations.'

    def has_permission(self, request, view):
        return _has_perm(request.user, PERM_CREATE_INVITATION)


class CanViewRequests(BasePermission):
    message = 'You do not have permission to view registration requests.'

    def has_permission(self, request, view):
        return _has_perm(request.user, PERM_VIEW_REQUESTS)


class CanApproveRequest(BasePermission):
    message = 'You do not have permission to approve registration requests.'

    def has_permission(self, request, view):
        return _has_perm(request.user, PERM_APPROVE_REQUEST)


class CanRejectRequest(BasePermission):
    message = 'You do not have permission to reject registration requests.'

    def has_permission(self, request, view):
        return _has_perm(request.user, PERM_REJECT_REQUEST)


class CanViewUsers(BasePermission):
    message = 'You do not have permission to view users.'

    def has_permission(self, request, view):
        return _has_perm(request.user, PERM_VIEW_USERS)


class CanEditUser(BasePermission):
    message = 'You do not have permission to edit users.'

    def has_permission(self, request, view):
        return _has_perm(request.user, PERM_EDIT_USER)


class CanDeleteUser(BasePermission):
    message = 'You do not have permission to delete users.'

    def has_permission(self, request, view):
        return _has_perm(request.user, PERM_DELETE_USER)


class CanManagePermissions(BasePermission):
    message = 'You do not have permission to manage user permissions.'

    def has_permission(self, request, view):
        return _has_perm(request.user, PERM_MANAGE_PERMISSIONS)


class CanViewStudents(BasePermission):
    message = 'You do not have permission to view students.'

    def has_permission(self, request, view):
        return _has_perm(request.user, PERM_VIEW_STUDENTS)


class CanAddStudent(BasePermission):
    message = 'You do not have permission to add students.'

    def has_permission(self, request, view):
        return _has_perm(request.user, PERM_ADD_STUDENT)


class CanViewStudentRequests(BasePermission):
    message = 'You do not have permission to view student requests.'

    def has_permission(self, request, view):
        return _has_perm(request.user, PERM_VIEW_STUDENT_REQUESTS)


class CanApproveStudentRequest(BasePermission):
    message = 'You do not have permission to approve student requests.'

    def has_permission(self, request, view):
        return _has_perm(request.user, PERM_APPROVE_STUDENT_REQUEST)


class CanRejectStudentRequest(BasePermission):
    message = 'You do not have permission to reject student requests.'

    def has_permission(self, request, view):
        return _has_perm(request.user, PERM_REJECT_STUDENT_REQUEST)


class CanManageContent(BasePermission):
    message = 'You do not have permission to manage content.'

    def has_permission(self, request, view):
        return _has_perm(request.user, PERM_MANAGE_CONTENT)


class CanViewContent(BasePermission):
    message = 'You do not have permission to view content.'

    def has_permission(self, request, view):
        return _has_perm(request.user, PERM_VIEW_CONTENT)


class CanManageGrades(BasePermission):
    message = 'You do not have permission to manage grades.'

    def has_permission(self, request, view):
        return _has_perm(request.user, PERM_MANAGE_GRADES)


class CanManageAttendance(BasePermission):
    message = 'You do not have permission to manage attendance.'

    def has_permission(self, request, view):
        return _has_perm(request.user, PERM_MANAGE_ATTENDANCE)


class CanViewAttendance(BasePermission):
    message = 'You do not have permission to view attendance.'

    def has_permission(self, request, view):
        return _has_perm(request.user, PERM_VIEW_ATTENDANCE)
