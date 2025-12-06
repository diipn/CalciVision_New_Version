from django.contrib import admin
from django.urls import path, include
from authentication.views import CreateUserView, get_user
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.conf.urls.static import static
from django.conf import settings

urlpatterns = [
    path('admin/', admin.site.urls),
    
    path("api/user/register/", CreateUserView.as_view(), name="register"),
    path('api/token/', TokenObtainPairView.as_view(), name='get_token'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='refresh'),
    path("api-auth/", include("rest_framework.urls")),
    
    path('api/', include('api.urls')),
    path('me/', get_user, name='get_user_data'),
] 

# Permite acessar imagens através das configurações de MEDIA durante o desenvolvimento
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
