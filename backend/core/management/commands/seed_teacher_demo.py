from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core.models import ActivityProgress, Classroom, Enrollment, HintAnalytics, Profile, TeacherStudent, UserProgressSummary


ACTIVITY_STEP_COUNT = 10
ACTIVITY_KEYS = ("example1", "example2", "example3", "assessment")
EXAMPLE_KEYS = {"example1", "example2", "example3"}
DEFAULT_PASSWORD = "DemoPass123!"

ACTIVITY_CHECKPOINTS = {
    "example1": [
        "tick1", "tick2", "tick3", "tick4", "fullCode",
        "ex1SgATick", "ex1SgBTick", "ex1SgCTick", "ex1SgDTick",
        "ex1TraceTick", "ex1ModifyTick", "makeOutputTick",
    ],
    "example2": [
        "tick1", "tick2Pred", "tick3Pred", "tick4Pred", "fullCode",
        "sgA2Tick", "sgB2Tick", "sgC2Tick", "sgD2Tick", "sgE2Tick",
        "tick2", "makeOutputTick",
    ],
    "example3": [
        "ex3Pred1Tick", "ex3Pred2Tick", "ex3Pred3Tick", "ex3Pred4Tick", "fullCode",
        "ex3SgATick", "ex3SgBTick", "ex3SgCTick", "ex3SgDTick", "ex3SgETick",
        "ex3ModifyTick", "makeOutputTick",
    ],
    "assessment": [
        "tick1", "tick2", "tick3", "tick4", "fullCode",
        "sgA1Tick", "sgB1Tick", "sgC1Tick", "sgD1Tick", "sgE1Tick",
        "assessmentFeedback", "makeOutputTick",
    ],
}

STUDENT_SPECS = [
    {"username": "ava_mitchell", "first_name": "Ava", "last_name": "Mitchell", "email": "ava.mitchell.demo@example.com"},
    {"username": "liam_morrison", "first_name": "Liam", "last_name": "Morrison", "email": "liam.morrison.demo@example.com"},
    {"username": "sophie_campbell", "first_name": "Sophie", "last_name": "Campbell", "email": "sophie.campbell.demo@example.com"},
    {"username": "jack_ross", "first_name": "Jack", "last_name": "Ross", "email": "jack.ross.demo@example.com"},
    {"username": "isla_mackay", "first_name": "Isla", "last_name": "MacKay", "email": "isla.mackay.demo@example.com"},
    {"username": "noah_douglas", "first_name": "Noah", "last_name": "Douglas", "email": "noah.douglas.demo@example.com"},
    {"username": "olivia_reid", "first_name": "Olivia", "last_name": "Reid", "email": "olivia.reid.demo@example.com"},
    {"username": "calum_fraser", "first_name": "Calum", "last_name": "Fraser", "email": "calum.fraser.demo@example.com"},
    {"username": "emma_stewart", "first_name": "Emma", "last_name": "Stewart", "email": "emma.stewart.demo@example.com"},
    {"username": "ewan_macleod", "first_name": "Ewan", "last_name": "MacLeod", "email": "ewan.macleod.demo@example.com"},
    {"username": "chloe_henderson", "first_name": "Chloe", "last_name": "Henderson", "email": "chloe.henderson.demo@example.com"},
    {"username": "ryan_paterson", "first_name": "Ryan", "last_name": "Paterson", "email": "ryan.paterson.demo@example.com"},
]

CLASSROOM_SPECS = [
    {
        "name": "N5 Period 3",
        "students": ["ava_mitchell", "liam_morrison", "sophie_campbell", "jack_ross", "isla_mackay", "noah_douglas"],
    },
    {
        "name": "N5 Period 5",
        "students": ["olivia_reid", "calum_fraser", "emma_stewart", "ewan_macleod", "chloe_henderson", "ryan_paterson"],
    },
]

