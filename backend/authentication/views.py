from .models import CustomUser as User
from rest_framework import generics
from .serializers import UserSerializer
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.http import HttpRequest
import logging

logger = logging.getLogger(__name__)

# View genérica para criar um utilizador personalizado
class CreateUserView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]

@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def get_user(request: HttpRequest):
    serializer = UserSerializer(request.user)
    return Response(serializer.data)