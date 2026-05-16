from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import (
    Center,
    CustomUser,
    Grade,
    Invitation,
    ParentProfile,
    RegistrationRequest,
    Student,
    TeacherProfile,
)


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ['email', 'name', 'role', 'is_active', 'is_staff', 'is_deleted']
    list_filter = ['role', 'is_active', 'is_staff', 'is_deleted']
    search_fields = ['email', 'name']
    ordering = ['email']
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal Info', {'fields': ('name', 'role')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Status', {'fields': ('is_deleted',)}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'name', 'role', 'password1', 'password2'),
        }),
    )


@admin.register(Center)
class CenterAdmin(admin.ModelAdmin):
    list_display  = ['name', 'city', 'state', 'country', 'is_active', 'created_at']
    list_filter   = ['is_active', 'country', 'state']
    search_fields = ['name', 'city', 'state', 'country']
    ordering      = ['name']
    list_editable = ['is_active']


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ['role', 'email', 'token', 'is_used', 'expires_at', 'created_by']
    list_filter = ['role', 'is_used']
    search_fields = ['email']
    readonly_fields = ['token']


def _approve_request(reg_request):
    """Shared logic to approve a single RegistrationRequest."""
    from .models import ParentProfile, TeacherProfile

    if CustomUser.objects.filter(email=reg_request.email).exists():
        return False

    user = CustomUser(
        name=reg_request.name,
        email=reg_request.email,
        password=reg_request.password,
        role=reg_request.role,
        is_active=True,
    )
    user.save()

    if reg_request.role == 'teacher':
        TeacherProfile.objects.create(user=user)
    elif reg_request.role == 'parent':
        ParentProfile.objects.create(user=user)

    reg_request.invitation.is_used = True
    reg_request.invitation.save(update_fields=['is_used'])

    reg_request.status = 'approved'
    reg_request.save(update_fields=['status'])
    return True


@admin.register(RegistrationRequest)
class RegistrationRequestAdmin(admin.ModelAdmin):
    list_display = ['name', 'email', 'role', 'status', 'created_at']
    list_filter = ['status', 'role']
    search_fields = ['email', 'name']
    readonly_fields = ['name', 'email', 'role', 'invitation', 'created_at']
    actions = ['approve_requests', 'reject_requests']

    @admin.action(description='Approve selected registration requests')
    def approve_requests(self, request, queryset):
        approved = 0
        skipped = 0
        for reg_request in queryset.filter(status='pending'):
            if _approve_request(reg_request):
                approved += 1
            else:
                skipped += 1
        self.message_user(
            request,
            f'{approved} request(s) approved. {skipped} skipped (duplicate email).',
        )

    @admin.action(description='Reject selected registration requests')
    def reject_requests(self, request, queryset):
        updated = queryset.filter(status='pending').update(status='rejected')
        self.message_user(request, f'{updated} request(s) rejected.')


@admin.register(TeacherProfile)
class TeacherProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'subject']
    search_fields = ['user__email', 'user__name']


@admin.register(ParentProfile)
class ParentProfileAdmin(admin.ModelAdmin):
    list_display = ['user']
    search_fields = ['user__email', 'user__name']


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display  = ['name', 'grade', 'parent']
    search_fields = ['name', 'parent__user__email', 'grade__name']
    list_filter   = ['grade__center', 'grade']
    raw_id_fields = ['grade']


@admin.register(Grade)
class GradeAdmin(admin.ModelAdmin):
    list_display  = ['name', 'center', 'sort_order']
    list_filter   = ['center']
    search_fields = ['name', 'center__name']
    ordering      = ['center', 'sort_order', 'name']
