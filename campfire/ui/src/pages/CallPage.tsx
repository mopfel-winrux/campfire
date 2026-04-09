import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUrbit } from "../hooks/useUrbit";
import { useCall } from "../hooks/useCall";

export default function CallPage() {
  const { ship } = useUrbit();
  const {
    call,
    hangup,
    sendMessage,
    toggleAudio,
    toggleVideo,
    audioEnabled,
    videoEnabled,
  } = useCall();
  const navigate = useNavigate();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [showChat, setShowChat] = useState(true);
  const [chatInput, setChatInput] = useState("");

  useEffect(() => {
    if (localVideoRef.current && call?.localStream) {
      localVideoRef.current.srcObject = call.localStream;
    }
  }, [call?.localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && call?.remoteStream) {
      remoteVideoRef.current.srcObject = call.remoteStream;
    }
  }, [call?.remoteStream]);

  useEffect(() => {
    if (!call) navigate("/", { replace: true });
  }, [call, navigate]);

  useEffect(() => {
    if (call?.peer) document.title = `Call with ~${call.peer}`;
    return () => { document.title = "Campfire"; };
  }, [call?.peer]);

  const doHangup = () => {
    hangup();
    navigate("/");
  };

  const doSend = () => {
    if (!chatInput.trim() || !call?.dataChannelOpen) return;
    sendMessage(chatInput);
    setChatInput("");
  };

  if (!call) return null;

  const connected = call.dataChannelOpen;
  const statusLabel = call.wasHungUp
    ? "Call ended"
    : connected
    ? `Connected with ~${call.peer}`
    : `Connecting to ~${call.peer}...`;

  return (
    <div className="h-screen bg-stone-950 text-stone-100 flex flex-col">
      <header className="flex items-center justify-between px-4 py-2 bg-stone-900/80 border-b border-stone-800/50 shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
          <span className="text-sm text-stone-400">{statusLabel}</span>
        </div>
        <span className="text-xs text-stone-600 font-mono">~{ship}</span>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative bg-stone-950 flex items-center justify-center">
          <video ref={remoteVideoRef} autoPlay playsInline className="max-h-full max-w-full object-contain" />

          {!call.remoteStream?.getVideoTracks().length && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-24 h-24 rounded-full bg-stone-800 flex items-center justify-center text-3xl font-mono text-stone-500">
                  ~{(call.peer || "").slice(0, 3)}
                </div>
                {!connected && <p className="text-stone-600 text-sm animate-pulse">Waiting for connection...</p>}
              </div>
            </div>
          )}

          <div className="absolute top-4 right-4 w-48 aspect-video rounded-lg overflow-hidden bg-stone-900 border border-stone-700/50 shadow-lg">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror" />
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-stone-900/90 backdrop-blur border border-stone-700/50 rounded-full px-4 py-2 shadow-xl">
            <Btn active={audioEnabled} onClick={toggleAudio}>{audioEnabled ? <MicOn /> : <MicOff />}</Btn>
            <Btn active={videoEnabled} onClick={toggleVideo}>{videoEnabled ? <VidOn /> : <VidOff />}</Btn>
            <Btn active={showChat} onClick={() => setShowChat(!showChat)} accent><ChatIco /></Btn>
            <div className="w-px h-6 bg-stone-700 mx-1" />
            <button onClick={doHangup} className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {showChat && (
          <div className="w-80 bg-stone-900 border-l border-stone-800/50 flex flex-col shrink-0">
            <div className="px-4 py-3 border-b border-stone-800/50">
              <h2 className="text-sm font-medium text-stone-400">Chat</h2>
              {!connected && <p className="text-[10px] text-stone-600 mt-0.5">Waiting for connection...</p>}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col-reverse gap-2">
              {call.messages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.speaker === "me" ? "items-end" : "items-start"}`}>
                  <span className="text-[10px] text-stone-600 font-mono mb-0.5">
                    {msg.speaker === "me" ? `~${ship}` : `~${msg.speaker}`}
                  </span>
                  <div className={`px-3 py-1.5 rounded-lg text-sm max-w-[85%] break-words ${msg.speaker === "me" ? "bg-amber-700/30 text-amber-100" : "bg-stone-800 text-stone-200"}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {call.messages.length === 0 && connected && (
                <p className="text-stone-600 text-xs text-center mt-4">No messages yet</p>
              )}
            </div>

            <div className="px-3 py-3 border-t border-stone-800/50">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doSend()}
                  placeholder={connected ? "Message..." : "Connecting..."}
                  disabled={!connected}
                  className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder:text-stone-600 focus:outline-none focus:border-amber-700/50 disabled:opacity-40"
                />
                <button onClick={doSend} disabled={!connected || !chatInput.trim()} className="bg-amber-700 hover:bg-amber-600 disabled:bg-stone-800 disabled:text-stone-600 text-stone-100 px-3 py-2 rounded-lg transition-colors text-sm">↵</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {call.wasHungUp && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-stone-900 border border-stone-700 rounded-2xl p-8 flex flex-col items-center gap-4 max-w-sm w-full mx-4">
            <p className="text-stone-300">~{call.peer} hung up</p>
            <button onClick={doHangup} className="bg-amber-600 hover:bg-amber-500 text-stone-950 font-medium px-6 py-3 rounded-lg transition-colors text-sm w-full">Back to Campfire</button>
          </div>
        </div>
      )}
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
const ChatIco = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>;
