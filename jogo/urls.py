from django.urls import path

from . import views

app_name = "jogo"

urlpatterns = [
    path("", views.JogoView.as_view(), name="jogo"),
]
