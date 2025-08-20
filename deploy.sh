#!/bin/bash

# 🚀 One-Click Deploy Script for Object Detection App
# Run this script to deploy your app to multiple platforms

echo "🎯 Object Detection App - Deployment Script"
echo "=========================================="
echo ""

# Check if git repo is clean
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  Warning: Uncommitted changes detected"
    echo "🔧 Committing changes..."
    git add .
    git commit -m "Auto-commit before deployment"
fi

echo "📋 Available Deployment Options:"
echo ""
echo "1. 🎨 Render.com (Free tier, recommended)"
echo "2. 🚂 Railway (Fast, $5/month after trial)"
echo "3. 📦 Heroku (Classic, $7/month)"
echo "4. 🌊 DigitalOcean ($5/month)"
echo "5. 🐳 Local Docker"
echo ""

read -p "Choose deployment option (1-5): " choice

case $choice in
    1)
        echo "🎨 Deploying to Render.com..."
        echo "📖 Opening deployment guide..."
        if command -v xdg-open > /dev/null; then
            xdg-open "https://render.com/deploy?repo=$(git config --get remote.origin.url)"
        elif command -v open > /dev/null; then
            open "https://render.com/deploy?repo=$(git config --get remote.origin.url)"
        else
            echo "🔗 Visit: https://render.com/deploy?repo=$(git config --get remote.origin.url)"
        fi
        ;;
    2)
        echo "🚂 Deploying to Railway..."
        if command -v railway > /dev/null; then
            railway login
            railway deploy
        else
            echo "📦 Installing Railway CLI..."
            npm install -g @railway/cli
            railway login
            railway deploy
        fi
        ;;
    3)
        echo "📦 Deploying to Heroku..."
        if command -v heroku > /dev/null; then
            heroku login
            heroku create "webrtc-detection-$(date +%s)"
            git push heroku main
        else
            echo "❌ Heroku CLI not found. Please install from: https://devcenter.heroku.com/articles/heroku-cli"
        fi
        ;;
    4)
        echo "🌊 Deploying to DigitalOcean..."
        echo "🔗 Visit: https://cloud.digitalocean.com/apps"
        echo "📝 Instructions:"
        echo "   1. Create new App"
        echo "   2. Connect GitHub repo: $(git config --get remote.origin.url)"
        echo "   3. Use Dockerfile.simple"
        echo "   4. Deploy!"
        ;;
    5)
        echo "🐳 Building and running locally with Docker..."
        
        # Build Docker image
        echo "🔧 Building Docker image..."
        docker build -f Dockerfile.simple -t webrtc-detection .
        
        if [ $? -eq 0 ]; then
            echo "✅ Build successful!"
            echo "🚀 Starting container..."
            docker run -p 3000:3000 -e MODE=wasm webrtc-detection
        else
            echo "❌ Build failed. Check Dockerfile.simple"
        fi
        ;;
    *)
        echo "❌ Invalid option. Please choose 1-5."
        exit 1
        ;;
esac

echo ""
echo "✅ Deployment initiated!"
echo "📊 Health check endpoint: /api/health"
echo "📱 Phone camera: /phone"
echo "💻 Main app: /"
echo ""
echo "🎉 Your real-time object detection app is deploying!"
