import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { UrbitRTCApp, UrbitRTCIncomingCallEvent, UrbitRTCPeerConnection } from "rtcswitchboard";
import Icepond from "icepond";
import { useUrbit } from "./useUrbit";
import { useSettings } from "./useSettings";
import { startBandwidthMonitor } from "../lib/bandwidth";

const DAP = "campfire";

interface IncomingCall {
  peer: string;
  uuid: string;
  evt: UrbitRTCIncomingCallEvent;
}

interface CallState {
  conn: UrbitRTCPeerConnection | null;
  uuid: string;
  peer: string;
  isCaller: boolean;
  status: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  dataChannel: RTCDataChannel | null;
  dataChannelOpen: boolean;
  messages: { speaker: string; text: string }[];
  wasHungUp: boolean;
}

interface CallCtx {
  incoming: IncomingCall | null;
  call: CallState | null;
  iceServers: RTCIceServer[];
  placeCall: (peer: string) => Promise<string>;
  answerCall: () => Promise<string>;
  rejectCall: () => void;
  hangup: () => void;
  sendMessage: (text: string) => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => Promise<void>;
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenSharing: boolean;
  requestNotificationPermission: () => void;
}

const CallContext = createContext<CallCtx>(null!);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { urbit, ship } = useUrbit();
  const { audioOnly } = useSettings();
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [call, setCall] = useState<CallState | null>(null);
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const rtcAppRef = useRef<UrbitRTCApp | null>(null);
  const callRef = useRef<CallState | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);

  callRef.current = call;

  // Initialize UrbitRTCApp and Icepond
  useEffect(() => {
    if (!ship) return;

    const config: RTCConfiguration = {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };

    const app = new UrbitRTCApp(DAP, config);
    app.urbit = urbit;
    rtcAppRef.current = app;

    app.addEventListener("incomingcall", ((evt: UrbitRTCIncomingCallEvent) => {
      // Only handle 1:1 calls on this dap. Room calls use a different dap.
      if (evt.dap !== "campfire") return;
      setIncoming({ peer: evt.peer, uuid: evt.uuid, evt });

      // Browser notification
      console.log("Notification permission:", "Notification" in window ? Notification.permission : "not available");
      try {
        if ("Notification" in window && Notification.permission === "granted") {
          const n = new Notification("Incoming Call", {
            body: `~${evt.peer} is calling you`,
            tag: "campfire-call",
            requireInteraction: true,
          });
          n.onclick = () => {
            window.focus();
            n.close();
          };
        }
      } catch (e) {
        console.warn("Notification failed:", e);
      }

      // Flash the title
      document.title = `🔥 ~${evt.peer} is calling`;
      let flash = true;
      const titleInterval = setInterval(() => {
        document.title = flash ? `🔥 ~${evt.peer} is calling` : "Campfire";
        flash = !flash;
      }, 1000);
      // Store interval so we can clear it
      (window as any).__campfireTitleFlash = titleInterval;
    }) as EventListener);

    // Icepond
    const pond = new Icepond(urbit);
    pond.oniceserver = (evt) => {
      console.log("ICE server acquired:", evt.newIceServer);
      setIceServers((prev) => [...prev, evt.newIceServer]);
      if (rtcAppRef.current) {
        rtcAppRef.current.configuration = {
          ...rtcAppRef.current.configuration,
          iceServers: [...(rtcAppRef.current.configuration.iceServers || []), evt.newIceServer],
        };
      }
    };
    pond.initialize().catch(console.error);

    return () => {};
  }, [ship, urbit]);

  // Send hangup poke directly — more reliable than conn.close()
  const sendHangupPoke = useCallback(
    (uuid: string) => {
      try {
        urbit.poke({
          app: "rtcswitchboard",
          mark: "rtcswitchboard-from-client",
          json: { tag: "reject", uuid },
        });
      } catch (e) {
        console.warn("Hangup poke failed:", e);
      }
    },
    [urbit]
  );

  const setupConnection = useCallback(
    (conn: UrbitRTCPeerConnection, peer: string, isCaller: boolean) => {
      const remoteStream = new MediaStream();

      const newCall: CallState = {
        conn,
        uuid: conn.uuid || "",
        peer,
        isCaller,
        status: "connecting",
        localStream: null,
        remoteStream,
        dataChannel: null,
        dataChannelOpen: false,
        messages: [],
        wasHungUp: false,
      };

      // Track events
      conn.ontrack = (evt) => {
        console.log("Remote track received:", evt.track.kind);
        remoteStream.addTrack(evt.track);
        setCall((c) =>
          c ? { ...c, remoteStream: new MediaStream(remoteStream.getTracks()) } : c
        );
      };

      // State changes
      conn.onurbitstatechanged = (evt: any) => {
        console.log("Urbit state:", evt.urbitState);
        setCall((c) => (c ? { ...c, status: evt.urbitState } : c));
      };

      // Remote hangup
      conn.addEventListener("hungupcall", () => {
        console.log("Remote hung up");
        setCall((c) => {
          if (c) {
            c.localStream?.getTracks().forEach((t) => t.stop());
          }
          return c ? { ...c, wasHungUp: true, dataChannelOpen: false } : c;
        });
      });

      // Auto-reconnect on disconnect/failed state
      let reconnectAttempts = 0;
      const maxReconnects = 3;
      let disconnectTimer: any = null;

      conn.onconnectionstatechange = () => {
        console.log("WebRTC connection state:", conn.connectionState);
        if (conn.connectionState === "connected") {
          reconnectAttempts = 0;
          if (disconnectTimer) {
            clearTimeout(disconnectTimer);
            disconnectTimer = null;
          }
          return;
        }
        if (conn.connectionState === "disconnected") {
          // Wait briefly to see if it self-recovers
          disconnectTimer = setTimeout(() => {
            if (conn.connectionState === "disconnected" && reconnectAttempts < maxReconnects) {
              console.log("WebRTC: attempting ICE restart, attempt", reconnectAttempts + 1);
              reconnectAttempts++;
              try {
                conn.restartIce();
              } catch (e) {
                console.warn("ICE restart failed", e);
              }
            }
          }, 2000);
          return;
        }
        if (conn.connectionState === "failed") {
          if (reconnectAttempts < maxReconnects) {
            console.log("WebRTC: attempting ICE restart after failure, attempt", reconnectAttempts + 1);
            reconnectAttempts++;
            try {
              conn.restartIce();
            } catch (e) {
              console.warn("ICE restart failed", e);
            }
            return;
          }
          // Give up
          setCall((c) => {
            if (c && !c.wasHungUp) {
              return { ...c, wasHungUp: true, dataChannelOpen: false };
            }
            return c;
          });
        }
      };

      // Data channel
      if (isCaller) {
        const dc = conn.createDataChannel("campfire");
        dc.onopen = () => {
          console.log("Data channel open");
          setCall((c) => (c ? { ...c, dataChannelOpen: true, dataChannel: dc } : c));
        };
        dc.onmessage = (evt) => {
          setCall((c) =>
            c
              ? { ...c, messages: [{ speaker: peer, text: evt.data }, ...c.messages] }
              : c
          );
        };
        newCall.dataChannel = dc;
      } else {
        conn.addEventListener("datachannel", ((evt: RTCDataChannelEvent) => {
          const dc = evt.channel;
          if (dc.label === "campfire") {
            dc.onopen = () => {
              console.log("Data channel open (answerer)");
              setCall((c) => (c ? { ...c, dataChannelOpen: true, dataChannel: dc } : c));
            };
            dc.onmessage = (msgEvt) => {
              setCall((c) =>
                c
                  ? { ...c, messages: [{ speaker: peer, text: msgEvt.data }, ...c.messages] }
                  : c
              );
            };
          }
        }) as EventListener);
      }

      // Get local media — respects audio-only setting
      const constraints = audioOnly
        ? { audio: true, video: false }
        : { audio: true, video: true };
      navigator.mediaDevices
        .getUserMedia(constraints)
        .then((stream) => {
          stream.getTracks().forEach((track) => conn.addTrack(track, stream));
          setCall((c) => (c ? { ...c, localStream: stream } : c));
          // Start bandwidth monitoring once tracks are added
          startBandwidthMonitor(conn);
        })
        .catch(() => {
          navigator.mediaDevices
            .getUserMedia({ audio: true, video: false })
            .then((stream) => {
              stream.getTracks().forEach((track) => conn.addTrack(track, stream));
              setCall((c) => (c ? { ...c, localStream: stream } : c));
            })
            .catch(console.error);
        });

      setCall(newCall);
      conn.initialize();

      // Hangup on tab close using sendBeacon for reliability
      const onBeforeUnload = () => {
        const uuid = conn.uuid;
        if (uuid) {
          // sendBeacon is more reliable than fetch on unload
          const url = `${window.location.origin}/~/channel/${Date.now()}`;
          const body = JSON.stringify([
            {
              id: 1,
              action: "poke",
              ship: ship,
              app: "rtcswitchboard",
              mark: "rtcswitchboard-from-client",
              json: { tag: "reject", uuid },
            },
          ]);
          navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
        }
      };
      window.addEventListener("beforeunload", onBeforeUnload);

      // Clean up beforeunload when call ends
      const origSetCall = setCall;
      conn.addEventListener("hungupcall", () => {
        window.removeEventListener("beforeunload", onBeforeUnload);
      });

      return newCall;
    },
    [ship, audioOnly]
  );

  const placeCall = useCallback(
    async (peer: string): Promise<string> => {
      if (!rtcAppRef.current) throw new Error("Not initialized");
      const conn = rtcAppRef.current.call(peer, DAP);
      setupConnection(conn, peer, true);
      return new Promise((resolve) => {
        conn.onring = (uuid) => {
          setCall((prev) => (prev ? { ...prev, uuid } : prev));
          resolve(uuid);
        };
      });
    },
    [setupConnection]
  );

  const clearIncomingAlert = useCallback(() => {
    document.title = "Campfire";
    if ((window as any).__campfireTitleFlash) {
      clearInterval((window as any).__campfireTitleFlash);
      (window as any).__campfireTitleFlash = null;
    }
  }, []);

  const answerCall = useCallback(async (): Promise<string> => {
    if (!incoming) throw new Error("No incoming call");
    const conn = incoming.evt.answer();
    setupConnection(conn, incoming.peer, false);
    setIncoming(null);
    clearIncomingAlert();
    return incoming.uuid;
  }, [incoming, setupConnection, clearIncomingAlert]);

  const rejectCall = useCallback(() => {
    if (incoming) {
      incoming.evt.reject();
      setIncoming(null);
      clearIncomingAlert();
    }
  }, [incoming, clearIncomingAlert]);

  const hangup = useCallback(() => {
    if (call) {
      call.localStream?.getTracks().forEach((t) => t.stop());
      call.remoteStream?.getTracks().forEach((t) => t.stop());
      // Send hangup directly, then close
      if (call.uuid) sendHangupPoke(call.uuid);
      if (call.conn) {
        try { call.conn.close(); } catch (e) {}
      }
    }
    setCall(null);
    document.title = "Campfire";
  }, [call, sendHangupPoke]);

  const sendMessage = useCallback(
    (text: string) => {
      if (call?.dataChannel && call.dataChannelOpen) {
        call.dataChannel.send(text);
        setCall((c) =>
          c ? { ...c, messages: [{ speaker: "me", text }, ...c.messages] } : c
        );
      }
    },
    [call]
  );

  const toggleAudio = useCallback(() => {
    call?.localStream?.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
      setAudioEnabled(t.enabled);
    });
  }, [call]);

  const toggleVideo = useCallback(() => {
    call?.localStream?.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
      setVideoEnabled(t.enabled);
    });
  }, [call]);

  const toggleScreenShare = useCallback(async () => {
    if (!call?.conn || !call?.localStream) return;
    const sender = call.conn.getSenders().find((s) => s.track?.kind === "video");
    if (!sender) return;

    if (screenSharing) {
      // Restore camera
      const cam = cameraTrackRef.current;
      if (cam) {
        await sender.replaceTrack(cam);
        // Replace track in local stream
        const stream = call.localStream;
        stream.getVideoTracks().forEach((t) => {
          if (t !== cam) {
            stream.removeTrack(t);
            t.stop();
          }
        });
        if (!stream.getVideoTracks().includes(cam)) {
          stream.addTrack(cam);
        }
        setCall((c) => (c ? { ...c, localStream: new MediaStream(stream.getTracks()) } : c));
      }
      cameraTrackRef.current = null;
      setScreenSharing(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        const screenTrack = screenStream.getVideoTracks()[0];
        if (!screenTrack) return;

        // Save the current camera track for restoration
        cameraTrackRef.current = sender.track;
        await sender.replaceTrack(screenTrack);

        // Update local stream to show screen instead of camera
        const stream = call.localStream;
        stream.getVideoTracks().forEach((t) => stream.removeTrack(t));
        stream.addTrack(screenTrack);
        setCall((c) => (c ? { ...c, localStream: new MediaStream(stream.getTracks()) } : c));

        // When user stops sharing via the browser UI
        screenTrack.onended = () => {
          const cam = cameraTrackRef.current;
          if (cam && sender.track === screenTrack) {
            sender.replaceTrack(cam).catch(console.warn);
            stream.removeTrack(screenTrack);
            stream.addTrack(cam);
            setCall((c) => (c ? { ...c, localStream: new MediaStream(stream.getTracks()) } : c));
            cameraTrackRef.current = null;
          }
          setScreenSharing(false);
        };

        setScreenSharing(true);
      } catch (e) {
        console.warn("Screen share failed:", e);
      }
    }
  }, [call, screenSharing]);

  // Must be called from a user gesture (button click)
  const requestNotificationPermission = useCallback(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  return (
    <CallContext.Provider
      value={{
        incoming,
        call,
        iceServers,
        placeCall,
        answerCall,
        rejectCall,
        hangup,
        sendMessage,
        toggleAudio,
        toggleVideo,
        toggleScreenShare,
        audioEnabled,
        videoEnabled,
        screenSharing,
        requestNotificationPermission,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export const useCall = () => useContext(CallContext);
