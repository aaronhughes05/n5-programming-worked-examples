import json
import csv

from django.contrib.auth import authenticate, login, logout
from django.db.models import Sum
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import render
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from core.models import ActivityProgress, Classroom, Enrollment, HintAnalytics, UserProgressSummary

PAGE_TEMPLATE_MAP = {
    "example1": "pages/example1.html",
    "example2": "pages/example2.html",
    "example3": "pages/example3.html",
    "assessment": "pages/assessment.html",
    "teacher": "pages/teacher.html",
    "worksheets": "pages/worksheets.html",
    "worksheet-example1": "pages/worksheet-example1.html",
    "worksheet-example2": "pages/worksheet-example2.html",
    "worksheet-example3": "pages/worksheet-example3.html",
    "worksheet-assessment": "pages/worksheet-assessment.html",
    "example-template": "pages/example-template.html",
}


@require_GET
def api_root(_request: HttpRequest):
    return JsonResponse({"message": "API scaffold ready"})


@require_GET
def home_page(request: HttpRequest):
    return render(request, "index.html")


@require_GET
def examples_page(request: HttpRequest, page_key: str):
    template_name = PAGE_TEMPLATE_MAP.get(page_key)
    if not template_name:
        return _json_error("Page not found.", status=404)
    return render(request, template_name)


@require_GET
def pages_alias(request: HttpRequest, file_name: str):
    normalized = str(file_name or "").strip().lower()
    if normalized.endswith(".html"):
        normalized = normalized[:-5]
    template_name = PAGE_TEMPLATE_MAP.get(normalized)
    if not template_name:
        return _json_error("Page not found.", status=404)
    return render(request, template_name)


def _json_error(message: str, status: int = 400) -> JsonResponse:
    return JsonResponse({"error": message}, status=status)


def _get_json_payload(request: HttpRequest):
    try:
        return json.loads(request.body.decode("utf-8") or "{}"), None
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None, _json_error("Invalid JSON payload.", status=400)


def _require_authenticated_user(request: HttpRequest):
    if request.user.is_authenticated:
        return request.user, None
    return None, _json_error("Authentication required.", status=401)


def _require_teacher_user(request: HttpRequest):
    user, error = _require_authenticated_user(request)
    if error:
        return None, error
    role = getattr(getattr(user, "profile", None), "role", "student")
    if role != "teacher":
        return None, _json_error("Teacher role required.", status=403)
    return user, None


def _normalize_activity_key(activity_key: str) -> str:
    key = str(activity_key or "").strip().lower()
    if "/" in key:
        key = key.split("/")[-1]
    if key.endswith(".html"):
        key = key[:-5]
    return key


def _refresh_summary_for_user(user):
    progress_rows = list(ActivityProgress.objects.filter(user=user))
    normalized_started = set()
    normalized_completed = set()
    for row in progress_rows:
        nkey = _normalize_activity_key(row.activity_key)
        if not nkey:
            continue
        normalized_started.add(nkey)
        if row.is_complete:
            normalized_completed.add(nkey)

    example_keys = {"example1", "example2", "example3"}
    examples_completed = len(example_keys.intersection(normalized_completed))
    all_examples_completed = example_keys.issubset(normalized_completed)
    assessment_completed = "assessment" in normalized_completed

    summary, _ = UserProgressSummary.objects.get_or_create(user=user)
    summary.activities_started = len(normalized_started)
    summary.activities_completed = len(normalized_completed)
    summary.examples_completed = examples_completed
    summary.all_examples_completed = all_examples_completed
    summary.assessment_completed = assessment_completed
    summary.save(
        update_fields=[
            "activities_started",
            "activities_completed",
            "examples_completed",
            "all_examples_completed",
            "assessment_completed",
            "updated_at",
        ]
    )
    return summary


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


