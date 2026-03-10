from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core.models import (
    ActivityProgress,
    Classroom,
    Enrollment,
    HintAnalytics,
    Profile,
    TeacherStudent,
    UserProgressSummary,
)


class Command(BaseCommand):
    help = "Seed demo teacher/class/student progress data for presentations."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing demo teacher/class/students before seeding.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        User = get_user_model()

        teacher_username = "demo_teacher"
        student_usernames = ["demo_student_1", "demo_student_2", "demo_student_3"]
        default_password = "DemoPass123!"

        if options["reset"]:
            UserProgressSummary.objects.filter(user__username__in=[teacher_username, *student_usernames]).delete()
            HintAnalytics.objects.filter(user__username__in=[teacher_username, *student_usernames]).delete()
            ActivityProgress.objects.filter(user__username__in=[teacher_username, *student_usernames]).delete()
            Enrollment.objects.filter(student__username__in=student_usernames).delete()
            TeacherStudent.objects.filter(
                teacher__username=teacher_username,
                student__username__in=student_usernames,
            ).delete()
            Classroom.objects.filter(name="N5 Demo Class", teacher__username=teacher_username).delete()
            User.objects.filter(username__in=[teacher_username, *student_usernames]).delete()

        teacher, _ = User.objects.get_or_create(
            username=teacher_username,
            defaults={"email": "teacher.demo@example.com"},
        )
        teacher.set_password(default_password)
        teacher.save(update_fields=["password"])
        Profile.objects.update_or_create(user=teacher, defaults={"role": Profile.ROLE_TEACHER})
        UserProgressSummary.objects.get_or_create(user=teacher)

        classroom, _ = Classroom.objects.get_or_create(name="N5 Demo Class", teacher=teacher)

        students = []
        for i, username in enumerate(student_usernames, start=1):
            student, _ = User.objects.get_or_create(
                username=username,
                defaults={"email": f"student{i}.demo@example.com"},
            )
            student.set_password(default_password)
            student.save(update_fields=["password"])
            Profile.objects.update_or_create(user=student, defaults={"role": Profile.ROLE_STUDENT})
            UserProgressSummary.objects.get_or_create(user=student)
            Enrollment.objects.get_or_create(classroom=classroom, student=student)
            TeacherStudent.objects.get_or_create(teacher=teacher, student=student)
            students.append(student)

        now = timezone.now()

        # Student 1: mostly complete
        s1 = students[0]
        ActivityProgress.objects.update_or_create(
            user=s1,
            activity_key="example1",
            defaults={
                "step_index": 9,
                "step_count": 10,
                "is_complete": True,
                "completed_checks": [
                    "tick1",
                    "tick2",
                    "tick3",
                    "tick4",
                    "fullCode",
                    "ex1SgATick",
                    "ex1SgBTick",
                    "ex1SgCTick",
                    "ex1SgDTick",
                    "ex1TraceTick",
                    "ex1ModifyTick",
                    "makeOutputTick",
                ],
                "inputs": {"pred3": "len(username) < 5", "pred4": "retry"},
                "show_worked_example": True,
            },
        )
        ActivityProgress.objects.update_or_create(
            user=s1,
            activity_key="example2",
            defaults={
                "step_index": 8,
                "step_count": 9,
                "is_complete": False,
                "completed_checks": ["tick1", "tick2Pred", "tick3Pred", "tick4Pred", "fullCode", "sgA2Tick"],
                "inputs": {"pred1": "5", "pred3": "total", "pred4": "0"},
                "show_worked_example": False,
            },
        )

        # Student 2: in progress
        s2 = students[1]
        ActivityProgress.objects.update_or_create(
            user=s2,
            activity_key="example1",
            defaults={
                "step_index": 3,
                "step_count": 10,
                "is_complete": False,
                "completed_checks": ["tick1", "tick2", "tick3", "tick4", "fullCode"],
                "inputs": {"pred3": "len(username) < 5", "pred4": "retry"},
                "show_worked_example": False,
            },
        )
        ActivityProgress.objects.update_or_create(
            user=s2,
            activity_key="example2",
            defaults={
                "step_index": 1,
                "step_count": 9,
                "is_complete": False,
                "completed_checks": ["tick1"],
                "inputs": {"pred1": "5"},
                "show_worked_example": False,
            },
        )

        # Student 3: not started much
        s3 = students[2]
        ActivityProgress.objects.update_or_create(
            user=s3,
            activity_key="example1",
            defaults={
                "step_index": 0,
                "step_count": 10,
                "is_complete": False,
                "completed_checks": [],
                "inputs": {},
                "show_worked_example": False,
            },
        )

        hint_rows = [
            # student, activity, checkpoint, attempts, shown_level, show_count, reveal_count, revealed_worked
            (s1, "example1", "tick2", 2, 2, 2, 1, True),
            (s1, "example1", "ex1ModifyTick", 3, 3, 3, 1, True),
            (s1, "example2", "sgB2Tick", 2, 2, 2, 0, False),
            (s2, "example1", "tick3", 2, 1, 1, 0, False),
            (s2, "example2", "tick2", 3, 2, 2, 1, True),
            (s3, "example1", "tick1", 1, 1, 1, 0, False),
        ]
        for user, activity_key, checkpoint_id, attempts, shown_level, show_count, reveal_count, revealed in hint_rows:
            HintAnalytics.objects.update_or_create(
                user=user,
                activity_key=activity_key,
                checkpoint_id=checkpoint_id,
                defaults={
                    "attempts": attempts,
                    "shown_level": shown_level,
                    "show_count": show_count,
                    "reveal_count": reveal_count,
                    "revealed_worked": revealed,
                    "last_used_at": now,
                },
            )

        # Update summary snapshots for students.
        for student in students:
            rows = list(ActivityProgress.objects.filter(user=student))
            started = 0
            completed = 0
            normalized_completed = set()
            for row in rows:
                started += 1
                if row.is_complete:
                    completed += 1
                    normalized_completed.add(str(row.activity_key).lower())

            example_keys = {"example1", "example2", "example3"}
            UserProgressSummary.objects.update_or_create(
                user=student,
                defaults={
                    "activities_started": started,
                    "activities_completed": completed,
                    "examples_completed": len(example_keys.intersection(normalized_completed)),
                    "assessment_completed": "assessment" in normalized_completed,
                    "all_examples_completed": example_keys.issubset(normalized_completed),
                },
            )

        self.stdout.write(self.style.SUCCESS("Demo teacher data seeded."))
        self.stdout.write(self.style.SUCCESS(f"Teacher login: {teacher_username} / {default_password}"))
        self.stdout.write(self.style.SUCCESS("Student logins: demo_student_1..3 / DemoPass123!"))
