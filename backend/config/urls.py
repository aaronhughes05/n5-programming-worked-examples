from django.contrib import admin
from django.http import JsonResponse
from django.urls import path
from core.views import api_root


def health(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health, name="health"),
    path("api/", api_root, name="api-root"),
]
