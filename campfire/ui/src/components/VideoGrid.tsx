import React, { useEffect, useRef } from "react";
import { PeerConnection } from "../hooks/useRoomCall";

interface Props {
  peers: Map<string, PeerConnection>;
  localStream: MediaStream | null;
  ship: string;
}

export default function VideoGrid({ peers, localStream, ship }: Props) {
  const count = peers.size;

  const gridClass =
    count <= 1
      ? "grid-cols-1"
      : count <= 2
      ? "grid-cols-2"
      : count <= 4
      ? "grid-cols-2 grid-rows-2"
      : "grid-cols-3 grid-rows-2";

  return (
    <div className="relative w-full h-full">
      <div className={`grid ${gridClass} gap-2 w-full h-full p-2`}>
        {count === 0 && (
          <div className="flex items-center justify-center text-stone-600 text-sm">
            Waiting for others to join...
          </div>
        )}
        {Array.from(peers.entries()).map(([peerShip, pc]) => (
          <PeerVideo key={peerShip} peer={pc} />
        ))}
      </div>

      {/* Local video PiP */}
      <div className="absolute top-4 right-4 w-40 aspect-video rounded-lg overflow-hidden bg-stone-900 border border-stone-700/50 shadow-lg">
        <LocalVideo stream={localStream} />
        <div className="absolute bottom-1 left-2 text-[10px] text-stone-400 font-mono">
          ~{ship}
        </div>
      </div>
    </div>
  );
}

function PeerVideo({ peer }: { peer: PeerConnection }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && peer.remoteStream) {
      videoRef.current.srcObject = peer.remoteStream;
    }
  }, [peer.remoteStream]);

  const connected = peer.status.includes("connected");

  return (
    <div className="relative bg-stone-900 rounded-lg overflow-hidden flex items-center justify-center">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      {!connected && (
        <div className="absolute inset-0 flex items-center justify-center bg-stone-900/80">
          <p className="text-stone-500 text-sm animate-pulse">Connecting...</p>
        </div>
      )}
      <div className="absolute bottom-2 left-3 bg-black/50 px-2 py-0.5 rounded text-xs text-stone-300 font-mono">
        ~{peer.peer}
      </div>
    </div>
  );
}

function LocalVideo({ stream }: { stream: MediaStream | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="w-full h-full object-cover mirror"
    />
  );
}
