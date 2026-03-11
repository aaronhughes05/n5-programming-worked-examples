from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import ActivityProgress, UserProgressSummary


CANONICAL_ACTIVITY_KEYS = ("example1", "example2", "example3", "assessment")
CANONICAL_ACTIVITY_KEY_SET = set(CANONICAL_ACTIVITY_KEYS)
EXAMPLE_ACTIVITY_KEY_SET = {"example1", "example2", "example3"}


def _normalize_activity_key(activity_key: str) -> str:
    key = str(activity_key or "").strip().lower()
    if "/" in key:
        key = key.split("/")[-1]
    if key.endswith(".html"):
        key = key[:-5]
    return key


def _is_progress_started(progress: ActivityProgress) -> bool:
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
    help = "Rebuild UserProgressSummary rows from canonical ActivityProgress data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--username",
            type=str,
            help="Only rebuild summary for one username.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        username = str(options.get("username") or "").strip()
        User = get_user_model()

        if username:
            users = list(User.objects.filter(username=username))
            if not users:
                self.stderr.write(self.style.ERROR(f"No user found for username '{username}'."))
                return
        else:
            users = list(User.objects.all().order_by("id"))

        rebuilt = 0
        for user in users:
            progress_rows = ActivityProgress.objects.filter(user=user)
            normalized_started = set()
            normalized_completed = set()

            for row in progress_rows.iterator(chunk_size=500):
                nkey = _normalize_activity_key(row.activity_key)
                if not nkey or nkey not in CANONICAL_ACTIVITY_KEY_SET:
                    continue
                if _is_progress_started(row):
                    normalized_started.add(nkey)
                if row.is_complete:
                    normalized_completed.add(nkey)

            UserProgressSummary.objects.update_or_create(
                user=user,
                defaults={
                    "activities_started": len(normalized_started),
                    "activities_completed": len(normalized_completed),
                    "examples_completed": len(EXAMPLE_ACTIVITY_KEY_SET.intersection(normalized_completed)),
                    "assessment_completed": "assessment" in normalized_completed,
                    "all_examples_completed": EXAMPLE_ACTIVITY_KEY_SET.issubset(normalized_completed),
                },
            )
            rebuilt += 1

        self.stdout.write(self.style.SUCCESS(f"Rebuilt progress summaries for {rebuilt} user(s)."))
