"""
Users App - Custom Permissions
Role-based access control for the auction system
"""

from rest_framework.permissions import BasePermission


class IsAdminRole(BasePermission):
    """Allow access only to Admin users."""

    message = "Access restricted to Admin users only."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role == 'ADMIN'
        )


class IsSellerRole(BasePermission):
    """Allow access only to Seller users."""

    message = "Access restricted to Seller users only."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role == 'SELLER'
        )


class IsBuyerRole(BasePermission):
    """Allow access only to Buyer users."""

    message = "Access restricted to Buyer users only."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role == 'BUYER'
        )


class IsSellerOrAdmin(BasePermission):
    """Allow access to Seller or Admin users."""

    message = "Access restricted to Seller or Admin users only."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role in ['SELLER', 'ADMIN']
        )


class IsNotBlocked(BasePermission):
    """Deny access to blocked users."""

    message = "Your account has been blocked. Contact administrator."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            not request.user.is_blocked
        )
