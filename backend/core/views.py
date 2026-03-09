import json

from django.contrib.auth import authenticate, login, logout
from django.http import HttpRequest, JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from core.models import ActivityProgress, HintAnalytics, UserProgressSummary


@require_GET
def api_root(_request: HttpRequest):
    return JsonResponse({"message": "API scaffold ready"})


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

    last_used_raw = payload.get("lastUsedAt")
    if isinstance(last_used_raw, str) and last_used_raw.strip():
        parsed = parse_datetime(last_used_raw.strip())
        if parsed is not None:
            hint.last_used_at = parsed
    else:
        hint.last_used_at = timezone.now()

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
