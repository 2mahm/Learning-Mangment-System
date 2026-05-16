"""
Content-app permission classes aligned with the project-wide PBAC system.

Both classes delegate to accounts.permissions._has_perm so that:
  - staff users are always allowed
  - permission checks go through Django's standard has_perm / caching layer
  - codenames stay in one canonical place (accounts/permissions.py)
"""

from accounts.permissions import CanManageContent, CanViewContent  # noqa: F401
