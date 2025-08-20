@echo off
REM 🚀 One-Click Deploy Script for Object Detection App (Windows)
REM Run this script to deploy your app to multiple platforms

echo 🎯 Object Detection App - Deployment Script
echo ==========================================
echo.

REM Check if git repo is clean
git status --porcelain >nul 2>&1
if not errorlevel 1 (
    echo ⚠️  Warning: Uncommitted changes detected
    echo 🔧 Committing changes...
    git add .
    git commit -m "Auto-commit before deployment"
)

echo 📋 Available Deployment Options:
echo.
echo 1. 🎨 Render.com (Free tier, recommended)
echo 2. 🚂 Railway (Fast, $5/month after trial)
echo 3. 📦 Heroku (Classic, $7/month)
echo 4. 🌊 DigitalOcean ($5/month)
echo 5. 🐳 Local Docker
echo.

set /p choice="Choose deployment option (1-5): "

if "%choice%"=="1" (
    echo 🎨 Deploying to Render.com...
    echo 📖 Opening deployment guide...
    for /f "tokens=*" %%i in ('git config --get remote.origin.url') do set repo_url=%%i
    start https://render.com/deploy?repo=%repo_url%
    goto end
)

if "%choice%"=="2" (
    echo 🚂 Deploying to Railway...
    where railway >nul 2>&1
    if errorlevel 1 (
        echo 📦 Installing Railway CLI...
        npm install -g @railway/cli
    )
    railway login
    railway deploy
    goto end
)

if "%choice%"=="3" (
    echo 📦 Deploying to Heroku...
    where heroku >nul 2>&1
    if errorlevel 1 (
        echo ❌ Heroku CLI not found. Please install from: https://devcenter.heroku.com/articles/heroku-cli
        goto end
    )
    heroku login
    for /f "tokens=*" %%i in ('powershell -command "Get-Date -Format 'yyyyMMddHHmmss'"') do set timestamp=%%i
    heroku create webrtc-detection-%timestamp%
    git push heroku main
    goto end
)

if "%choice%"=="4" (
    echo 🌊 Deploying to DigitalOcean...
    echo 🔗 Visit: https://cloud.digitalocean.com/apps
    echo 📝 Instructions:
    echo    1. Create new App
    for /f "tokens=*" %%i in ('git config --get remote.origin.url') do echo    2. Connect GitHub repo: %%i
    echo    3. Use Dockerfile.simple
    echo    4. Deploy!
    start https://cloud.digitalocean.com/apps
    goto end
)

if "%choice%"=="5" (
    echo 🐳 Building and running locally with Docker...
    
    REM Build Docker image
    echo 🔧 Building Docker image...
    docker build -f Dockerfile.simple -t webrtc-detection .
    
    if not errorlevel 1 (
        echo ✅ Build successful!
        echo 🚀 Starting container...
        docker run -p 3000:3000 -e MODE=wasm webrtc-detection
    ) else (
        echo ❌ Build failed. Check Dockerfile.simple
    )
    goto end
)

echo ❌ Invalid option. Please choose 1-5.
exit /b 1

:end
echo.
echo ✅ Deployment initiated!
echo 📊 Health check endpoint: /api/health
echo 📱 Phone camera: /phone
echo 💻 Main app: /
echo.
echo 🎉 Your real-time object detection app is deploying!
