import { useCallback, useEffect, useRef, useState } from "react";
import { useUrbit } from "./useUrbit";
import { Room } from "./useRoom";
import { PeerConnection } from "./useRoomCall";

export interface GuestPeer {
  guestId: string;
  displayName: string;
  pc: RTCPeerConnection;
  remoteStream: MediaStream;
  status: string;
}

interface Props {
  room: Room | null;
  isHost: boolean;
  localStream: MediaStream | null;
  roomPeers: Map<string, PeerConnection>;
}

/**
 * Host-side hook that listens for public room guest signals and establishes
 * WebRTC peer connections with them.
 */
export function useGuestRelay({ room, isHost, localStream, roomPeers }: Props) {
  const { urbit } = useUrbit();
  const [guests, setGuests] = useState<Map<string, GuestPeer>>(new Map());
  const guestsRef = useRef<Map<string, GuestPeer>>(new Map());
  const subIdRef = useRef<number | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const roomPeersRef = useRef<Map<string, PeerConnection>>(new Map());

  guestsRef.current = guests;
  localStreamRef.current = localStream;
  roomPeersRef.current = roomPeers;

  // Subscribe to guest updates when hosting a public room
  useEffect(() => {
    console.log("GuestRelay effect:", { room: room?.name, isHost, public: room?.public });
    if (!room || !isHost || !room.public) return;

    const path = `/public/room/${room.name}`;
    console.log("GuestRelay: subscribing to", path);

    urbit
      .subscribe({
        app: "campfire",
        path,
        event: (evt: any) => handleGuestEvent(evt),
        err: (e: any) => console.warn("GuestRelay sub error:", e),
        quit: () => console.warn("GuestRelay sub quit"),
      })
      .then((id) => {
        subIdRef.current = id;
      })
      .catch(console.error);

    return () => {
      if (subIdRef.current !== null) {
        urbit.unsubscribe(subIdRef.current);
        subIdRef.current = null;
      }
      // Close all guest PCs
      guestsRef.current.forEach((g) => {
        try { g.pc.close(); } catch {}
      });
      setGuests(new Map());
    };
  }, [room?.name, isHost, room?.public]);

  const handleGuestEvent = useCallback(async (evt: any) => {
    console.log("GuestRelay event:", evt);
    if (evt.type === "guest-join") {
      await onGuestJoin(evt.guestId, evt.displayName, evt.offer);
    } else if (evt.type === "guest-ice") {
      onGuestIce(evt.guestId, evt.candidate);
    } else if (evt.type === "guest-left") {
      onGuestLeft(evt.guestId);
    }
  }, []);

  const onGuestJoin = useCallback(
    async (guestId: string, displayName: string, offerSdp: string) => {
      if (guestsRef.current.has(guestId)) {
        console.log("GuestRelay: already have guest", guestId);
        return;
      }

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      const remoteStream = new MediaStream();

      pc.ontrack = (evt) => {
        console.log("GuestRelay: track from guest", guestId, evt.track.kind);
        remoteStream.addTrack(evt.track);
        setGuests((prev) => {
          const next = new Map(prev);
          const g = next.get(guestId);
          if (g) {
            next.set(guestId, {
              ...g,
              remoteStream: new MediaStream(remoteStream.getTracks()),
            });
          }
          return next;
        });
      };

      pc.onicecandidate = (evt) => {
        if (evt.candidate) {
          urbit
            .poke({
              app: "campfire",
              mark: "campfire-host-signal",
              json: {
                type: "host-ice",
                guestId,
                candidate: JSON.stringify(evt.candidate.toJSON()),
              },
            })
            .catch((e) => console.warn("host-ice poke failed", e));
        }
      };

      pc.onconnectionstatechange = () => {
        console.log("GuestRelay: guest", guestId, "state:", pc.connectionState);
        setGuests((prev) => {
          const next = new Map(prev);
          const g = next.get(guestId);
          if (g) {
            next.set(guestId, { ...g, status: pc.connectionState });
          }
          return next;
        });
      };

      // Add our local tracks so the guest sees us
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => {
          pc.addTrack(t, localStreamRef.current!);
        });
      }

      // Relay other room members' tracks to the guest (host as SFU)
      roomPeersRef.current.forEach((peerConn, peerShip) => {
        if (peerConn.remoteStream) {
          peerConn.remoteStream.getTracks().forEach((track) => {
            try {
              pc.addTrack(track, peerConn.remoteStream);
              console.log("GuestRelay: relaying", peerShip, track.kind, "to guest", guestId);
            } catch (e) {
              console.warn("Failed to relay track:", e);
            }
          });
        }
      });

      // Process the guest's offer
      try {
        await pc.setRemoteDescription({ type: "offer", sdp: offerSdp });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // Send answer back through the agent
        await urbit.poke({
          app: "campfire",
          mark: "campfire-host-signal",
          json: {
            type: "answer",
            guestId,
            sdp: answer.sdp,
          },
        });
      } catch (e) {
        console.error("GuestRelay: failed to handle offer:", e);
        return;
      }

      setGuests((prev) => {
        const next = new Map(prev);
        next.set(guestId, {
          guestId,
          displayName,
          pc,
          remoteStream,
          status: "connecting",
        });
        return next;
      });
    },
    [urbit]
  );

  const onGuestIce = useCallback(
    async (guestId: string, candidateJson: string) => {
      const g = guestsRef.current.get(guestId);
      if (!g) return;
      try {
        const cand = JSON.parse(candidateJson);
        await g.pc.addIceCandidate(cand);
      } catch (e) {
        console.warn("bad ice from guest", e);
      }
    },
    []
  );

  const onGuestLeft = useCallback((guestId: string) => {
    const g = guestsRef.current.get(guestId);
    if (g) {
      try { g.pc.close(); } catch {}
    }
    setGuests((prev) => {
      const next = new Map(prev);
      next.delete(guestId);
      return next;
    });
  }, []);

  const kickGuest = useCallback(
    (guestId: string) => {
      urbit
        .poke({
          app: "campfire",
          mark: "campfire-host-signal",
          json: { type: "kick", guestId },
        })
        .catch(console.error);
      onGuestLeft(guestId);
    },
    [urbit, onGuestLeft]
  );

  return { guests, kickGuest };
}
