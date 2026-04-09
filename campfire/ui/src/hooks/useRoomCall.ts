import { useCallback, useEffect, useRef, useState } from "react";
import { UrbitRTCApp, UrbitRTCPeerConnection } from "rtcswitchboard";
import { useUrbit } from "./useUrbit";
import { Room } from "./useRoom";

const DAP = "campfire";

export interface PeerConnection {
  conn: UrbitRTCPeerConnection;
  peer: string;
  remoteStream: MediaStream;
  status: string;
}

export function useRoomCall(room: Room | null) {
  const { urbit, ship } = useUrbit();
  const [peers, setPeers] = useState<Map<string, PeerConnection>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [messages, setMessages] = useState<{ speaker: string; text: string }[]>([]);
  const rtcAppRef = useRef<UrbitRTCApp | null>(null);
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const dataChannelsRef = useRef<Map<string, RTCDataChannel>>(new Map());

  // Keep refs in sync
  peersRef.current = peers;
  localStreamRef.current = localStream;

  // Initialize UrbitRTCApp
  useEffect(() => {
    if (!ship) return;
    const config: RTCConfiguration = {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };
    const app = new UrbitRTCApp(DAP, config);
    app.urbit = urbit;
    rtcAppRef.current = app;

    // Handle incoming calls from room members
    app.addEventListener("incomingcall", ((evt: any) => {
      console.log("Room: incoming call from", evt.peer);
      const conn = evt.answer() as UrbitRTCPeerConnection;
      setupPeerConnection(conn, evt.peer, false);
    }) as EventListener);

    return () => {
      // Cleanup all connections
      peersRef.current.forEach((p) => p.conn.close());
    };
  }, [ship, urbit]);

  // Get local media
  useEffect(() => {
    if (!room) return;
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .then((stream) => {
        setLocalStream(stream);
        localStreamRef.current = stream;
      })
      .catch(() => {
        navigator.mediaDevices
          .getUserMedia({ audio: true, video: false })
          .then((stream) => {
            setLocalStream(stream);
            localStreamRef.current = stream;
          })
          .catch(console.error);
      });

    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [room?.name]);

  // Connect to room members when membership changes
  useEffect(() => {
    if (!room || !rtcAppRef.current || !ship) return;

    const myShip = ship.replace(/^~/, "");
    const currentPeers = new Set(peersRef.current.keys());

    for (const member of room.members) {
      const memberClean = member.replace(/^~/, "");
      if (memberClean === myShip) continue;
      if (currentPeers.has(memberClean)) continue;

      // Deterministic: lower @p initiates
      if (myShip < memberClean) {
        console.log("Room: calling", memberClean);
        const conn = rtcAppRef.current.call(memberClean, DAP);
        setupPeerConnection(conn, memberClean, true);
      }
      // else: wait for them to call us (handled by incomingcall listener)
    }

    // Remove peers no longer in room
    for (const peerShip of currentPeers) {
      const inRoom = room.members.some(
        (m) => m.replace(/^~/, "") === peerShip
      );
      if (!inRoom) {
        const pc = peersRef.current.get(peerShip);
        if (pc) pc.conn.close();
        setPeers((prev) => {
          const next = new Map(prev);
          next.delete(peerShip);
          return next;
        });
        dataChannelsRef.current.delete(peerShip);
      }
    }
  }, [room?.members, ship]);

  const setupPeerConnection = useCallback(
    (conn: UrbitRTCPeerConnection, peer: string, isCaller: boolean) => {
      const remoteStream = new MediaStream();
      const peerClean = peer.replace(/^~/, "");

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

      // Data channel for ephemeral chat
      if (isCaller) {
        const dc = conn.createDataChannel("campfire-room");
        dc.onopen = () => {
          dataChannelsRef.current.set(peerClean, dc);
        };
        dc.onmessage = (evt) => {
          setMessages((prev) => [{ speaker: peerClean, text: evt.data }, ...prev]);
        };
      } else {
        conn.addEventListener("datachannel", ((evt: RTCDataChannelEvent) => {
          if (evt.channel.label === "campfire-room") {
            evt.channel.onopen = () => {
              dataChannelsRef.current.set(peerClean, evt.channel);
            };
            evt.channel.onmessage = (msgEvt) => {
              setMessages((prev) => [
                { speaker: peerClean, text: msgEvt.data },
                ...prev,
              ]);
            };
          }
        }) as EventListener);
      }

      // Add local tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          conn.addTrack(track, localStreamRef.current!);
        });
      }

      setPeers((prev) => {
        const next = new Map(prev);
        next.set(peerClean, { conn, peer: peerClean, remoteStream, status: "connecting" });
        return next;
      });

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
    peersRef.current.forEach((p) => p.conn.close());
    setPeers(new Map());
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    setMessages([]);
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
