/**
 * Simple bandwidth adaptation: monitor packet loss via getStats and
 * adjust video bitrate via RTCRtpSender.setParameters.
 *
 * Strategy:
 * - Sample stats every 5 seconds
 * - Track packet loss ratio over the last sample
 * - If loss > 5%, halve max bitrate (down to 100kbps floor)
 * - If loss < 1% for 3 consecutive samples, double max bitrate
 *   (up to 1.5Mbps ceiling)
 */

const SAMPLE_INTERVAL_MS = 5000;
const LOSS_HIGH = 0.05;
const LOSS_LOW = 0.01;
const MIN_BITRATE = 100_000; // 100 kbps
const MAX_BITRATE = 1_500_000; // 1.5 Mbps
const INITIAL_BITRATE = 800_000; // 800 kbps

interface MonitorState {
  pc: RTCPeerConnection;
  bitrate: number;
  goodSamples: number;
  lastPacketsSent: number;
  lastPacketsLost: number;
  intervalId: any;
  stopped: boolean;
}

export function startBandwidthMonitor(pc: RTCPeerConnection): () => void {
  const state: MonitorState = {
    pc,
    bitrate: INITIAL_BITRATE,
    goodSamples: 0,
    lastPacketsSent: 0,
    lastPacketsLost: 0,
    intervalId: null,
    stopped: false,
  };

  // Apply initial bitrate to all video senders
  applyBitrate(pc, state.bitrate);

  state.intervalId = setInterval(async () => {
    if (state.stopped) return;
    if (pc.connectionState !== "connected") return;

    try {
      const stats = await pc.getStats();
      let packetsSent = 0;
      let packetsLost = 0;
      stats.forEach((report: any) => {
        if (report.type === "outbound-rtp" && report.kind === "video") {
          packetsSent += report.packetsSent || 0;
        }
        if (report.type === "remote-inbound-rtp" && report.kind === "video") {
          packetsLost += report.packetsLost || 0;
        }
      });

      const deltaSent = packetsSent - state.lastPacketsSent;
      const deltaLost = packetsLost - state.lastPacketsLost;
      state.lastPacketsSent = packetsSent;
      state.lastPacketsLost = packetsLost;

      if (deltaSent > 0) {
        const lossRatio = deltaLost / (deltaSent + deltaLost);
        if (lossRatio > LOSS_HIGH) {
          // Bad: reduce
          const newBitrate = Math.max(MIN_BITRATE, Math.floor(state.bitrate / 2));
          if (newBitrate !== state.bitrate) {
            console.log(`Bandwidth: loss ${(lossRatio * 100).toFixed(1)}%, reducing to ${newBitrate}`);
            state.bitrate = newBitrate;
            state.goodSamples = 0;
            applyBitrate(pc, newBitrate);
          }
        } else if (lossRatio < LOSS_LOW) {
          state.goodSamples++;
          if (state.goodSamples >= 3 && state.bitrate < MAX_BITRATE) {
            const newBitrate = Math.min(MAX_BITRATE, state.bitrate * 2);
            console.log(`Bandwidth: stable, raising to ${newBitrate}`);
            state.bitrate = newBitrate;
            state.goodSamples = 0;
            applyBitrate(pc, newBitrate);
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }, SAMPLE_INTERVAL_MS);

  return () => {
    state.stopped = true;
    if (state.intervalId) clearInterval(state.intervalId);
  };
}

function applyBitrate(pc: RTCPeerConnection, bitrate: number) {
  pc.getSenders().forEach((sender) => {
    if (sender.track?.kind !== "video") return;
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }
    params.encodings[0].maxBitrate = bitrate;
    sender.setParameters(params).catch((e) => {
      console.warn("setParameters failed:", e);
    });
  });
}
