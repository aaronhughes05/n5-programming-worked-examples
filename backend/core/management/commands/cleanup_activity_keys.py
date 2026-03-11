from collections import defaultdict

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
            f"rewritten={progress_report['rewritten']} deleted={progress_report['deleted']}"
        )
        self.stdout.write(
            f"HintAnalytics: scanned={hint_report['scanned']} canonical={hint_report['canonical']} "
            f"rewrite_candidates={hint_report['rewrite_candidates']} unknown={hint_report['unknown']} "
            f"rewritten={hint_report['rewritten']} deleted={hint_report['deleted']}"
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
            "deleted": 0,
        }
        rewrite_ids_by_target = defaultdict(list)
        unknown_ids = []
        unknown_samples = []
        rewrite_samples = []

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
                    rewrite_ids_by_target[normalized_key].append(row.id)
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

        model = queryset.model
        for target_key, ids in rewrite_ids_by_target.items():
            updated = model.objects.filter(id__in=ids).update(activity_key=target_key)
            report["rewritten"] += int(updated)

        if delete_unknown and unknown_ids:
            deleted, _ = model.objects.filter(id__in=unknown_ids).delete()
            report["deleted"] += int(deleted)

        return report
