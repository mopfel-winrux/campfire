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
    app.urbit = urbit;
    rtcAppRef.current = app;

    // Handle incoming calls from room members
    app.addEventListener("incomingcall", ((evt: any) => {
      const peerClean = evt.peer.replace(/^~/, "");
      console.log("Room: incoming call from", peerClean);
      // Only answer if we don't already have a connection to this peer
      if (!peersRef.current.has(peerClean)) {
        const conn = evt.answer() as UrbitRTCPeerConnection;
        setupPeer(conn, peerClean, false);
      }
    }) as EventListener);

    return () => {
      peersRef.current.forEach((p) => {
        try { p.conn.close(); } catch (e) {}
      });
    };
  }, [ship, urbit]);

  // Get local media on room join
  useEffect(() => {
    if (!room) return;
    console.log("Room: getting local media");
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .then((stream) => {
        console.log("Room: got video+audio");
        setLocalStream(stream);
        localStreamRef.current = stream;
        setMediaReady(true);
      })
      .catch(() => {
        navigator.mediaDevices
          .getUserMedia({ audio: true, video: false })
          .then((stream) => {
            console.log("Room: got audio only");
            setLocalStream(stream);
            localStreamRef.current = stream;
            setMediaReady(true);
          })
          .catch((e) => {
            console.error("Room: no media", e);
            setMediaReady(true); // proceed without media
          });
      });

    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
      setMediaReady(false);
    };
  }, [room?.name]);

  // Connect to room members AFTER media is ready
  useEffect(() => {
    if (!room || !rtcAppRef.current || !ship || !mediaReady) return;

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
        console.log("Room: removing", peerShip);
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
      console.log("Room: setting up peer", peerClean, isCaller ? "(caller)" : "(answerer)");
      const remoteStream = new MediaStream();

      conn.ontrack = (evt) => {
        console.log("Room: remote track from", peerClean, evt.track.kind);
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
        console.log("Room: peer", peerClean, "state:", evt.urbitState);
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
        console.log("Room: peer", peerClean, "hung up");
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
        console.log("Room: adding", localStreamRef.current.getTracks().length, "local tracks for", peerClean);
        localStreamRef.current.getTracks().forEach((track) => {
          conn.addTrack(track, localStreamRef.current!);
        });
      }

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
