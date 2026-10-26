@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   Instalando o jogo O Codigo da Vinci
echo ============================================
echo.

where python >nul 2>nul
if errorlevel 1 (
    echo ERRO: Python nao foi encontrado neste computador.
    echo Instale o Python em https://www.python.org/downloads/
    echo IMPORTANTE: na instalacao, marque a opcao "Add Python to PATH".
    echo.
    pause
    exit /b 1
)

if not exist venv (
    echo Criando ambiente Python isolado ^(venv^)...
    python -m venv venv
)

call venv\Scripts\activate.bat

echo.
echo Instalando as bibliotecas necessarias...
pip install -r requirements.txt
if errorlevel 1 (
    echo.
    echo ERRO ao instalar as bibliotecas. Verifique sua conexao com a internet.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  Instalacao concluida com sucesso!
echo  Para abrir o jogo, use o arquivo: iniciar.bat
echo ============================================
pause
