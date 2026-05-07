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
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone

from .models import User, PasswordResetOTP
from .serializers import (
    UserRegistrationSerializer,
    UserProfileSerializer,
    UserListSerializer,
    ChangePasswordSerializer,
    CustomTokenObtainPairSerializer,
    AdminUserUpdateSerializer,
    ForgotPasswordSerializer,
    VerifyOTPSerializer,
    ResetPasswordSerializer,
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
    Requires: old_password, new_password, confirm_new_password
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


# ===================== FORGOT / RESET PASSWORD =====================

class ForgotPasswordView(APIView):
    """
    POST /api/users/forgot-password/
    Send a 6-digit OTP to the user's registered email address.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        user = User.objects.get(email=email)

        # Invalidate any existing unused OTPs for this user
        PasswordResetOTP.objects.filter(user=user, is_used=False).update(is_used=True)

        # Generate and save new OTP
        otp_code = PasswordResetOTP.generate_otp()
        PasswordResetOTP.objects.create(user=user, otp=otp_code)

        # Send OTP via email
        try:
            send_mail(
                subject='BidZone – Password Reset OTP',
                message=(
                    f'Hello {user.first_name or user.username},\n\n'
                    f'Your OTP for password reset is: {otp_code}\n\n'
                    f'This OTP is valid for 10 minutes.\n'
                    f'If you did not request this, please ignore this email.\n\n'
                    f'– BidZone Team'
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )
        except Exception:
            return Response(
                {'error': 'Failed to send OTP email. Please try again later.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response({
            'message': f'OTP sent to {email}. Valid for 10 minutes.'
        }, status=status.HTTP_200_OK)

class VerifyOTPView(APIView):
    """
    POST /api/users/verify-otp/
    Verify the OTP before allowing password reset.
    Returns success so the frontend can proceed to the reset step.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        otp_code = serializer.validated_data['otp']

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {'error': 'No account found with this email address.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        otp_obj = (
            PasswordResetOTP.objects
            .filter(user=user, otp=otp_code, is_used=False)
            .order_by('-created_at')
            .first()
        )

        if not otp_obj or not otp_obj.is_valid():
            return Response(
                {'error': 'Invalid or expired OTP. Please request a new one.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response({'message': 'OTP verified successfully.'}, status=status.HTTP_200_OK)


class ResetPasswordView(APIView):
    """
    POST /api/users/reset-password/
    Reset the user's password after OTP verification.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        otp_code = serializer.validated_data['otp']
        new_password = serializer.validated_data['new_password']

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {'error': 'No account found with this email address.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        otp_obj = (
            PasswordResetOTP.objects
            .filter(user=user, otp=otp_code, is_used=False)
            .order_by('-created_at')
            .first()
        )

        if not otp_obj or not otp_obj.is_valid():
            return Response(
                {'error': 'Invalid or expired OTP. Please request a new one.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Set new password and mark OTP as used
        user.set_password(new_password)
        user.save()
        otp_obj.is_used = True
        otp_obj.save()

        return Response(
            {'message': 'Password reset successfully. You can now log in.'},
            status=status.HTTP_200_OK
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
