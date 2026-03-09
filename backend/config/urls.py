from django.contrib import admin
from django.http import JsonResponse
from django.urls import path
from core.views import api_root, auth_login, auth_logout, auth_me


def health(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health, name="health"),
    path("api/", api_root, name="api-root"),
    path("auth/login", auth_login, name="auth-login"),
    path("auth/logout", auth_logout, name="auth-logout"),
    path("auth/me", auth_me, name="auth-me"),
]