def _parse_client_timestamp(raw_value):
    if raw_value in (None, ""):
        return None

    if isinstance(raw_value, (int, float)):
        value = float(raw_value)
        if value > 10_000_000_000:
            value = value / 1000.0
        dt = timezone.datetime.fromtimestamp(value, tz=timezone.utc)
        return dt

    if isinstance(raw_value, str):
        text = raw_value.strip()
        if not text:
            return None

        if text.isdigit():
            value = float(text)
            if value > 10_000_000_000:
                value = value / 1000.0
            return timezone.datetime.fromtimestamp(value, tz=timezone.utc)

        parsed = parse_datetime(text)
        if parsed is not None:
            if timezone.is_naive(parsed):
                return timezone.make_aware(parsed, timezone.get_current_timezone())
            return parsed

    return None


def _serialize_progress(progress: ActivityProgress):
    return {
        "activityKey": progress.activity_key,
        "stepIndex": progress.step_index,
        "stepCount": progress.step_count,
        "isComplete": progress.is_complete,
        "completedChecks": progress.completed_checks or [],
        "inputs": progress.inputs or {},
        "showWorkedExample": progress.show_worked_example,
        "updatedAt": progress.updated_at.isoformat(),
    }


def _serialize_summary(summary: UserProgressSummary):
    return {
        "activitiesStarted": summary.activities_started,
        "activitiesCompleted": summary.activities_completed,
        "examplesCompleted": summary.examples_completed,
        "allExamplesCompleted": summary.all_examples_completed,
        "assessmentCompleted": summary.assessment_completed,
        "updatedAt": summary.updated_at.isoformat(),
    }


def _collect_teacher_student_ids(teacher_user):
    classroom_ids = list(
        Classroom.objects.filter(teacher=teacher_user).values_list("id", flat=True)
    )
    if not classroom_ids:
        return [], {}

    enrollment_rows = Enrollment.objects.filter(classroom_id__in=classroom_ids).select_related(
        "student", "classroom"
    )
    class_students = {}
    student_ids = set()
    for row in enrollment_rows:
        class_students.setdefault(row.classroom_id, []).append(row.student)
        student_ids.add(row.student_id)
    return sorted(student_ids), class_students


def _build_teacher_class_summary(teacher_user):
    student_ids, class_students = _collect_teacher_student_ids(teacher_user)
    classrooms = list(Classroom.objects.filter(teacher=teacher_user).order_by("name", "id"))
    progress_rows = ActivityProgress.objects.filter(user_id__in=student_ids)
    progress_by_user = {}
    for row in progress_rows:
        key = _normalize_activity_key(row.activity_key)
        if not key:
            continue
        progress_by_user.setdefault(row.user_id, {})[key] = row

    activity_keys = ("example1", "example2", "example3", "assessment")
    class_cards = []
    overall_totals = {
        "students": len(student_ids),
        "activitiesCompleted": 0,
        "activitiesInProgress": 0,
        "activitiesNotStarted": 0,
        "hintsUsed": 0,
        "workedHintsRevealed": 0,
    }

    hint_totals_map = HintAnalytics.objects.filter(user_id__in=student_ids).aggregate(
        hints_used=Sum("show_count"),
        worked_revealed=Sum("reveal_count"),
    )
    overall_totals["hintsUsed"] = int(hint_totals_map.get("hints_used") or 0)
    overall_totals["workedHintsRevealed"] = int(hint_totals_map.get("worked_revealed") or 0)

    for classroom in classrooms:
        students = class_students.get(classroom.id, [])
        student_progress = [progress_by_user.get(student.id, {}) for student in students]

        by_activity = []
        for activity_key in activity_keys:
            completed = 0
            in_progress = 0
            not_started = 0
            for sp in student_progress:
                row = sp.get(activity_key)
                if row is None:
                    not_started += 1
                elif row.is_complete:
                    completed += 1
                elif _is_progress_started(row):
                    in_progress += 1
                else:
                    not_started += 1

            overall_totals["activitiesCompleted"] += completed
            overall_totals["activitiesInProgress"] += in_progress
            overall_totals["activitiesNotStarted"] += not_started
            by_activity.append(
                {
                    "activityKey": activity_key,
                    "completed": completed,
                    "inProgress": in_progress,
                    "notStarted": not_started,
                }
            )

        class_cards.append(
            {
                "classroomId": classroom.id,
                "classroomName": classroom.name,
                "studentCount": len(students),
                "activityCounts": by_activity,
            }
        )

    return {
        "generatedAt": timezone.now().isoformat(),
        "overall": overall_totals,
        "classes": class_cards,
    }


