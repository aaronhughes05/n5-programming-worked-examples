from django.http import JsonResponse


def api_root(_request):
    return JsonResponse({"message": "API scaffold ready"})
