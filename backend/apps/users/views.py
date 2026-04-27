"""
Users App - Views
Handles user registration, authentication, profile management, and admin controls
"""

from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .serializers import (
    UserRegistrationSerializer,
    UserProfileSerializer,
    UserListSerializer,
    ChangePasswordSerializer,
    CustomTokenObtainPairSerializer,
    AdminUserUpdateSerializer,
)
from .permissions import IsAdminRole, IsNotBlocked


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    POST /api/users/login/
    Login with username/password, returns JWT access + refresh tokens.
    """
    serializer_class = CustomTokenObtainPairSerializer


class UserRegistrationView(generics.CreateAPIView):
    """
    POST /api/users/register/
    Register a new user (Buyer or Seller role).
    """
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response({
            'message': 'User registered successfully.',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': user.role,
            }
        }, status=status.HTTP_201_CREATED)


class UserProfileView(generics.RetrieveUpdateAPIView):
    """
    GET /api/users/profile/  - Get current user profile
    PUT/PATCH /api/users/profile/ - Update profile
    """
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsNotBlocked]

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    """
    POST /api/users/change-password/
    Change the authenticated user's password.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()
        return Response({'message': 'Password changed successfully.'})


class LogoutView(APIView):
    """
    POST /api/users/logout/
    Blacklist the refresh token to logout user.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({'message': 'Logged out successfully.'})
        except Exception:
            return Response(
                {'error': 'Invalid token.'},
                status=status.HTTP_400_BAD_REQUEST
            )


# ===================== ADMIN VIEWS =====================

class AdminUserListView(generics.ListAPIView):
    """
    GET /api/users/admin/users/
    Admin: List all users with filters.
    """
    serializer_class = UserListSerializer
    permission_classes = [IsAdminRole]
    queryset = User.objects.all().order_by('-created_at')
    filterset_fields = ['role', 'is_blocked', 'is_active']
    search_fields = ['username', 'email', 'first_name', 'last_name']


class AdminUserDetailView(generics.RetrieveUpdateAPIView):
    """
    GET /api/users/admin/users/<id>/   - Get user detail
    PATCH /api/users/admin/users/<id>/ - Block/unblock or change role
    """
    serializer_class = AdminUserUpdateSerializer
    permission_classes = [IsAdminRole]
    queryset = User.objects.all()

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)


class AdminBlockUserView(APIView):
    """
    POST /api/users/admin/users/<id>/block/
    Admin: Block or unblock a user.
    """
    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        if user.role == User.Role.ADMIN:
            return Response(
                {'error': 'Cannot block another admin.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.is_blocked = not user.is_blocked
        user.save()
        action = "blocked" if user.is_blocked else "unblocked"
        return Response({'message': f'User {action} successfully.'})
