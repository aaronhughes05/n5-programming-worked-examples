from collections import defaultdict
from typing import Optional

from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import ActivityProgress, HintAnalytics


CANONICAL_ACTIVITY_KEYS = ("example1", "example2", "example3", "assessment")
CANONICAL_ACTIVITY_KEY_SET = set(CANONICAL_ACTIVITY_KEYS)


def normalize_activity_key(raw_value: str) -> str:
    key = str(raw_value or "").strip().lower()
    if "/" in key:
        key = key.split("/")[-1]
    if key.endswith(".html"):
        key = key[:-5]
    return key


class Command(BaseCommand):
    help = "Report and optionally clean legacy/non-canonical activity_key values."

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Apply canonical rewrites to records where activity_key can be normalized.",
        )
        parser.add_argument(
            "--delete-unknown",
            action="store_true",
            help="Delete records with unknown activity_key values (requires --apply).",
        )
        parser.add_argument(
            "--username",
            type=str,
            help="Limit cleanup/report to a single username.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        apply_changes = bool(options.get("apply"))
        delete_unknown = bool(options.get("delete_unknown"))
        username = (options.get("username") or "").strip()

        if delete_unknown and not apply_changes:
            self.stderr.write(self.style.ERROR("--delete-unknown requires --apply."))
            return

        self.stdout.write(self.style.NOTICE("Activity key cleanup report"))
        self.stdout.write(f"Mode: {'APPLY' if apply_changes else 'DRY-RUN'}")
        if username:
            self.stdout.write(f"Scoped username: {username}")
        self.stdout.write(f"Canonical keys: {', '.join(CANONICAL_ACTIVITY_KEYS)}")
        self.stdout.write("")

        progress_qs = ActivityProgress.objects.all().order_by("id")
        hint_qs = HintAnalytics.objects.all().order_by("id")
        if username:
            progress_qs = progress_qs.filter(user__username=username)
            hint_qs = hint_qs.filter(user__username=username)

        progress_report = self._process_queryset(
            model_name="ActivityProgress",
            queryset=progress_qs,
            apply_changes=apply_changes,
            delete_unknown=delete_unknown,
        )
        hint_report = self._process_queryset(
            model_name="HintAnalytics",
            queryset=hint_qs,
            apply_changes=apply_changes,
            delete_unknown=delete_unknown,
        )

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("Summary"))
        self.stdout.write(
            f"ActivityProgress: scanned={progress_report['scanned']} canonical={progress_report['canonical']} "
            f"rewrite_candidates={progress_report['rewrite_candidates']} unknown={progress_report['unknown']} "
            f"rewritten={progress_report['rewritten']} merged={progress_report['merged']} deleted={progress_report['deleted']}"
        )
        self.stdout.write(
            f"HintAnalytics: scanned={hint_report['scanned']} canonical={hint_report['canonical']} "
            f"rewrite_candidates={hint_report['rewrite_candidates']} unknown={hint_report['unknown']} "
            f"rewritten={hint_report['rewritten']} merged={hint_report['merged']} deleted={hint_report['deleted']}"
        )
        if not apply_changes:
            self.stdout.write(self.style.WARNING("Dry-run only. Re-run with --apply to persist rewrites."))

    def _process_queryset(self, model_name, queryset, apply_changes, delete_unknown):
        report = {
            "scanned": 0,
            "canonical": 0,
            "rewrite_candidates": 0,
            "unknown": 0,
            "rewritten": 0,
            "merged": 0,
            "deleted": 0,
        }
        rewrite_rows_by_target = defaultdict(list)
        unknown_ids = []
        unknown_samples = []
        rewrite_samples = []

        model = queryset.model
        if model is ActivityProgress:
            rows = queryset.only(
                "id",
                "activity_key",
                "user_id",
                "step_index",
                "step_count",
                "is_complete",
                "completed_checks",
                "inputs",
                "show_worked_example",
            )
        elif model is HintAnalytics:
            rows = queryset.only(
                "id",
                "activity_key",
                "user_id",
                "checkpoint_id",
                "attempts",
                "shown_level",
                "show_count",
                "reveal_count",
                "revealed_worked",
                "last_used_at",
            )
        else:
            rows = queryset.only("id", "activity_key", "user_id")
        for row in rows.iterator(chunk_size=1000):
            report["scanned"] += 1
            raw_key = str(row.activity_key or "")
            normalized_key = normalize_activity_key(raw_key)

            if normalized_key in CANONICAL_ACTIVITY_KEY_SET:
                if raw_key == normalized_key:
                    report["canonical"] += 1
                else:
                    report["rewrite_candidates"] += 1
                    rewrite_rows_by_target[normalized_key].append(row)
                    if len(rewrite_samples) < 12:
                        rewrite_samples.append((row.id, raw_key, normalized_key))
                continue

            report["unknown"] += 1
            unknown_ids.append(row.id)
            if len(unknown_samples) < 12:
                unknown_samples.append((row.id, raw_key, normalized_key))

        self.stdout.write(self.style.NOTICE(model_name))
        self.stdout.write(
            f"  scanned={report['scanned']} canonical={report['canonical']} "
            f"rewrite_candidates={report['rewrite_candidates']} unknown={report['unknown']}"
        )
        if rewrite_samples:
            self.stdout.write("  rewrite samples:")
            for row_id, raw, normalized in rewrite_samples:
                self.stdout.write(f"    id={row_id} '{raw}' -> '{normalized}'")
        if unknown_samples:
            self.stdout.write("  unknown samples:")
            for row_id, raw, normalized in unknown_samples:
                self.stdout.write(f"    id={row_id} '{raw}' (normalized='{normalized}')")

        if not apply_changes:
            return report

        for target_key, rows_for_target in rewrite_rows_by_target.items():
            for row in rows_for_target:
                if model is ActivityProgress:
                    rewritten, merged = self._rewrite_activity_progress_row(row.id, target_key)
                elif model is HintAnalytics:
                    rewritten, merged = self._rewrite_hint_analytics_row(row.id, target_key)
                else:
                    updated = model.objects.filter(id=row.id).update(activity_key=target_key)
                    rewritten, merged = int(updated), 0
                report["rewritten"] += rewritten
                report["merged"] += merged

        if delete_unknown and unknown_ids:
            deleted, _ = model.objects.filter(id__in=unknown_ids).delete()
            report["deleted"] += int(deleted)

        return report

    def _rewrite_activity_progress_row(self, row_id: int, target_key: str) -> tuple[int, int]:
        row: Optional[ActivityProgress] = ActivityProgress.objects.filter(id=row_id).first()
        if not row:
            return 0, 0

        existing = ActivityProgress.objects.filter(user_id=row.user_id, activity_key=target_key).exclude(id=row.id).first()
        if not existing:
            row.activity_key = target_key
            row.save(update_fields=["activity_key", "updated_at"])
            return 1, 0

        existing.step_count = max(existing.step_count, row.step_count)
        existing.step_index = min(max(existing.step_index, row.step_index), existing.step_count)
        existing.is_complete = existing.is_complete or row.is_complete
        existing.show_worked_example = existing.show_worked_example or row.show_worked_example

        existing_checks = list(existing.completed_checks or [])
        row_checks = list(row.completed_checks or [])
        combined_checks = []
        for check_id in existing_checks + row_checks:
            if check_id not in combined_checks:
                combined_checks.append(check_id)
        existing.completed_checks = combined_checks

        existing_inputs = dict(existing.inputs or {})
        for key, value in dict(row.inputs or {}).items():
            if key not in existing_inputs:
                existing_inputs[key] = value
        existing.inputs = existing_inputs

        existing.save(
            update_fields=[
                "step_count",
                "step_index",
                "is_complete",
                "show_worked_example",
                "completed_checks",
                "inputs",
                "updated_at",
            ]
        )
        row.delete()
        return 0, 1

    def _rewrite_hint_analytics_row(self, row_id: int, target_key: str) -> tuple[int, int]:
        row: Optional[HintAnalytics] = HintAnalytics.objects.filter(id=row_id).first()
        if not row:
            return 0, 0

        existing = (
            HintAnalytics.objects.filter(
                user_id=row.user_id,
                activity_key=target_key,
                checkpoint_id=row.checkpoint_id,
            )
            .exclude(id=row.id)
            .first()
        )
        if not existing:
            row.activity_key = target_key
            row.save(update_fields=["activity_key", "updated_at"])
            return 1, 0

        existing.attempts = existing.attempts + row.attempts
        existing.shown_level = max(existing.shown_level, row.shown_level)
        existing.show_count = existing.show_count + row.show_count
        existing.reveal_count = existing.reveal_count + row.reveal_count
        existing.revealed_worked = existing.revealed_worked or row.revealed_worked
        if not existing.last_used_at or (row.last_used_at and row.last_used_at > existing.last_used_at):
            existing.last_used_at = row.last_used_at
        existing.save(
            update_fields=[
                "attempts",
                "shown_level",
                "show_count",
                "reveal_count",
                "revealed_worked",
                "last_used_at",
                "updated_at",
            ]
        )
        row.delete()
        return 0, 1
