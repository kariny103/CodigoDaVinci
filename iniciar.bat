@echo off
setlocal
cd /d "%~dp0"

if not exist venv (
    echo O jogo ainda nao foi instalado neste computador.
    echo Execute primeiro o arquivo: instalar.bat
    echo.
    pause
    exit /b 1
)

call venv\Scripts\activate.bat

echo ============================================
echo   O Codigo da Vinci - Matematica + Informatica
echo ============================================
echo.
echo  Neste computador, acesse pelo navegador em:
echo      http://localhost:8000
echo.
echo  Em OUTROS computadores/celulares da mesma rede Wi-Fi,
echo  descubra o IP deste computador (digite "ipconfig" em outro terminal,
echo  procure "Endereco IPv4") e acesse, por exemplo:
echo      http://192.168.0.10:8000
echo.
echo  Para ENCERRAR o jogo, feche esta janela ou pressione CTRL+C.
echo ============================================
echo.

rem Abre o jogo em tela cheia (para o telao/projetor).
rem Usa o Chrome se estiver instalado; senao, o Edge. Para sair da tela cheia: F11.
set "NAVEGADOR="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "NAVEGADOR=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined NAVEGADOR if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "NAVEGADOR=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined NAVEGADOR if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "NAVEGADOR=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not defined NAVEGADOR if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "NAVEGADOR=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined NAVEGADOR if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "NAVEGADOR=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

rem Perfil separado: garante uma janela nova em tela cheia mesmo com o navegador ja aberto.
set "PERFIL=%LocalAppData%\CodigoDaVinci\navegador"

rem Espera uns segundos o servidor subir antes de abrir o navegador.
if defined NAVEGADOR (
    start "" /b cmd /c "ping -n 4 127.0.0.1 >nul & start "" "%NAVEGADOR%" --start-fullscreen --no-first-run --no-default-browser-check --autoplay-policy=no-user-gesture-required --user-data-dir="%PERFIL%" http://localhost:8000"
) else (
    start "" /b cmd /c "ping -n 4 127.0.0.1 >nul & start "" http://localhost:8000"
)

python manage.py runserver 0.0.0.0:8000

pause
