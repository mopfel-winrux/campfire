import { useCallback, useEffect, useRef, useState } from "react";
import { UrbitRTCApp, UrbitRTCPeerConnection } from "rtcswitchboard";
import { useUrbit } from "./useUrbit";
import { useSettings } from "./useSettings";
import { startBandwidthMonitor } from "../lib/bandwidth";
import { Room } from "./useRoom";

const DAP = "campfire-room";

export interface PeerConnection {
  conn: UrbitRTCPeerConnection;
  peer: string;
  remoteStream: MediaStream;
  status: string;
}

export function useRoomCall(room: Room | null) {
  const { urbit, ship } = useUrbit();
  const { audioOnly } = useSettings();
  const [peers, setPeers] = useState<Map<string, PeerConnection>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [messages, setMessages] = useState<{ speaker: string; text: string }[]>([]);
  const [mediaReady, setMediaReady] = useState(false);
  const rtcAppRef = useRef<UrbitRTCApp | null>(null);
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const dataChannelsRef = useRef<Map<string, RTCDataChannel>>(new Map());

  peersRef.current = peers;
  localStreamRef.current = localStream;

  // Initialize UrbitRTCApp
  useEffect(() => {
    if (!ship) return;
    const config: RTCConfiguration = {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };
    const app = new UrbitRTCApp(DAP, config);

    // Attach listener BEFORE urbit assignment (which triggers initialize/subscribe)
    app.addEventListener("incomingcall", ((evt: any) => {
      const peerClean = evt.peer.replace(/^~/, "");
      if (!peersRef.current.has(peerClean)) {
        const conn = evt.answer() as UrbitRTCPeerConnection;
        setupPeer(conn, peerClean, false);
      }
    }) as EventListener);

    // Now attach urbit, which triggers subscription
    app.urbit = urbit;
    rtcAppRef.current = app;

    return () => {
      peersRef.current.forEach((p) => {
        try { p.conn.close(); } catch (e) {}
      });
    };
  }, [ship, urbit]);

  // Get local media on room join
  useEffect(() => {
    if (!room) return;
    const constraints = audioOnly
      ? { audio: true, video: false }
      : { audio: true, video: true };
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        setLocalStream(stream);
        localStreamRef.current = stream;
        setMediaReady(true);
      })
      .catch(() => {
        navigator.mediaDevices
          .getUserMedia({ audio: true, video: false })
          .then((stream) => {
            setLocalStream(stream);
            localStreamRef.current = stream;
            setMediaReady(true);
          })
          .catch((e) => {
            console.error("Room: could not access media", e);
            setMediaReady(true);
          });
      });

    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
      setMediaReady(false);
    };
  }, [room?.name, audioOnly]);

  // Connect to room members AFTER media is ready
  useEffect(() => {
    if (!room || !rtcAppRef.current || !ship || !mediaReady) return;

    const myShip = ship.replace(/^~/, "");
    const currentPeers = new Set(peersRef.current.keys());

    for (const member of room.members) {
      const memberClean = member.replace(/^~/, "");
      if (memberClean === myShip) continue;
      if (currentPeers.has(memberClean)) continue;

      // Deterministic: lower @p initiates to avoid duplicate calls
      if (myShip < memberClean) {
        const conn = rtcAppRef.current.call(memberClean, DAP);
        setupPeer(conn, memberClean, true);
      }
      // else: wait for incoming call (handled by incomingcall listener)
    }

    // Remove peers no longer in room
    for (const peerShip of currentPeers) {
      const inRoom = room.members.some(
        (m) => m.replace(/^~/, "") === peerShip
      );
      if (!inRoom) {
        const pc = peersRef.current.get(peerShip);
        if (pc) try { pc.conn.close(); } catch (e) {}
        setPeers((prev) => {
          const next = new Map(prev);
          next.delete(peerShip);
          return next;
        });
        dataChannelsRef.current.delete(peerShip);
      }
    }
  }, [room?.members, ship, mediaReady]);

  const setupPeer = useCallback(
    (conn: UrbitRTCPeerConnection, peerClean: string, isCaller: boolean) => {
      const remoteStream = new MediaStream();

      conn.ontrack = (evt) => {
        remoteStream.addTrack(evt.track);
        setPeers((prev) => {
          const next = new Map(prev);
          const existing = next.get(peerClean);
          if (existing) {
            next.set(peerClean, {
              ...existing,
              remoteStream: new MediaStream(remoteStream.getTracks()),
            });
          }
          return next;
        });
      };

      conn.onurbitstatechanged = (evt: any) => {
        setPeers((prev) => {
          const next = new Map(prev);
          const existing = next.get(peerClean);
          if (existing) {
            next.set(peerClean, { ...existing, status: evt.urbitState });
          }
          return next;
        });
      };

      conn.addEventListener("hungupcall", () => {
        setPeers((prev) => {
          const next = new Map(prev);
          next.delete(peerClean);
          return next;
        });
        dataChannelsRef.current.delete(peerClean);
      });

      // Auto-reconnect on disconnect/failed
      let reconnectAttempts = 0;
      const maxReconnects = 3;
      let disconnectTimer: any = null;
      conn.addEventListener("connectionstatechange", () => {
        const cs = (conn as any).connectionState;
        if (cs === "connected") {
          reconnectAttempts = 0;
          if (disconnectTimer) {
            clearTimeout(disconnectTimer);
            disconnectTimer = null;
          }
          return;
        }
        if (cs === "disconnected") {
          disconnectTimer = setTimeout(() => {
            if ((conn as any).connectionState === "disconnected" && reconnectAttempts < maxReconnects) {
              console.log("Room: ICE restart for", peerClean, "attempt", reconnectAttempts + 1);
              reconnectAttempts++;
              try { (conn as any).restartIce(); } catch (e) { console.warn(e); }
            }
          }, 2000);
          return;
        }
        if (cs === "failed") {
          if (reconnectAttempts < maxReconnects) {
            console.log("Room: ICE restart after failure for", peerClean, "attempt", reconnectAttempts + 1);
            reconnectAttempts++;
            try { (conn as any).restartIce(); } catch (e) { console.warn(e); }
          }
        }
      });

      // Data channel for ephemeral chat
      if (isCaller) {
        const dc = conn.createDataChannel("campfire-room");
        dc.onopen = () => dataChannelsRef.current.set(peerClean, dc);
        dc.onmessage = (evt) => {
          setMessages((prev) => [{ speaker: peerClean, text: evt.data }, ...prev]);
        };
      } else {
        conn.addEventListener("datachannel", ((evt: RTCDataChannelEvent) => {
          if (evt.channel.label === "campfire-room") {
            evt.channel.onopen = () => dataChannelsRef.current.set(peerClean, evt.channel);
            evt.channel.onmessage = (msgEvt) => {
              setMessages((prev) => [{ speaker: peerClean, text: msgEvt.data }, ...prev]);
            };
          }
        }) as EventListener);
      }

      // Add local tracks BEFORE initialize
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          conn.addTrack(track, localStreamRef.current!);
        });
      }

      // Start bandwidth monitoring
      startBandwidthMonitor(conn as any);

      // Add to peers map
      setPeers((prev) => {
        const next = new Map(prev);
        next.set(peerClean, { conn, peer: peerClean, remoteStream, status: "connecting" });
        return next;
      });

      // Start the connection
      conn.initialize();
    },
    []
  );

  const sendMessage = useCallback(
    (text: string) => {
      dataChannelsRef.current.forEach((dc) => {
        if (dc.readyState === "open") dc.send(text);
      });
      setMessages((prev) => [{ speaker: "me", text }, ...prev]);
    },
    []
  );

  const toggleAudio = useCallback(() => {
    localStream?.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
      setAudioEnabled(t.enabled);
    });
  }, [localStream]);

  const toggleVideo = useCallback(() => {
    localStream?.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
      setVideoEnabled(t.enabled);
    });
  }, [localStream]);

  const cleanup = useCallback(() => {
    peersRef.current.forEach((p) => {
      try { p.conn.close(); } catch (e) {}
    });
    setPeers(new Map());
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    setMessages([]);
    setMediaReady(false);
    dataChannelsRef.current.clear();
  }, []);

  return {
    peers,
    localStream,
    messages,
    audioEnabled,
    videoEnabled,
    sendMessage,
    toggleAudio,
    toggleVideo,
    cleanup,
  };
}
