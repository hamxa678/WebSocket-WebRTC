# WebSocket + WebRTC Chat

Real-time text chat (Socket.IO) + 1:1 video calling (WebRTC).

## 🚀 Quick Start

1) Install Node.js 18+  
2) In this folder, run:

```bash
npm install
npm start
```

The server listens on `0.0.0.0:3000`.

Open on your PC:
```
http://localhost:3000
```

Open on your phone (same Wi‑Fi), replacing with your Mac/PC LAN IP:
```
http://<your-lan-ip>:3000
```

## 🎥 How it works
- Text: Socket.IO broadcasts messages, presence, typing.
- Video/Audio: Browser-to-browser via WebRTC. We use Socket.IO only for signaling
  (`webrtc-offer`, `webrtc-answer`, `webrtc-candidate`).
- STUN server: `stun:stun.l.google.com:19302` to discover public addresses.

## ⚠️ Notes / Troubleshooting
- Works great on LAN. Across the internet, some NATs require a **TURN** server.
- On iOS Safari, autoplay requires `playsinline` and local video is muted.
- If you see a blank video, check camera/mic permissions in the browser.
- If your router has AP/Client Isolation, devices can’t see each other.
- If macOS firewall is enabled, allow Node.js incoming connections.

## 🛠 Dev
```bash
npm run dev
```
(watches and restarts `server.js` on changes)

## 🔐 Production ideas
- Add rooms and explicit invites
- Auth (JWT), user identities
- Persist messages, store chat history
- HTTPS + secure TURN server (coturn)
# WebSocket-WebRTC
