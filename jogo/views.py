from django.views.generic import TemplateView


class JogoView(TemplateView):
    template_name = "jogo/jogo.html"
