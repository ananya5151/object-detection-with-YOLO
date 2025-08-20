# 🚀 Deployment Guide

## Quick Deploy Options

### Option 1: Render.com (Recommended - Free Tier Available)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/ananya5151/object-detection-with-YOLO)

1. **Click the deploy button above** or go to [Render.com](https://render.com)
2. **Connect your GitHub** account
3. **Select this repository**: `ananya5151/object-detection-with-YOLO`
4. **Render will automatically**:
   - Use `Dockerfile.simple` for the build
   - Set environment variables from `render.yaml`
   - Deploy on the free tier
5. **Your app will be live** at: `https://your-app-name.onrender.com`

### Option 2: Railway (Simple One-Click)

1. Go to [Railway.app](https://railway.app)
2. Click **"Deploy from GitHub"**
3. Select this repository
4. Railway will auto-detect and deploy
5. Your app will be live at: `https://your-app-name.railway.app`

### Option 3: Heroku (Classic Platform)

1. **Install Heroku CLI** and login: `heroku login`
2. **Create a new app**:

   ```bash
   heroku create your-app-name
   ```

3. **Deploy**:

   ```bash
   git push heroku main
   ```

4. **Your app will be live** at: `https://your-app-name.herokuapp.com`

### Option 4: DigitalOcean App Platform

1. Go to [DigitalOcean Apps](https://cloud.digitalocean.com/apps)
2. Click **"Create App"**
3. Connect your GitHub repository
4. Select **Docker** as the build method
5. Use `Dockerfile.simple` as the dockerfile path
6. Deploy on the basic tier ($5/month)

## 🐳 Local Docker Deployment

### Build and Run Locally

```bash
# Build the Docker image
docker build -f Dockerfile.simple -t webrtc-detection .

# Run the container
docker run -p 3000:3000 -e MODE=wasm webrtc-detection

# Access your app at http://localhost:3000
```

### Using Docker Compose

```bash
# Start the application
docker-compose up

# Access your app at http://localhost:3000
```

## 🌐 Production Configuration

### Environment Variables

Set these environment variables in your deployment platform:

```env
NODE_ENV=production
MODE=wasm
PORT=3000
HOSTNAME=0.0.0.0
NEXT_TELEMETRY_DISABLED=1
```

### Health Check Endpoint

Your deployment will include a health check at:

```
GET /api/health
```

Response:

```json
{
  "status": "healthy",
  "timestamp": "2025-08-21T10:30:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "mode": "wasm",
  "version": "1.0.0"
}
```

## 📋 Deployment Checklist

- [ ] ✅ **Repository is public** (required for free tiers)
- [ ] ✅ **All files committed** to GitHub
- [ ] ✅ **Choose deployment platform** (Render recommended)
- [ ] ✅ **Click deploy button** or follow platform instructions
- [ ] ✅ **Wait for build** (2-5 minutes)
- [ ] ✅ **Test health endpoint**: `https://your-app.com/api/health`
- [ ] ✅ **Test main app**: `https://your-app.com`

## 🛠️ Troubleshooting

### Build Issues

- **ONNX Build Fails**: Using `Dockerfile.simple` which skips complex ONNX builds
- **Out of Memory**: Increased Node.js memory limit in Docker
- **Timeout**: Using fallback from production to dev mode if build fails

### Runtime Issues

- **Health Check Fails**: Check logs for startup errors
- **WASM Mode Only**: Deployment uses WASM mode for maximum compatibility
- **Port Issues**: App automatically uses `$PORT` environment variable

### Platform-Specific Notes

#### Render.com

- ✅ **Free tier available** (750 hours/month)
- ✅ **Automatic HTTPS**
- ✅ **Custom domains** supported
- ⏱️ **Cold starts** on free tier (30-60 seconds)

#### Railway

- ✅ **$5/month** after free trial
- ✅ **No cold starts**
- ✅ **Excellent performance**
- 💰 **Pay per usage**

#### Heroku

- 💰 **$7/month minimum**
- ✅ **Reliable platform**
- ✅ **Extensive add-ons**
- ⏱️ **30-second cold starts**

## 🎯 Live Demo

Once deployed, your app will include:

- 📱 **Phone camera interface** at `/phone`
- 💻 **Main detection view** at `/`
- 📊 **Health monitoring** at `/api/health`
- 🔄 **WebRTC streaming** with automatic fallbacks
- 🧠 **AI object detection** running in browser
- 📈 **Real-time performance metrics**

## 🔗 Quick Links

- **GitHub Repository**: <https://github.com/ananya5151/object-detection-with-YOLO>
- **Render Deploy**: <https://render.com/deploy?repo=https://github.com/ananya5151/object-detection-with-YOLO>
- **Railway Deploy**: <https://railway.app/new/template?template=https://github.com/ananya5151/object-detection-with-YOLO>

---

**🎉 Your real-time WebRTC object detection system is now ready for production deployment!**
