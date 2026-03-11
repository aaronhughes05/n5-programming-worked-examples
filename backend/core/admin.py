from django.contrib import admin
from core.models import ActivityProgress, Classroom, Enrollment, HintAnalytics, Profile, TeacherStudent, UserProgressSummary


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "created_at", "updated_at")
    list_filter = ("role",)
    search_fields = ("user__username", "user__email")


@admin.register(Classroom)
class ClassroomAdmin(admin.ModelAdmin):
    list_display = ("name", "teacher", "created_at", "updated_at")
    list_filter = ("teacher",)
    search_fields = ("name", "teacher__username", "teacher__email")


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ("classroom", "student", "created_at")
    list_filter = ("classroom",)
    search_fields = ("classroom__name", "student__username", "student__email")


@admin.register(TeacherStudent)
class TeacherStudentAdmin(admin.ModelAdmin):
    list_display = ("teacher", "student", "created_at")
    list_filter = ("teacher",)
    search_fields = ("teacher__username", "student__username", "student__email")


@admin.register(ActivityProgress)
class ActivityProgressAdmin(admin.ModelAdmin):
    list_display = ("user", "activity_key", "step_index", "step_count", "is_complete", "updated_at")
    list_filter = ("activity_key", "is_complete")
    search_fields = ("user__username", "user__email", "activity_key")


@admin.register(HintAnalytics)
class HintAnalyticsAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "activity_key",
        "checkpoint_id",
        "attempts",
        "show_count",
        "reveal_count",
        "last_used_at",
    )
    list_filter = ("activity_key", "revealed_worked")
    search_fields = ("user__username", "user__email", "activity_key", "checkpoint_id")


@admin.register(UserProgressSummary)
class UserProgressSummaryAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "activities_started",
        "activities_completed",
        "examples_completed",
        "all_examples_completed",
        "assessment_completed",
        "updated_at",
    )
    search_fields = ("user__username", "user__email")
