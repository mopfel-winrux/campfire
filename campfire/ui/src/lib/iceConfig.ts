// Default ICE servers used everywhere a fresh RTCPeerConnection is created.
// STUN-only for now: works for direct peers and most cone-NAT scenarios.
// Calls between peers behind symmetric NATs will fail until a TURN server
// is configured.

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

export const DEFAULT_RTC_CONFIG: RTCConfiguration = {
  iceServers: DEFAULT_ICE_SERVERS,
};
