from django.contrib import admin
from django.http import JsonResponse
from django.urls import path
from core.views import (
    api_root,
    auth_login,
    auth_logout,
    auth_me,
    hints_checkpoint,
    progress_checkpoint,
    progress_detail,
    progress_summary,
    teacher_attempt_analytics,
    teacher_class_summary,
    teacher_export_csv,
    teacher_export_json,
)


def health(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health, name="health"),
    path("api/", api_root, name="api-root"),
    path("api/progress-summary", progress_summary, name="progress-summary"),
    path("api/progress/<str:activity_key>", progress_detail, name="progress-detail"),
    path("api/progress/<str:activity_key>/checkpoint", progress_checkpoint, name="progress-checkpoint"),
    path("api/hints/<str:activity_key>/<str:checkpoint_id>", hints_checkpoint, name="hints-checkpoint"),
    path("api/teacher/class-summary", teacher_class_summary, name="teacher-class-summary"),
    path("api/teacher/attempt-analytics", teacher_attempt_analytics, name="teacher-attempt-analytics"),
    path("api/teacher/export.json", teacher_export_json, name="teacher-export-json"),
    path("api/teacher/export.csv", teacher_export_csv, name="teacher-export-csv"),
    path("auth/login", auth_login, name="auth-login"),
    path("auth/logout", auth_logout, name="auth-logout"),
    path("auth/me", auth_me, name="auth-me"),
]
