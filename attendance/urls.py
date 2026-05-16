from django.urls import path

from .views import AttendanceByGroupView, AttendanceSummaryView, ParentAttendanceView

urlpatterns = [
    path('subject-groups/<uuid:group_pk>/',          AttendanceByGroupView.as_view(),  name='attendance-by-group'),
    path('subject-groups/<uuid:group_pk>/summary/',  AttendanceSummaryView.as_view(),  name='attendance-summary'),
    path('parent/',                                   ParentAttendanceView.as_view(),   name='attendance-parent'),
]
