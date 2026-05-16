from rest_framework.authentication import BaseAuthentication

from .models import Student


class StudentTokenAuthentication(BaseAuthentication):
    """
    Accepts  Authorization: StudentToken <hex-token>
    Resolves the token to the student's parent user so that DRF permission
    checks (CanViewContent, center isolation via user.center) work unchanged.
    """

    def authenticate(self, request):
        auth = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth.startswith('StudentToken '):
            return None
        token = auth[len('StudentToken '):]
        try:
            student = Student.objects.select_related('parent__user').get(token=token)
            return (student.parent.user, student)
        except Student.DoesNotExist:
            return None

    def authenticate_header(self, request):
        return 'StudentToken'
