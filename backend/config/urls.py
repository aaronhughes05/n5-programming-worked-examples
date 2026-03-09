from django.contrib import admin
from django.http import JsonResponse
from django.urls import path
from core.views import (
    api_root,
    auth_login,
    auth_logout,
    auth_me,
    examples_page,
    hints_checkpoint,
    home_page,
    login_page,
    progress_checkpoint,
    progress_detail,
    progress_summary,
    teacher_attempt_analytics,
    teacher_add_student,
    teacher_class_summary,
    teacher_classes,
    teacher_delete_class,
    teacher_export_csv,
    teacher_export_json,
    teacher_remove_student,
    teacher_student_analytics,
)


def health(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("login", login_page, name="login-page-noslash"),
    path("login/", login_page, name="login-page"),
    path("", home_page, name="home"),
    path("examples/<str:page_key>/", examples_page, name="examples-page"),
    path("assessment/", examples_page, {"page_key": "assessment"}, name="assessment-page"),
    path("teacher/", examples_page, {"page_key": "teacher"}, name="teacher-page"),
    path("worksheets/", examples_page, {"page_key": "worksheets"}, name="worksheets-page"),
    path("admin/", admin.site.urls),
    path("health/", health, name="health"),
    path("api/", api_root, name="api-root"),
    path("api/progress-summary", progress_summary, name="progress-summary"),
    path("api/progress/<str:activity_key>", progress_detail, name="progress-detail"),
    path("api/progress/<str:activity_key>/checkpoint", progress_checkpoint, name="progress-checkpoint"),
    path("api/hints/<str:activity_key>/<str:checkpoint_id>", hints_checkpoint, name="hints-checkpoint"),
    path("api/teacher/class-summary", teacher_class_summary, name="teacher-class-summary"),
    path("api/teacher/classes", teacher_classes, name="teacher-classes"),
    path("api/teacher/classes/<int:classroom_id>", teacher_delete_class, name="teacher-delete-class"),
    path("api/teacher/classes/<int:classroom_id>/students", teacher_add_student, name="teacher-add-student"),
    path("api/teacher/classes/<int:classroom_id>/students/<int:student_id>", teacher_remove_student, name="teacher-remove-student"),
    path("api/teacher/students/<int:student_id>/analytics", teacher_student_analytics, name="teacher-student-analytics"),
    path("api/teacher/attempt-analytics", teacher_attempt_analytics, name="teacher-attempt-analytics"),
    path("api/teacher/export.json", teacher_export_json, name="teacher-export-json"),
    path("api/teacher/export.csv", teacher_export_csv, name="teacher-export-csv"),
    path("auth/login", auth_login, name="auth-login"),
    path("auth/logout", auth_logout, name="auth-logout"),
    path("auth/me", auth_me, name="auth-me"),
]
