// Default ICE servers used everywhere a fresh RTCPeerConnection is created.
// Includes Google STUN and OpenRelay public TURN (free tier) so calls work
// behind symmetric NATs without an Urbit-side TURN credential exchange.
//
// OpenRelay: https://www.metered.ca/tools/openrelay/

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

export const DEFAULT_RTC_CONFIG: RTCConfiguration = {
  iceServers: DEFAULT_ICE_SERVERS,
};
