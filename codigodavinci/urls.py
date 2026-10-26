from django.urls import include, path

urlpatterns = [
    path("", include("jogo.urls")),
]