def _build_teacher_attempt_analytics(teacher_user):
    student_ids, _ = _collect_teacher_student_ids(teacher_user)
    hint_rows = list(HintAnalytics.objects.filter(user_id__in=student_ids))
    by_activity_checkpoint = {}
    for row in hint_rows:
        key = (_normalize_activity_key(row.activity_key), row.checkpoint_id)
        bucket = by_activity_checkpoint.setdefault(
            key,
            {
                "activityKey": _normalize_activity_key(row.activity_key),
                "checkpointId": row.checkpoint_id,
                "studentsAttempted": 0,
                "attempts": 0,
                "hintsShown": 0,
                "workedHintsRevealed": 0,
                "missSignals": 0,
            },
        )
        bucket["studentsAttempted"] += 1
        bucket["attempts"] += int(row.attempts or 0)
        bucket["hintsShown"] += int(row.show_count or 0)
        bucket["workedHintsRevealed"] += int(row.reveal_count or 0)
        bucket["missSignals"] += max(0, int(row.attempts or 0) - 1)

    checkpoints = sorted(
        by_activity_checkpoint.values(),
        key=lambda x: (x["activityKey"], -x["missSignals"], -x["attempts"], x["checkpointId"]),
    )
    most_missed = sorted(
        checkpoints,
        key=lambda x: (-x["missSignals"], -x["attempts"], x["activityKey"], x["checkpointId"]),
    )[:10]

    return {
        "generatedAt": timezone.now().isoformat(),
        "checkpointAnalytics": checkpoints,
        "mostMissed": most_missed,
    }


@csrf_exempt
@require_POST
def auth_login(request: HttpRequest):
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except (UnicodeDecodeError, json.JSONDecodeError):
        return JsonResponse({"error": "Invalid JSON payload."}, status=400)

    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", ""))
    if not username or not password:
        return JsonResponse({"error": "username and password are required."}, status=400)

    user = authenticate(request, username=username, password=password)
    if user is None:
        return JsonResponse({"error": "Invalid credentials."}, status=401)

    login(request, user)
    role = getattr(getattr(user, "profile", None), "role", "student")
    return JsonResponse(
        {
            "ok": True,
            "user": {
                "id": user.id,
                "username": user.username,
                "role": role,
            },
        }
    )


@csrf_exempt
@require_POST
def auth_logout(request: HttpRequest):
    logout(request)
    return JsonResponse({"ok": True})


@require_GET
def auth_me(request: HttpRequest):
    user = request.user
    if not user.is_authenticated:
        return JsonResponse({"authenticated": False, "user": None}, status=401)

    role = getattr(getattr(user, "profile", None), "role", "student")
    return JsonResponse(
        {
            "authenticated": True,
            "user": {
                "id": user.id,
                "username": user.username,
                "role": role,
            },
        }
    )


@require_GET
def progress_summary(request: HttpRequest):
    user, error = _require_authenticated_user(request)
    if error:
        return error
    summary = _refresh_summary_for_user(user)
    return JsonResponse({"summary": _serialize_summary(summary)})


