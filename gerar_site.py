"""Gera a versao estatica do jogo (pasta site/) para publicar no GitHub Pages.

O jogo nao precisa de servidor: basta trocar as tags {% static %} do template
por caminhos relativos e copiar a pasta static junto.
"""
import re
import shutil
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
TEMPLATE = BASE_DIR / "jogo" / "templates" / "jogo" / "jogo.html"
STATIC = BASE_DIR / "jogo" / "static"
SAIDA = BASE_DIR / "site"

html = TEMPLATE.read_text(encoding="utf-8")
html = re.sub(r"\{%\s*load static\s*%\}", "", html)
html = re.sub(r"\{%\s*static\s+['\"]([^'\"]+)['\"]\s*%\}", r"static/\1", html)

if "{%" in html or "{{" in html:
    raise SystemExit("O template tem tags do Django que este script nao sabe converter.")

if SAIDA.exists():
    shutil.rmtree(SAIDA)
shutil.copytree(STATIC, SAIDA / "static")
(SAIDA / "index.html").write_text(html, encoding="utf-8")

print(f"Site gerado em {SAIDA}")
