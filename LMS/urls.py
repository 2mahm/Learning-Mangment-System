from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from accounts.views import LoginView

urlpatterns = [
    path('admin/', admin.site.urls),

    # Token login: POST /api/auth/login/  → returns {"token": "..."}
    # Uses custom LoginView that enforces the can_login permission.
    path('api/auth/login/', LoginView.as_view(), name='api-token-auth'),

    # All accounts endpoints
    path('api/', include('accounts.urls')),

    # Content (subject groups, lessons, sections, book files)
    path('api/content/', include('content.urls')),

    # Attendance tracking
    path('api/attendance/', include('attendance.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