PROGRESS_PLAN = {
    "ava_mitchell": {"example1": "complete", "example2": "complete", "example3": "strong", "assessment": "steady"},
    "liam_morrison": {"example1": "strong", "example2": "steady", "example3": "steady", "assessment": "early"},
    "sophie_campbell": {"example1": "complete", "example2": "strong", "example3": "complete", "assessment": "strong"},
    "jack_ross": {"example1": "steady", "example2": "early", "example3": "early", "assessment": "none"},
    "isla_mackay": {"example1": "strong", "example2": "complete", "example3": "steady", "assessment": "attempted"},
    "noah_douglas": {"example1": "early", "example2": "attempted", "example3": "none", "assessment": "none"},
    "olivia_reid": {"example1": "complete", "example2": "complete", "example3": "complete", "assessment": "complete"},
    "calum_fraser": {"example1": "steady", "example2": "strong", "example3": "early", "assessment": "early"},
    "emma_stewart": {"example1": "strong", "example2": "steady", "example3": "strong", "assessment": "steady"},
    "ewan_macleod": {"example1": "attempted", "example2": "attempted", "example3": "attempted", "assessment": "none"},
    "chloe_henderson": {"example1": "complete", "example2": "strong", "example3": "strong", "assessment": "complete"},
    "ryan_paterson": {"example1": "early", "example2": "none", "example3": "steady", "assessment": "none"},
}


def _inputs_for(activity_key: str, mode: str):
    full_inputs = {
        "example1": {"pred3": "len(username) < 5", "pred4": "retry", "ex1SgCInput": "5", "ex1SgDInput": "C"},
        "example2": {"pred1": "5", "pred3": "total", "pred4": "0", "sgC2": "price", "ex2Trace1": "2", "ex2Trace2": "5"},
        "example3": {"ex3PredStore": "append", "ex3PredVariable": "value", "ex3PredCount": "5", "ex3SgCInput": "1", "ex3TracePasses": "3"},
        "assessment": {"pred1": "5", "pred2": "while", "pred3": "total", "pred4": "yes", "sgC1": "price"},
    }
    early_inputs = {
        "example1": {"pred3": "len(username) < 5"},
        "example2": {"pred1": "5"},
        "example3": {"ex3PredStore": "append"},
        "assessment": {"pred1": "5"},
    }
    attempted_inputs = {
        "example1": {"pred3": "len(username)"},
        "example2": {"pred1": "4"},
        "example3": {"ex3PredCount": "4"},
        "assessment": {"pred2": "for"},
    }

    if mode in {"complete", "strong", "steady"}:
        return full_inputs.get(activity_key, {})
    if mode == "early":
        return early_inputs.get(activity_key, {})
    if mode == "attempted":
        return attempted_inputs.get(activity_key, {})
    return {}


def _progress_defaults(activity_key: str, mode: str):
    checkpoints = ACTIVITY_CHECKPOINTS[activity_key]
    if mode == "none":
        return None
    if mode == "complete":
        completed_checks = list(checkpoints)
        step_index = ACTIVITY_STEP_COUNT - 1
        is_complete = True
    elif mode == "strong":
        completed_checks = checkpoints[:-2]
        step_index = 8
        is_complete = False
    elif mode == "steady":
        completed_checks = checkpoints[:7]
        step_index = 6
        is_complete = False
    elif mode == "early":
        completed_checks = checkpoints[:4]
        step_index = 4
        is_complete = False
    elif mode == "attempted":
        completed_checks = checkpoints[:1]
        step_index = 2
        is_complete = False
    else:
        completed_checks = []
        step_index = 0
        is_complete = False

    return {
        "step_index": step_index,
        "step_count": ACTIVITY_STEP_COUNT,
        "is_complete": is_complete,
        "completed_checks": completed_checks,
        "inputs": _inputs_for(activity_key, mode),
        "show_worked_example": mode in {"complete", "strong"},
    }


def _started(progress: ActivityProgress):
    if progress.is_complete:
        return True
    if int(progress.step_index or 0) > 0:
        return True
    if bool(progress.completed_checks):
        return True
    if bool(progress.inputs):
        return True
    if progress.show_worked_example:
        return True
    return False


