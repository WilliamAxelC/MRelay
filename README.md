# Muser Jam

Muser is a synchronized collaborative music session and audio relay platform. It enables friends and devices (PC & mobile) to listen to music concurrently with sub-50ms WebRTC Peer-to-Peer DataChannel synchronization, Spotify Jam-style collaborative queues, track upvoting, ambient visuals, and zero external database dependencies.

## ✨ Features

- **⚡ Direct WebRTC Peer-to-Peer DataChannels**: Ultra-low latency playhead synchronization, playback mutations, and chat transmitted directly between peer devices with automatic WebSocket relay fallback.
- **🎵 Spotify Jam-Style Collaborative Queue**:
  - Track upvoting/voting to collaboratively bump popular songs.
  - "Added by @username" avatar chips on all tracks.
  - Drag-and-drop & mobile touch reordering.
  - Host governance modes: Open Jam vs. Restricted / Host-Approval.
  - Playback history with one-tap re-add.
- **📱 Mobile-First Responsive Design**:
  - Full-screen Now Playing card with dynamic ambient glow matching track artwork.
  - Sticky mini-player with bottom navigation bar for quick queue/search/chat switching.
  - Camera-scannable QR Code modal for instant mobile phone joining.
  - Mobile browser audio unlock helper and lockscreen `MediaSession` controls.
- **🚀 Zero-Redis In-Memory Architecture**: Lightweight, high-performance in-memory room store with automatic TTL decay when sessions end. No Redis daemon or external databases required.
- **🔍 Instant YouTube Search & Playlist Unrolling**: Fast debounced search with in-memory LRU caching, track duration previews, and channel metadata.
- **🛡️ Detached & Data Saver Modes**: Independent session listening mode and low-bandwidth background audio rendering.

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS, Lucide Icons, WebRTC DataChannels
- **Backend**: Node.js, Express, Socket.io, TypeScript, Vitest
- **Infrastructure**: Nginx, Docker / Docker Compose (Redis-free)

## 🚀 Quickstart & Development

### 1. Local Development (No Docker Required)

```bash
# Start backend (Port 3000)
cd backend
npm install
npm start

# Start frontend (Port 5173 / dev server)
cd ../frontend
npm install --legacy-peer-deps
npm run dev
```

### 2. Docker Deployment

```bash
cd infrastructure
docker compose up -d --build
```
Access the web application at `http://localhost:8080`.

## 🧪 Testing

```bash
# Run unit test suite
cd backend
npm test

# Run multi-client P2P simulation test
npm run test:simulation

# Verify frontend build & type checks
cd ../frontend
npm run build
npm run lint
```

## 📚 Technical Documentation

Comprehensive architectural and engineering documentation is available in the [`docs/`](docs/) directory:

- [**System Architecture & Technical Design**](docs/ARCHITECTURE.md): In-memory RoomStore, data models, state synchronization, and component hierarchy.
- [**WebRTC, Real-Time Networking & Security**](docs/NETWORKING_AND_P2P.md): Deep-dive on DTLS, SCTP, SDP/ICE, STUN vs TURN, and Token-Bucket rate limiting.
- [**QA Audit & Performance Optimizations**](docs/QA_AUDIT_AND_INEFFICIENCIES.md): High-priority performance bottlenecks, GPU rendering fixes, and memory optimizations.
