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
  audioEnabled: boolean;
  videoEnabled: boolean;
}

const CallContext = createContext<CallCtx>(null!);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { urbit, ship } = useUrbit();
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [call, setCall] = useState<CallState | null>(null);
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const rtcAppRef = useRef<UrbitRTCApp | null>(null);
  const callRef = useRef<CallState | null>(null);

  // Keep ref in sync
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

    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    app.addEventListener("incomingcall", ((evt: UrbitRTCIncomingCallEvent) => {
      console.log("Incoming call from", evt.peer);
      setIncoming({ peer: evt.peer, uuid: evt.uuid, evt });

      // Browser notification
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

      // Update page title
      document.title = `Incoming call from ~${evt.peer}`;
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

    return () => {
      // cleanup
    };
  }, [ship, urbit]);

  const setupConnection = useCallback(
    (conn: UrbitRTCPeerConnection, peer: string, isCaller: boolean) => {
      const remoteStream = new MediaStream();
      const localStream = new MediaStream();

      const newCall: CallState = {
        conn,
        uuid: conn.uuid || "",
        peer,
        isCaller,
        status: "connecting",
        localStream,
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
        setCall((c) => (c ? { ...c, remoteStream: new MediaStream(remoteStream.getTracks()) } : c));
      };

      // State changes
      conn.onurbitstatechanged = (evt) => {
        console.log("Urbit state:", evt.urbitState);
        setCall((c) => (c ? { ...c, status: evt.urbitState } : c));
      };

      conn.addEventListener("hungupcall", () => {
        console.log("Remote hung up");
        localStream?.getTracks().forEach((t) => t.stop());
        setCall((c) => (c ? { ...c, wasHungUp: true, dataChannelOpen: false } : c));
      });

      // Hangup on tab close / navigate away
      const onBeforeUnload = () => {
        conn.close();
      };
      window.addEventListener("beforeunload", onBeforeUnload);
      conn.addEventListener("hungupcall", () => {
        window.removeEventListener("beforeunload", onBeforeUnload);
      });

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
              ? {
                  ...c,
                  messages: [{ speaker: peer, text: evt.data }, ...c.messages],
                }
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
                  ? {
                      ...c,
                      messages: [{ speaker: peer, text: msgEvt.data }, ...c.messages],
                    }
                  : c
              );
            };
          }
        }) as EventListener);
      }

      // Get local media
      navigator.mediaDevices
        .getUserMedia({ audio: true, video: true })
        .then((stream) => {
          stream.getTracks().forEach((track) => {
            conn.addTrack(track, stream);
          });
          setCall((c) => (c ? { ...c, localStream: stream } : c));
        })
        .catch((err) => {
          console.warn("Could not get media:", err);
          // Try audio only
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
      return newCall;
    },
    []
  );

  const placeCall = useCallback(
    async (peer: string): Promise<string> => {
      if (!rtcAppRef.current) throw new Error("Not initialized");
      const conn = rtcAppRef.current.call(peer, DAP);
      const c = setupConnection(conn, peer, true);
      // Wait for UUID to be assigned
      return new Promise((resolve) => {
        conn.onring = (uuid) => {
          setCall((prev) => (prev ? { ...prev, uuid } : prev));
          resolve(uuid);
        };
      });
    },
    [setupConnection]
  );

  const clearIncomingNotification = useCallback(() => {
    document.title = "Campfire";
  }, []);

  const answerCall = useCallback(async (): Promise<string> => {
    if (!incoming) throw new Error("No incoming call");
    const conn = incoming.evt.answer();
    setupConnection(conn, incoming.peer, false);
    setIncoming(null);
    clearIncomingNotification();
    return incoming.uuid;
  }, [incoming, setupConnection, clearIncomingNotification]);

  const rejectCall = useCallback(() => {
    if (incoming) {
      incoming.evt.reject();
      setIncoming(null);
      clearIncomingNotification();
    }
  }, [incoming, clearIncomingNotification]);

  const hangup = useCallback(() => {
    if (call) {
      call.localStream?.getTracks().forEach((t) => t.stop());
      call.remoteStream?.getTracks().forEach((t) => t.stop());
      if (call.conn) call.conn.close();
    }
    setCall(null);
    document.title = "Campfire";
  }, [call]);

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
        audioEnabled,
        videoEnabled,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export const useCall = () => useContext(CallContext);
