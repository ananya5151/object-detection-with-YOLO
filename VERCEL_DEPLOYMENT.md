# Vercel Deployment Guide

## ✅ What's Fixed

Your app now works on Vercel by:

1. **Making Socket.IO optional** - Only loads in server mode (development)
2. **Defaulting to WASM mode** - Browser-based inference, no server needed
3. **Hiding server mode in production** - The mode selector only appears in development
4. **Adding vercel.json** - Ensures proper WASM headers for ONNX Runtime

## 🚀 Deployment Steps

### Automatic Deployment (Recommended)

1. Your code is already pushed to GitHub
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub
3. Click **"Add New Project"**
4. Select your repository: `object-detection-with-YOLO`
5. Click **"Deploy"** (Vercel auto-detects Next.js)
6. Wait ~2 minutes for deployment

### Environment Variables (if needed)

If you have `.env.local` variables, add them in Vercel:

- Go to your project → Settings → Environment Variables
- Add any required variables from `.env.local`

## 🧪 Testing After Deployment

1. **Desktop**: Visit your Vercel URL (e.g., `https://your-app.vercel.app`)
2. **Phone**: Scan the QR code or visit the same URL on your phone
3. **Grant camera permission** on your phone
4. **Start streaming** - You should see real-time object detection

## ⚠️ Known Limitations on Vercel

### Socket.IO Not Supported

- Vercel uses **serverless functions** which don't support persistent WebSocket connections
- Your app automatically falls back to **WASM-only mode** on Vercel
- This is actually better: no server costs, entirely client-side inference!

### WebRTC Peer-to-Peer

- Your phone and laptop communicate **directly** via WebRTC
- No server-side video processing needed
- Detection runs in the browser using ONNX Runtime WASM

## 🐛 Troubleshooting

### "Cannot find models" error

**Solution**: Make sure `public/onnx-wasm/` contains the WASM files

```bash
# These should exist:
public/onnx-wasm/ort-wasm.wasm
public/onnx-wasm/ort-wasm-simd.wasm
public/onnx-wasm/ort-wasm-threaded.wasm
```

### Camera not working on phone

**Solution**:

- Ensure you're using **HTTPS** (Vercel provides this automatically)
- Grant camera permissions when prompted
- Try reloading the page

### Detection not appearing

**Solution**:

- Check browser console for errors
- Ensure you're on the `/phone` page on your mobile device
- Make sure you clicked "Start Camera" and "Start Streaming"

### "SharedArrayBuffer is not defined" error

**Solution**: This should be fixed by the COOP/COEP headers in `vercel.json`. If it persists:

- Check that `vercel.json` is in your project root
- Redeploy the app

## 📊 Performance Tips

### For Best Results

1. **Use a modern browser** (Chrome, Edge, Safari on iOS 15.2+)
2. **Good lighting** - Better lighting = better detections
3. **Stable connection** - WiFi is better than mobile data for WebRTC
4. **Hold steady** - Reduce motion blur for better accuracy

## 🔧 Advanced Configuration

### Switching Models

Edit `lib/webrtc-manager.ts` to change the model:

```typescript
// Default is yolov5n.onnx (fastest, good accuracy)
// You can add other models to public/models/
```

### Adjusting Detection Threshold

```typescript
// In webrtc-manager.ts
private detectionThreshold = 0.6  // Lower = more detections (more false positives)
```

## 📝 Next Steps

1. **Custom Domain**: Add your own domain in Vercel project settings
2. **Analytics**: Add Vercel Analytics to track usage
3. **Monitoring**: Set up Sentry or LogRocket for error tracking
4. **Optimize**: Compress models further for faster loading

## 🎯 Architecture on Vercel

```
┌─────────────────────────────────────────────┐
│  Vercel (Static Hosting + Serverless APIs) │
├─────────────────────────────────────────────┤
│  - Serves Next.js app (static pages)        │
│  - API routes run as serverless functions   │
│  - No persistent server = No Socket.IO      │
└─────────────────────────────────────────────┘
                    ↓ ↑
                  HTTPS
                    ↓ ↑
        ┌───────────────────────┐
        │   Browser (Laptop)     │
        │  - WASM inference      │
        │  - WebRTC receiver     │
        └───────────────────────┘
                    ↕
              WebRTC P2P
              (Direct)
                    ↕
        ┌───────────────────────┐
        │  Browser (Phone)       │
        │  - Camera capture      │
        │  - WebRTC sender       │
        └───────────────────────┘
```

## ✅ Verification Checklist

- [ ] Code pushed to GitHub
- [ ] Vercel project created and linked
- [ ] Deployment successful (check Vercel dashboard)
- [ ] App loads on desktop browser
- [ ] QR code displays correctly
- [ ] Phone can access the app via HTTPS
- [ ] Camera permission granted on phone
- [ ] Video stream appears on desktop
- [ ] Object detection overlays working
- [ ] No console errors related to Socket.IO

---

**Need Help?** Check the browser console (F12) for detailed error messages.
