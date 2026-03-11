from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models
from django.db.models import F, Q
from django.db.models.signals import post_save
from django.dispatch import receiver

ACTIVITY_KEY_VALIDATOR = RegexValidator(
    regex=r"^[A-Za-z0-9][A-Za-z0-9_.-]*$",
    message="Activity key can only contain letters, numbers, underscore, period, and hyphen.",
)

CHECKPOINT_ID_VALIDATOR = RegexValidator(
    regex=r"^[A-Za-z0-9][A-Za-z0-9_-]*$",
    message="Checkpoint id can only contain letters, numbers, underscore, and hyphen.",
)


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


class TeacherStudent(models.Model):
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="teacher_students",
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="student_teachers",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("teacher_id", "student_id")
        unique_together = ("teacher", "student")

    def __str__(self) -> str:
        return f"{self.teacher.username} -> {self.student.username}"


class ActivityProgress(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="activity_progress",
    )
    activity_key = models.CharField(max_length=64, validators=[ACTIVITY_KEY_VALIDATOR])
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
        constraints = [
            models.CheckConstraint(
                check=Q(step_index__lte=F("step_count")),
                name="activityprogress_step_index_lte_step_count",
            ),
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
    activity_key = models.CharField(max_length=64, validators=[ACTIVITY_KEY_VALIDATOR])
    checkpoint_id = models.CharField(max_length=128, validators=[CHECKPOINT_ID_VALIDATOR])
    attempts = models.PositiveIntegerField(default=0)
    shown_level = models.PositiveSmallIntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(3)],
    )
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
        constraints = [
            models.CheckConstraint(
                check=Q(shown_level__gte=0) & Q(shown_level__lte=3),
                name="hintanalytics_shown_level_range",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user.username} - {self.activity_key}:{self.checkpoint_id}"


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def ensure_user_profile(sender, instance, created, **_kwargs):
    if created:
        Profile.objects.create(user=instance)
        UserProgressSummary.objects.create(user=instance)
