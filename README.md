# Campfire

WebRTC voice and video calling for Urbit. Updated for modern Urbit OS (zuse 409).

## Features

- 1:1 voice/video calls between Urbit ships
- Group calls in rooms (mesh topology, 2-6 people)
- **Public rooms** — non-Urbit users can join via a shared link
- Host acts as SFU so guests see all room members
- Audio-only mode
- Tlon contacts speed dial
- Browser notifications for incoming calls
- Auto-reconnect on dropped peer connections
- Adaptive video bitrate on poor networks
- Ephemeral data-channel chat in rooms
- Disconnect propagation across tabs (beforeunload)

## Architecture

- `desk/` — Assembled Urbit desk (Hoon agents + built frontend)
- `campfire/ui/` — React 18 + Tailwind frontend
- `packages/rtcswitchboard-js/` — JS library for WebRTC signaling via Urbit
- `packages/icepond-js/` — JS library for ICE server discovery

### Agents

- **rtcswitchboard** — WebRTC signaling (SDP/ICE exchange between ships)
- **icepond** — ICE/STUN/TURN server discovery
- **campfire** — Room management + public guest signaling relay
- **campfire-fileserver** — Serves the frontend from Clay

## Getting Started

```bash
# Build local packages
cd packages/icepond-js && npm install && npm run build
cd ../rtcswitchboard-js && npm install && npm run build

# Build frontend
cd ../../campfire/ui && npm install && npm run build

# Deploy to a running ship
cp -r ../../desk/* /path/to/your/pier/campfire/
# Then in dojo: |commit %campfire
```

## Roadmap

- [ ] **Tlon DM integration** — Replace ephemeral WebRTC data-channel chat with Tlon's DM system (`%chat` agent) for 1:1 calls. Use `chat-dm-action-1` mark for sending, subscribe to `/dm/~ship` for live updates, scry `/dm/~ship/writs/newest/N/outline` for history. Reference `~/git/tlon-apps` for the exact frontend API.
- [ ] **SFU for 6+ participants** — Design the host SFU pattern (already in use for guests) to handle larger groups, or wire in an external SFU like mediasoup.
- [ ] **Screen sharing** — Add `getDisplayMedia` toggle to room UI.
- [ ] **TURN credentials** — Wire up the existing `uturn` agent so calls work behind symmetric NATs.

## Design

See [DESIGN.md](DESIGN.md) for WebRTC/Urbit architecture details.
