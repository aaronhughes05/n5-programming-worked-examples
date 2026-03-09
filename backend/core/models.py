from django.conf import settings
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


class Profile(models.Model):
    ROLE_TEACHER = "teacher"
    ROLE_STUDENT = "student"
    ROLE_CHOICES = (
        (ROLE_TEACHER, "Teacher"),
        (ROLE_STUDENT, "Student"),
    )

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_STUDENT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.user.username} ({self.role})"


class Classroom(models.Model):
    name = models.CharField(max_length=120)
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="classrooms",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name", "id")
        unique_together = ("teacher", "name")

    def __str__(self) -> str:
        return f"{self.name} ({self.teacher.username})"


class Enrollment(models.Model):
    classroom = models.ForeignKey(
        Classroom,
        on_delete=models.CASCADE,
        related_name="enrollments",
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="enrollments",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("classroom_id", "student_id")
        unique_together = ("classroom", "student")

    def __str__(self) -> str:
        return f"{self.student.username} in {self.classroom.name}"


class ActivityProgress(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="activity_progress",
    )
    activity_key = models.CharField(max_length=64)
    step_index = models.PositiveIntegerField(default=0)
    step_count = models.PositiveIntegerField(default=0)
    is_complete = models.BooleanField(default=False)
    completed_checks = models.JSONField(default=list, blank=True)
    inputs = models.JSONField(default=dict, blank=True)
    show_worked_example = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("user_id", "activity_key")
        unique_together = ("user", "activity_key")
        indexes = [
            models.Index(fields=("activity_key",)),
            models.Index(fields=("is_complete",)),
        ]

    def __str__(self) -> str:
        return f"{self.user.username} - {self.activity_key}"


class UserProgressSummary(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="progress_summary",
    )
    activities_started = models.PositiveIntegerField(default=0)
    activities_completed = models.PositiveIntegerField(default=0)
    examples_completed = models.PositiveIntegerField(default=0)
    assessment_completed = models.BooleanField(default=False)
    all_examples_completed = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("user_id",)

    def __str__(self) -> str:
        return f"{self.user.username} summary"


class HintAnalytics(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="hint_analytics",
    )
    activity_key = models.CharField(max_length=64)
    checkpoint_id = models.CharField(max_length=128)
    attempts = models.PositiveIntegerField(default=0)
    shown_level = models.PositiveSmallIntegerField(default=0)
    show_count = models.PositiveIntegerField(default=0)
    reveal_count = models.PositiveIntegerField(default=0)
    revealed_worked = models.BooleanField(default=False)
    last_used_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("user_id", "activity_key", "checkpoint_id")
        unique_together = ("user", "activity_key", "checkpoint_id")
        indexes = [
            models.Index(fields=("activity_key", "checkpoint_id")),
            models.Index(fields=("show_count", "reveal_count")),
        ]

    def __str__(self) -> str:
        return f"{self.user.username} - {self.activity_key}:{self.checkpoint_id}"


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def ensure_user_profile(sender, instance, created, **_kwargs):
    if created:
        Profile.objects.create(user=instance)
        UserProgressSummary.objects.create(user=instance)
