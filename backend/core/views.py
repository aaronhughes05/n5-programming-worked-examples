import json

from django.contrib.auth import authenticate, login, logout
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST


@require_GET
def api_root(_request: HttpRequest):
    return JsonResponse({"message": "API scaffold ready"})


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
