import os
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent


def parse_bool(value, default=False):
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def normalize_samesite(value, default="Lax"):
    raw = str(value or default).strip().lower()
    if raw == "none":
        return "None"
    if raw == "strict":
        return "Strict"
    return "Lax"


DJANGO_ENV = os.getenv("DJANGO_ENV", "development").strip().lower()
ENV_FILE = os.getenv("DJANGO_ENV_FILE")
if ENV_FILE:
    load_dotenv(ENV_FILE)
else:
    load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-insecure-secret-change-me")
DEBUG = parse_bool(os.getenv("DJANGO_DEBUG"), default=(DJANGO_ENV != "production"))
ALLOWED_HOSTS = [h.strip() for h in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()]
CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",")
    if origin.strip()
]

# Managed platforms inject public hostnames dynamically.
for runtime_host in (os.getenv("RENDER_EXTERNAL_HOSTNAME"), os.getenv("RAILWAY_PUBLIC_DOMAIN")):
    if runtime_host and runtime_host not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(runtime_host)
    if runtime_host:
        trusted_origin = f"https://{runtime_host}"
        if trusted_origin not in CSRF_TRUSTED_ORIGINS:
            CSRF_TRUSTED_ORIGINS.append(trusted_origin)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": dj_database_url.config(
        default=os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'db.sqlite3'}"),
        conn_max_age=600,
        ssl_require=parse_bool(os.getenv("DATABASE_SSL_REQUIRE"), default=(DJANGO_ENV == "production")),
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
STATICFILES_DIRS = [BASE_DIR.parent / "docs"]

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LOGIN_URL = "/login/"

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = normalize_samesite(os.getenv("SESSION_COOKIE_SAMESITE"), "Lax")
CSRF_COOKIE_SAMESITE = normalize_samesite(os.getenv("CSRF_COOKIE_SAMESITE"), "Lax")
SESSION_COOKIE_SECURE = parse_bool(os.getenv("SESSION_COOKIE_SECURE"), default=not DEBUG)
CSRF_COOKIE_SECURE = parse_bool(os.getenv("CSRF_COOKIE_SECURE"), default=not DEBUG)

session_cookie_domain = os.getenv("SESSION_COOKIE_DOMAIN", "").strip()
csrf_cookie_domain = os.getenv("CSRF_COOKIE_DOMAIN", "").strip()
if session_cookie_domain:
    SESSION_COOKIE_DOMAIN = session_cookie_domain
if csrf_cookie_domain:
    CSRF_COOKIE_DOMAIN = csrf_cookie_domain

if not DEBUG:
    SECURE_HSTS_SECONDS = 60 * 60 * 24 * 7
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_SSL_REDIRECT = parse_bool(os.getenv("DJANGO_SECURE_SSL_REDIRECT"), default=True)
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
