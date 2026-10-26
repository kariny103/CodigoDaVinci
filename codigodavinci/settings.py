"""Configuracoes do projeto O Codigo da Vinci (jogo da feira, uso em rede local)."""
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = "rx-0y*rq@y6m$j!*(1d&qdcz59*2xh6e^jibujbrp@^@xv*!i^"

# O jogo roda so na rede da escola, servido pelo runserver.
DEBUG = True
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.staticfiles",
    "jogo",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "codigodavinci.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {"context_processors": []},
    },
]

WSGI_APPLICATION = "codigodavinci.wsgi.application"

# O jogo nao grava nada no servidor (o progresso fica no navegador).
DATABASES = {}

LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
