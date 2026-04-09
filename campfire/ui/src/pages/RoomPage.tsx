import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useUrbit } from "../hooks/useUrbit";
import { useRoom, Room } from "../hooks/useRoom";
import { useRoomCall } from "../hooks/useRoomCall";
import { useGuestRelay } from "../hooks/useGuestRelay";
import VideoGrid from "../components/VideoGrid";

export default function RoomPage() {
  const { host, name } = useParams<{ host: string; name: string }>();
  const { ship, urbit } = useUrbit();
  const navigate = useNavigate();
  const { currentRoom, joinRoom, joinHostedRoom, leaveRoom, refreshRooms } = useRoom();
  const {
    peers, localStream, messages, audioEnabled, videoEnabled,
    sendMessage, toggleAudio, toggleVideo, cleanup,
  } = useRoomCall(currentRoom);
  const { guests, kickGuest } = useGuestRelay({
    room: currentRoom,
    isHost: (host?.replace(/^~/, "") || "") === ship,
    localStream,
  });
  const [chatInput, setChatInput] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [status, setStatus] = useState<"prompt" | "joining" | "joined">("prompt");
  const didJoinRef = useRef(false);

  const hostClean = host?.replace(/^~/, "") || "";
  const isHost = hostClean === ship;

  const doJoin = async () => {
    if (didJoinRef.current) return;
    didJoinRef.current = true;
    setStatus("joining");
    try {
      if (isHost) {
        await joinHostedRoom(name!);
      } else {
        await joinRoom(hostClean, name!);
      }
    } catch (e) {
      console.error("Failed to join room:", e);
      setStatus("prompt");
      didJoinRef.current = false;
    }
  };

  // Watch for currentRoom to be set
  useEffect(() => {
    if (currentRoom && status === "joining") {
      setStatus("joined");
    }
  }, [currentRoom, status]);

  useEffect(() => {
    if (currentRoom) {
      document.title = `${currentRoom.title || currentRoom.name} - Campfire`;
    }
    return () => { document.title = "Campfire"; };
  }, [currentRoom]);

  const doLeave = () => {
    cleanup();
    if (name && hostClean) leaveRoom(hostClean, name);
    navigate("/");
  };

  const doSend = () => {
    if (!chatInput.trim()) return;
    sendMessage(chatInput);
    setChatInput("");
  };

  // Prompt to join
  if (status === "prompt") {
    return (
      <div className="h-screen bg-stone-950 text-stone-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 max-w-sm mx-4">
          <h2 className="text-xl text-stone-200">Join Room</h2>
          <p className="text-stone-400 text-sm text-center font-mono">~{hostClean}/{name}</p>
          <button onClick={doJoin} className="bg-amber-600 hover:bg-amber-500 text-stone-950 font-medium px-8 py-3 rounded-lg transition-colors">
            Join
          </button>
          <button onClick={() => navigate("/")} className="text-stone-500 hover:text-stone-300 text-sm">Back</button>
        </div>
      </div>
    );
  }

  // Joining spinner — with a timeout fallback
  if (status === "joining" || !currentRoom) {
    return (
      <div className="h-screen bg-stone-950 text-stone-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-stone-400 text-sm">Joining room...</p>
          <button onClick={() => { setStatus("prompt"); didJoinRef.current = false; }} className="text-stone-600 hover:text-stone-400 text-xs mt-4">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-stone-950 text-stone-100 flex flex-col">
      <header className="flex items-center justify-between px-4 py-2 bg-stone-900/80 border-b border-stone-800/50 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-stone-200">{currentRoom.title || currentRoom.name}</h2>
          <span className="text-xs text-stone-500">{currentRoom.members.length} member{currentRoom.members.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/apps/campfire/room/~${hostClean}/${name}`); }} className="text-xs text-stone-500 hover:text-amber-500 transition-colors px-2 py-1">
            Copy Link
          </button>
          {currentRoom.public && (
            <button
              onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/apps/campfire/public/room/~${hostClean}/${name}`); }}
              className="text-xs text-amber-600 hover:text-amber-400 transition-colors px-2 py-1 border border-amber-900/40 rounded"
              title="Public link for non-Urbit guests"
            >
              Public Link
            </button>
          )}
          <span className="text-xs text-stone-600 font-mono">~{ship}</span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <VideoGrid peers={peers} guests={guests} localStream={localStream} ship={ship} />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-stone-900/90 backdrop-blur border border-stone-700/50 rounded-full px-4 py-2 shadow-xl">
            <Btn active={audioEnabled} onClick={toggleAudio}>{audioEnabled ? <MicOn /> : <MicOff />}</Btn>
            <Btn active={videoEnabled} onClick={toggleVideo}>{videoEnabled ? <VidOn /> : <VidOff />}</Btn>
            <Btn active={showChat} onClick={() => setShowChat(!showChat)} accent><ChatIco /></Btn>
            <div className="w-px h-6 bg-stone-700 mx-1" />
            <button onClick={doLeave} className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors">
              <XIcon />
            </button>
          </div>
        </div>

        {showChat && (
          <div className="w-72 bg-stone-900 border-l border-stone-800/50 flex flex-col shrink-0">
            <div className="px-4 py-3 border-b border-stone-800/50">
              <h3 className="text-xs font-medium text-stone-400 uppercase tracking-wider">Room Chat</h3>
              <p className="text-[10px] text-stone-600 mt-0.5">Ephemeral</p>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col-reverse gap-1.5">
              {messages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.speaker === "me" ? "items-end" : "items-start"}`}>
                  <span className="text-[10px] text-stone-600 font-mono">{m.speaker === "me" ? `~${ship}` : `~${m.speaker}`}</span>
                  <div className={`px-2.5 py-1 rounded-lg text-sm max-w-[85%] break-words ${m.speaker === "me" ? "bg-amber-700/30 text-amber-100" : "bg-stone-800 text-stone-200"}`}>{m.text}</div>
                </div>
              ))}
            </div>
            <div className="px-3 py-2 border-t border-stone-800/50">
              <div className="flex gap-2">
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doSend()} placeholder="Message..." className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-sm text-stone-100 placeholder:text-stone-600 focus:outline-none focus:border-amber-700/50" />
                <button onClick={doSend} disabled={!chatInput.trim()} className="bg-amber-700 hover:bg-amber-600 disabled:bg-stone-800 text-stone-100 px-2.5 py-1.5 rounded-lg text-sm">↵</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Btn({ active, onClick, accent, children }: { active: boolean; onClick: () => void; accent?: boolean; children: React.ReactNode }) {
  return <button onClick={onClick} className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${active ? (accent ? "bg-amber-700/30 text-amber-400" : "bg-stone-700/50 text-stone-300 hover:bg-stone-700") : "bg-stone-700 text-stone-500"}`}>{children}</button>;
}

const MicOn = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>;
const MicOff = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /><path strokeLinecap="round" d="M3 3l18 18" /></svg>;
const VidOn = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9.75a2.25 2.25 0 002.25-2.25V7.5a2.25 2.25 0 00-2.25-2.25H4.5A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" /></svg>;
const VidOff = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9.75a2.25 2.25 0 002.25-2.25V7.5a2.25 2.25 0 00-2.25-2.25H4.5A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" /><path strokeLinecap="round" d="M3 3l18 18" /></svg>;
const XIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
const ChatIco = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>;