class Command(BaseCommand):
    help = "Seed richer teacher/class/student progress data for presentations."

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

        student_usernames = [row["username"] for row in STUDENT_SPECS]
        legacy_usernames = ["demo_student_1", "demo_student_2", "demo_student_3"]
        all_demo_usernames = [teacher_username, *student_usernames, *legacy_usernames]

        if options["reset"]:
            User.objects.filter(username__in=all_demo_usernames).delete()

        teacher, _ = User.objects.get_or_create(
            username=teacher_username,
            defaults={"email": "teacher.demo@example.com", "first_name": "Demo", "last_name": "Teacher"},
        )
        teacher.set_password(DEFAULT_PASSWORD)
        teacher.save(update_fields=["password"])
        Profile.objects.update_or_create(user=teacher, defaults={"role": Profile.ROLE_TEACHER})
        UserProgressSummary.objects.get_or_create(user=teacher)

        students = {}
        for spec in STUDENT_SPECS:
            student, _ = User.objects.get_or_create(
                username=spec["username"],
                defaults={
                    "email": spec["email"],
                    "first_name": spec["first_name"],
                    "last_name": spec["last_name"],
                },
            )
            student.set_password(DEFAULT_PASSWORD)
            student.email = spec["email"]
            student.first_name = spec["first_name"]
            student.last_name = spec["last_name"]
            student.save(update_fields=["password", "email", "first_name", "last_name"])
            Profile.objects.update_or_create(user=student, defaults={"role": Profile.ROLE_STUDENT})
            UserProgressSummary.objects.get_or_create(user=student)
            TeacherStudent.objects.get_or_create(teacher=teacher, student=student)
            students[student.username] = student

        for class_spec in CLASSROOM_SPECS:
            classroom, _ = Classroom.objects.get_or_create(name=class_spec["name"], teacher=teacher)
            for username in class_spec["students"]:
                student = students.get(username)
                if student is None:
                    continue
                Enrollment.objects.get_or_create(classroom=classroom, student=student)

        now = timezone.now()
        for student_index, spec in enumerate(STUDENT_SPECS, start=1):
            student = students[spec["username"]]
            plan = PROGRESS_PLAN.get(student.username, {})

            for activity_key in ACTIVITY_KEYS:
                mode = plan.get(activity_key, "none")
                defaults = _progress_defaults(activity_key, mode)
                if defaults is None:
                    ActivityProgress.objects.filter(user=student, activity_key=activity_key).delete()
                    continue
                ActivityProgress.objects.update_or_create(
                    user=student,
                    activity_key=activity_key,
                    defaults=defaults,
                )

                checkpoints = defaults.get("completed_checks", [])
                if not checkpoints:
                    continue

                hint_targets = checkpoints[: min(4, len(checkpoints))]
                if mode in {"early", "attempted"} and len(ACTIVITY_CHECKPOINTS[activity_key]) > len(hint_targets):
                    hint_targets.append(ACTIVITY_CHECKPOINTS[activity_key][len(hint_targets)])

                for hint_index, checkpoint_id in enumerate(hint_targets):
                    attempts = min(5, 1 + ((student_index + hint_index) % 4) + (1 if mode in {"steady", "strong"} else 0))
                    shown_level = min(3, max(1, attempts - 1))
                    show_count = shown_level + (1 if attempts >= 3 else 0)
                    reveal_count = 1 if attempts >= 4 and hint_index == 0 else 0
                    revealed_worked = reveal_count > 0
                    last_used_at = now - timedelta(minutes=(student_index * 7) + (hint_index * 3))

                    HintAnalytics.objects.update_or_create(
                        user=student,
                        activity_key=activity_key,
                        checkpoint_id=checkpoint_id,
                        defaults={
                            "attempts": attempts,
                            "shown_level": shown_level,
                            "show_count": show_count,
                            "reveal_count": reveal_count,
                            "revealed_worked": revealed_worked,
                            "last_used_at": last_used_at,
                        },
                    )

            rows = list(ActivityProgress.objects.filter(user=student))
            activities_started = sum(1 for row in rows if _started(row))
            activities_completed = sum(1 for row in rows if row.is_complete)
            normalized_completed = {str(row.activity_key).lower() for row in rows if row.is_complete}

            UserProgressSummary.objects.update_or_create(
                user=student,
                defaults={
                    "activities_started": activities_started,
                    "activities_completed": activities_completed,
                    "examples_completed": len(EXAMPLE_KEYS.intersection(normalized_completed)),
                    "assessment_completed": "assessment" in normalized_completed,
                    "all_examples_completed": EXAMPLE_KEYS.issubset(normalized_completed),
                },
            )

        self.stdout.write(self.style.SUCCESS("Expanded demo teacher data seeded."))
        self.stdout.write(self.style.SUCCESS(f"Teacher login: {teacher_username} / {DEFAULT_PASSWORD}"))
        self.stdout.write(self.style.SUCCESS("Student logins: 12 demo students (all use DemoPass123!)."))
