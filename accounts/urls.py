from django.urls import path

from .views import (
    CenterDetailView,
    CenterListCreateView,
    GradeDetailView,
    GradeListCreateView,
    InvitationView,
    InvitationDeleteView,
    TeacherCentersView,
    MeView,
    NotificationDeleteView,
    NotificationListView,
    NotificationMarkReadView,
    PermissionListView,
    RegisterView,
    RegistrationRequestApproveView,
    RegistrationRequestListView,
    RegistrationRequestRejectView,
    StudentAvatarView,
    StudentLoginView,
    StudentPasswordView,
    StudentRequestApproveView,
    StudentRequestRejectView,
    StudentRequestView,
    StudentView,
    DeletedUserListView,
    UserDetailView,
    UserListView,
    UserPermissionsView,
)

urlpatterns = [
    # Centers (GET public, POST/PATCH/DELETE staff only)
    path('centers/',          CenterListCreateView.as_view(), name='centers'),
    path('centers/<int:pk>/', CenterDetailView.as_view(),     name='center-detail'),

    # Current user info
    path('me/', MeView.as_view(), name='me'),

    # Admin + center_admin – invitations
    path('invitations/',          InvitationView.as_view(),       name='invitations'),
    path('invitations/<int:pk>/', InvitationDeleteView.as_view(), name='invitation-delete'),

    # Public – registration via token
    path('register/', RegisterView.as_view(), name='register'),

    # Admin + center_admin – registration requests
    path('registration-requests/',                          RegistrationRequestListView.as_view(),    name='registration-requests'),
    path('registration-requests/<int:pk>/approve/',         RegistrationRequestApproveView.as_view(), name='registration-request-approve'),
    path('registration-requests/<int:pk>/reject/',          RegistrationRequestRejectView.as_view(),  name='registration-request-reject'),

    # Strict admin – user management
    path('users/',                           UserListView.as_view(),        name='user-list'),
    path('users/deleted/',                   DeletedUserListView.as_view(), name='user-deleted-list'),
    path('users/<int:pk>/',                  UserDetailView.as_view(),      name='user-detail'),
    path('users/<int:pk>/permissions/',      UserPermissionsView.as_view(), name='user-permissions'),
    path('users/<int:pk>/centers/',          TeacherCentersView.as_view(),  name='teacher-centers'),

    # Strict admin – available permissions
    path('permissions/', PermissionListView.as_view(), name='permission-list'),

    # Parent – approved students list + change student password
    path('students/', StudentView.as_view(), name='students'),
    path('students/<int:pk>/change-password/', StudentPasswordView.as_view(), name='student-change-password'),

    # Parent + admin – student add requests
    path('student-requests/',                           StudentRequestView.as_view(),          name='student-requests'),
    path('student-requests/<int:pk>/approve/',          StudentRequestApproveView.as_view(),   name='student-request-approve'),
    path('student-requests/<int:pk>/reject/',           StudentRequestRejectView.as_view(),    name='student-request-reject'),

    # Grades – admin creates; teachers read filtered by their centers
    path('grades/',          GradeListCreateView.as_view(), name='grade-list'),
    path('grades/<int:pk>/', GradeDetailView.as_view(),     name='grade-detail'),

    # Public – student portal login
    path('student-login/', StudentLoginView.as_view(), name='student-login'),

    # Student portal – avatar upload / delete
    path('student-avatar/', StudentAvatarView.as_view(), name='student-avatar'),

    # Notifications
    path('notifications/',                  NotificationListView.as_view(),     name='notification-list'),
    path('notifications/mark-read/',        NotificationMarkReadView.as_view(), name='notification-mark-read'),
    path('notifications/<int:pk>/',         NotificationDeleteView.as_view(),   name='notification-delete'),
]