@csrf_exempt
@require_http_methods(["GET", "PUT"])
def progress_detail(request: HttpRequest, activity_key: str):
    user, error = _require_authenticated_user(request)
    if error:
        return error

    key = str(activity_key or "").strip()
    if not key:
        return _json_error("activity_key is required.")
    if len(key) > 64:
        return _json_error("activity_key is too long.")

    progress, _ = ActivityProgress.objects.get_or_create(
        user=user,
        activity_key=key,
    )

    if request.method == "PUT":
        payload, parse_error = _get_json_payload(request)
        if parse_error:
            return parse_error

        if "stepIndex" in payload:
            progress.step_index = max(0, int(payload.get("stepIndex") or 0))
        if "stepCount" in payload:
            progress.step_count = max(0, int(payload.get("stepCount") or 0))
        if "isComplete" in payload:
            progress.is_complete = bool(payload.get("isComplete"))
        if "showWorkedExample" in payload:
            progress.show_worked_example = bool(payload.get("showWorkedExample"))
        if "completedChecks" in payload:
            checks = payload.get("completedChecks")
            if not isinstance(checks, list):
                return _json_error("completedChecks must be a list.")
            progress.completed_checks = [str(item) for item in checks]
        if "inputs" in payload:
            inputs = payload.get("inputs")
            if not isinstance(inputs, dict):
                return _json_error("inputs must be an object.")
            progress.inputs = inputs

        progress.save()

    summary = _refresh_summary_for_user(user)
    return JsonResponse(
        {
            "progress": _serialize_progress(progress),
            "summary": _serialize_summary(summary),
        }
    )


@csrf_exempt
@require_POST
def progress_checkpoint(request: HttpRequest, activity_key: str):
    user, error = _require_authenticated_user(request)
    if error:
        return error

    key = str(activity_key or "").strip()
    if not key:
        return _json_error("activity_key is required.")
    if len(key) > 64:
        return _json_error("activity_key is too long.")

    payload, parse_error = _get_json_payload(request)
    if parse_error:
        return parse_error

    checkpoint_id = str(payload.get("checkpointId", "")).strip()
    if not checkpoint_id:
        return _json_error("checkpointId is required.")
    is_correct = bool(payload.get("isCorrect", True))

    progress, _ = ActivityProgress.objects.get_or_create(user=user, activity_key=key)
    current_checks = list(progress.completed_checks or [])
    if is_correct and checkpoint_id not in current_checks:
        current_checks.append(checkpoint_id)
        progress.completed_checks = current_checks

    if "stepIndex" in payload:
        progress.step_index = max(0, int(payload.get("stepIndex") or 0))
    if "stepCount" in payload:
        progress.step_count = max(0, int(payload.get("stepCount") or 0))
    if "isComplete" in payload:
        progress.is_complete = bool(payload.get("isComplete"))

    progress.save()
    summary = _refresh_summary_for_user(user)
    return JsonResponse(
        {
            "progress": _serialize_progress(progress),
            "summary": _serialize_summary(summary),
        }
    )


@csrf_exempt
@require_POST
def hints_checkpoint(request: HttpRequest, activity_key: str, checkpoint_id: str):
    user, error = _require_authenticated_user(request)
    if error:
        return error

    key = str(activity_key or "").strip()
    cp = str(checkpoint_id or "").strip()
    if not key:
        return _json_error("activity_key is required.")
    if not cp:
        return _json_error("checkpoint_id is required.")
    if len(key) > 64:
        return _json_error("activity_key is too long.")
    if len(cp) > 128:
        return _json_error("checkpoint_id is too long.")

    payload, parse_error = _get_json_payload(request)
    if parse_error:
        return parse_error

    hint, _ = HintAnalytics.objects.get_or_create(
        user=user,
        activity_key=key,
        checkpoint_id=cp,
    )

    changed = False
    for field in ("attempts", "shownLevel", "showCount", "revealCount"):
        if field in payload:
            value = max(0, int(payload.get(field) or 0))
            if field == "shownLevel":
                hint.shown_level = value
            elif field == "showCount":
                hint.show_count = value
            elif field == "revealCount":
                hint.reveal_count = value
            elif field == "attempts":
                hint.attempts = value
            changed = True

    if "revealedWorked" in payload:
        hint.revealed_worked = bool(payload.get("revealedWorked"))
        changed = True

    increment_attempts = int(payload.get("incrementAttempts", 0) or 0)
    increment_show = int(payload.get("incrementShowCount", 0) or 0)
    increment_reveal = int(payload.get("incrementRevealCount", 0) or 0)
    if increment_attempts:
        hint.attempts = max(0, hint.attempts + increment_attempts)
        changed = True
    if increment_show:
        hint.show_count = max(0, hint.show_count + increment_show)
        changed = True
    if increment_reveal:
        hint.reveal_count = max(0, hint.reveal_count + increment_reveal)
        changed = True

    if not changed:
        hint.attempts += 1

    parsed_last_used = _parse_client_timestamp(payload.get("lastUsedAt"))
    hint.last_used_at = parsed_last_used or timezone.now()

    hint.save()

    return JsonResponse(
        {
            "hint": {
                "activityKey": hint.activity_key,
                "checkpointId": hint.checkpoint_id,
                "attempts": hint.attempts,
                "shownLevel": hint.shown_level,
                "showCount": hint.show_count,
                "revealCount": hint.reveal_count,
                "revealedWorked": hint.revealed_worked,
                "lastUsedAt": hint.last_used_at.isoformat() if hint.last_used_at else None,
            }
        }
    )


