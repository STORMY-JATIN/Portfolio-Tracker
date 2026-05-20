@echo off
set DIR=%~dp0
set WRAPPER_JAR=%DIR%gradle\wrapper\gradle-wrapper.jar

if not exist "%WRAPPER_JAR%" (
    where gradle >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        gradle %*
        exit /b %ERRORLEVEL%
    )
    echo Gradle wrapper jar not found. Attempting to download...
    if not exist "%DIR%gradle\wrapper" mkdir "%DIR%gradle\wrapper"
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('https://github.com/gradle/gradle/raw/v8.5.0/gradle/wrapper/gradle-wrapper.jar', '%WRAPPER_JAR%')"
)

if not exist "%WRAPPER_JAR%" (
    echo Error: Could not locate or download gradle-wrapper.jar
    exit /b 1
)

set JAVACMD=java
if defined JAVA_HOME set JAVACMD="%JAVA_HOME%\bin\java.exe"

%JAVACMD% -classpath "%WRAPPER_JAR%" org.gradle.wrapper.GradleWrapperMain %*
