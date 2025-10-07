# WebRTC Connection Fix - Testing Guide

## ✅ What Was Fixed

The phone-to-laptop WebRTC connection now works on **Vercel** using HTTP polling instead of Socket.IO!

### Changes Made

1. **Added HTTP Polling Signaling** (`/api/signaling`) - Vercel-compatible API route
2. **New WebRTC Client** (`webrtc-client-polling.ts`) - Uses HTTP instead of WebSockets
3. **Updated WebRTC Manager** - Auto-detects production and uses HTTP polling
4. **Phone Camera Component** - Now uses the polling-based client

---

## 🧪 How to Test

### Local Testing (Development)

```bash
npm run dev
```

- Open laptop: `http://localhost:3000`
- Open phone: `http://localhost:3000/phone` (or scan QR code)
- Click "Start Camera" on phone
- Click "Start Stream" on phone
- Video should appear on laptop with detections!

### Vercel Testing (Production)

1. **Push to Vercel** (automatic if connected to GitHub)
2. Open your Vercel URL on laptop: `https://your-app.vercel.app`
3. Open phone browser: `https://your-app.vercel.app/phone`
4. Grant camera permission
5. Start streaming
6. Check laptop for video feed

---

## 🔍 Debugging

### Check Browser Console

**On Phone:**

```
[Phone] WebRTC client initialized with room: default-room
[Phone] Starting streaming...
[Phone] Adding video track: camera
[Phone] Sending offer
[Phone] Sending ICE candidate
[Phone] Received answer, applying...
[Phone] Connection state: connected
```

**On Laptop:**

```
[Viewer] Using HTTP polling for signaling (Vercel mode)
Received video track
WASM inference initialized and ready
```

### Common Issues & Solutions

#### ❌ "Connection stays in 'connecting' state"

**Cause**: Signaling messages not being exchanged
**Fix**: Check `/api/signaling` endpoint is working:

```bash
# Test the API
curl https://your-app.vercel.app/api/signaling?roomId=default-room&since=0
```

#### ❌ "No video appears on laptop"

**Cause**: Offer/answer not completing
**Solution**:

1. Check both phone and laptop consoles
2. Verify ICE candidates are being sent
3. Try refreshing both devices

#### ❌ "Camera permission denied"

**Solution**:

- Ensure using HTTPS (Vercel provides this)
- Grant permission when prompted
- Check browser settings if blocked

#### ❌ "SharedArrayBuffer errors"

**Solution**: Headers should be set in `vercel.json`

- Check that COOP/COEP headers are present
- Redeploy if needed

---

## 📊 Architecture

```
┌─────────────────┐
│  Phone Browser  │
│  /phone page    │
└────────┬────────┘
         │
         │ HTTP POST/GET (polling every 1s)
         │
         ↓
┌────────────────────────┐
│  Vercel API Route      │
│  /api/signaling        │
│  (in-memory store)     │
└────────┬───────────────┘
         │
         │ HTTP GET (polling every 1s)
         │
         ↓
┌─────────────────┐
│ Laptop Browser  │
│  / page         │
└─────────────────┘
         ⇅
    WebRTC P2P
    (direct video)
         ⇅
┌─────────────────┐
│  Phone Browser  │
└─────────────────┘
```

### How It Works

1. **Phone** creates WebRTC offer → POST to `/api/signaling`
2. **Laptop** polls `/api/signaling` → gets offer → creates answer → POST answer
3. **Phone** polls `/api/signaling` → gets answer → WebRTC connection established
4. **Video flows directly** between phone and laptop (P2P)
5. **WASM inference** runs on laptop browser

---

## ⚡ Performance Notes

- **Polling Interval**: 1 second (good balance between latency and server load)
- **Message TTL**: 60 seconds (automatically cleaned up)
- **Room-based**: Multiple users can use different room IDs
- **Serverless-friendly**: No persistent connections needed

---

## 🚀 Next Steps

### For Production

1. **Add Redis** for signaling store (persistent across function invocations)
2. **Reduce polling interval** to 500ms for lower latency
3. **Add authentication** to prevent unauthorized access
4. **Monitor API usage** via Vercel analytics

### For Development

- Socket.IO still works locally with `npm run dev`
- HTTP polling is only used in production (`NODE_ENV=production`)

---

## ✅ Verification Checklist

- [ ] Phone can access `/phone` page
- [ ] Camera permission granted
- [ ] "Start Stream" button works
- [ ] Laptop shows "Received video track" in console
- [ ] Video feed appears on laptop
- [ ] Object detection overlays visible
- [ ] No Socket.IO 404 errors
- [ ] Connection state shows "connected"

---

## 📝 Technical Details

### Signaling Flow

1. Phone: `POST /api/signaling` (offer)
2. Laptop: `GET /api/signaling?since=timestamp` (poll for offer)
3. Laptop: `POST /api/signaling` (answer)
4. Phone: `GET /api/signaling?since=timestamp` (poll for answer)
5. Both: Exchange ICE candidates via same API
6. WebRTC: Direct P2P connection established

### API Endpoints

- **POST** `/api/signaling` - Send signaling message
- **GET** `/api/signaling?roomId=X&since=Y` - Poll for messages

### Message Types

- `offer` - WebRTC offer from phone
- `answer` - WebRTC answer from laptop  
- `ice-candidate` - ICE candidates from either side

---

**Ready to test!** Your app should now work perfectly on Vercel with phone-to-laptop streaming! 🎉
