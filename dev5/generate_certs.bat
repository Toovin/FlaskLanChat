@echo off
echo ========================================
echo FlaskLanChat SSL Certificate Generator
echo ========================================
echo.
echo This script will generate self-signed SSL certificates
echo for FlaskLanChat HTTPS server.
echo.
echo You will need to update the IP addresses in the script
echo to match your network configuration.
echo.

REM Get server IP addresses from user input
set /p SERVER_IP1="Enter your primary server IP address: "
if "%SERVER_IP1%"=="" (
    echo ERROR: Primary server IP is required.
    pause
    exit /b 1
)

set /p SERVER_IP2="Enter secondary server IP (or press Enter to skip): "
set /p SERVER_IP3="Enter tertiary server IP (or press Enter to skip): "

echo.
echo Using IP addresses:
echo - %SERVER_IP1%
if "%SERVER_IP2%" NEQ "" echo - %SERVER_IP2%
if "%SERVER_IP3%" NEQ "" echo - %SERVER_IP3%
echo.

REM Check if OpenSSL is available
openssl version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: OpenSSL is not installed or not in PATH.
    echo Please install OpenSSL and try again.
    echo.
    echo You can download OpenSSL from: https://slproweb.com/products/Win32OpenSSL.html
    pause
    exit /b 1
)

echo Generating SSL certificates...
echo.

REM Build subjectAltName extension
set ALT_NAMES=IP:%SERVER_IP1%
if "%SERVER_IP2%" NEQ "" set ALT_NAMES=%ALT_NAMES%,IP:%SERVER_IP2%
if "%SERVER_IP3%" NEQ "" set ALT_NAMES=%ALT_NAMES%,IP:%SERVER_IP3%

REM Generate private key and certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/C=US/ST=CA/L=Network/O=FlaskLanChat/CN=%SERVER_IP1%" -addext "subjectAltName=%ALT_NAMES%"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo SUCCESS: SSL certificates generated!
    echo ========================================
    echo.
    echo Certificate files created:
    echo - cert.pem (SSL certificate)
    echo - key.pem (private key)
    echo.
    echo Valid for IP addresses:
    echo - %SERVER_IP1%
    if "%SERVER_IP2%" NEQ "" echo - %SERVER_IP2%
    if "%SERVER_IP3%" NEQ "" echo - %SERVER_IP3%
    echo.
    echo Expires: This certificate is valid for 365 days
    echo.
    echo You can now run the server with:
    echo python server_v5.py
    echo.
) else (
    echo.
    echo ERROR: Failed to generate certificates.
    echo Please check the error messages above.
    echo.
)

echo Press any key to continue...
pause >nul