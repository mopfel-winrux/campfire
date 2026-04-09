# Campfire

WebRTC voice and video calling for Urbit. Updated for modern Urbit OS (zuse 409).

## Architecture

- `desk/` — Assembled Urbit desk (Hoon agents + built frontend)
- `campfire/ui/` — React 18 + Tailwind frontend
- `packages/rtcswitchboard-js/` — JS library for WebRTC signaling via Urbit
- `packages/icepond-js/` — JS library for ICE server discovery

### Agents

- **rtcswitchboard** — WebRTC signaling (SDP/ICE exchange between ships)
- **icepond** — ICE/STUN/TURN server discovery
- **campfire** — Room management (create, join, leave rooms)
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

## TODO

- [ ] **Tlon DM integration** — Replace ephemeral WebRTC data channel chat with Tlon's DM system (`%chat` agent) for 1:1 calls. Use `chat-dm-action-1` mark for sending, subscribe to `/dm/~ship` for live updates, scry `/dm/~ship/writs/newest/N/outline` for history. Reference `~/git/tlon-apps` for the exact frontend API.
- [ ] **Group calls (mesh)** — Room participants establish N-1 rtcswitchboard connections. Video grid UI for 2-6 people.
- [ ] **Shareable room links** — `/room/~host/name` URLs that others can join
- [ ] **Public rooms** — Non-Urbit guests join via unauthenticated Eyre endpoint with just a display name
- [ ] **Tlon contacts** — Show contacts from `%contacts` agent on the home screen for one-tap calling
- [ ] **Reconnection** — Auto-reconnect dropped peers, survive page refreshes
- [ ] **Bandwidth adaptation** — Degrade video quality on poor connections, prioritize audio
- [ ] **SFU for 6+ participants** — Design campfire agent so an external SFU can be plugged in later

## Design

See [DESIGN.md](DESIGN.md) for WebRTC/Urbit architecture details.