@require_GET
def teacher_class_summary(request: HttpRequest):
    teacher, error = _require_teacher_user(request)
    if error:
        return error
    payload = _build_teacher_class_summary(teacher)
    return JsonResponse(payload)


@require_GET
def teacher_attempt_analytics(request: HttpRequest):
    teacher, error = _require_teacher_user(request)
    if error:
        return error
    payload = _build_teacher_attempt_analytics(teacher)
    return JsonResponse(payload)


@require_GET
def teacher_export_json(request: HttpRequest):
    teacher, error = _require_teacher_user(request)
    if error:
        return error
    payload = {
        "generatedAt": timezone.now().isoformat(),
        "classSummary": _build_teacher_class_summary(teacher),
        "attemptAnalytics": _build_teacher_attempt_analytics(teacher),
    }
    return JsonResponse(payload, json_dumps_params={"indent": 2})


@require_GET
def teacher_export_csv(request: HttpRequest):
    teacher, error = _require_teacher_user(request)
    if error:
        return error

    class_summary = _build_teacher_class_summary(teacher)
    attempt_analytics = _build_teacher_attempt_analytics(teacher)

    response = HttpResponse(content_type="text/csv")
    timestamp = timezone.now().strftime("%Y%m%d-%H%M%S")
    response["Content-Disposition"] = f'attachment; filename="teacher-progress-report-{timestamp}.csv"'
    writer = csv.writer(response)

    writer.writerow(["Generated At", timezone.now().isoformat()])
    writer.writerow([])
    writer.writerow(["Class Summary"])
    writer.writerow(["Classroom", "Students", "Activity", "Completed", "In Progress", "Not Started"])
    for class_row in class_summary["classes"]:
        for activity in class_row["activityCounts"]:
            writer.writerow(
                [
                    class_row["classroomName"],
                    class_row["studentCount"],
                    activity["activityKey"],
                    activity["completed"],
                    activity["inProgress"],
                    activity["notStarted"],
                ]
            )

    writer.writerow([])
    writer.writerow(["Attempt Analytics"])
    writer.writerow(
        [
            "Activity",
            "Checkpoint ID",
            "Students Attempted",
            "Attempts",
            "Hints Shown",
            "Worked Hints Revealed",
            "Miss Signals",
        ]
    )
    for checkpoint in attempt_analytics["checkpointAnalytics"]:
        writer.writerow(
            [
                checkpoint["activityKey"],
                checkpoint["checkpointId"],
                checkpoint["studentsAttempted"],
                checkpoint["attempts"],
                checkpoint["hintsShown"],
                checkpoint["workedHintsRevealed"],
                checkpoint["missSignals"],
            ]
        )

    return response
