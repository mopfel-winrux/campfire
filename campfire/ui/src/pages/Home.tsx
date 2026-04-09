import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { deSig } from "@urbit/api";
import { isValidPatp } from "urbit-ob";
import { useUrbit } from "../hooks/useUrbit";
import { useCall } from "../hooks/useCall";
import { useContacts } from "../hooks/useContacts";
import { useRoom } from "../hooks/useRoom";
import { useSettings } from "../hooks/useSettings";
import ContactList from "../components/ContactList";
import { Campfire } from "../icons/Campfire";

export default function Home() {
  const { ship } = useUrbit();
  const { incoming, placeCall, answerCall, rejectCall, requestNotificationPermission } = useCall();
  const { audioOnly, setAudioOnly } = useSettings();
  const notifPermission = typeof Notification !== "undefined" ? Notification.permission : "denied";
  const { contacts } = useContacts();
  const { hostedRooms, joinedRooms, createRoom, closeRoom, refreshRooms } = useRoom();
  const navigate = useNavigate();
  const params = useParams<{ patp?: string }>();
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [calling, setCalling] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomTitle, setRoomTitle] = useState("");
  const [roomPublic, setRoomPublic] = useState(false);
  const autoCalledRef = useRef(false);

  useEffect(() => {
    if (params.patp && !autoCalledRef.current) {
      autoCalledRef.current = true;
      const cleaned = deSig(params.patp) || "";
      if (isValidPatp("~" + cleaned)) {
        handleCall(cleaned);
      }
    }
  }, [params.patp]);

  const handleCall = async (peer?: string) => {
    const target = peer || deSig(input) || "";
    if (!target || !isValidPatp("~" + target)) {
      setError("Enter a valid @p");
      return;
    }
    setError("");
    setCalling(true);
    try {
      const uuid = await placeCall(target);
      navigate(`/chat/${uuid}`);
    } catch (e) {
      console.error(e);
      setError("Failed to place call");
      setCalling(false);
    }
  };

  const handleAnswer = async () => {
    try {
      const uuid = await answerCall();
      navigate(`/chat/${uuid}`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateRoom = async () => {
    if (!roomName.trim()) return;
    const slug = roomName.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
    await createRoom(slug, roomTitle || roomName, roomPublic);
    setShowCreateRoom(false);
    setRoomName("");
    setRoomTitle("");
    setRoomPublic(false);
    navigate(`/room/~${ship}/${slug}`);
  };

  const allRooms = [
    ...hostedRooms.map((r) => ({ ...r, kind: "hosted" as const })),
    ...joinedRooms.map((r) => ({ ...r, kind: "joined" as const })),
  ];

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none" />

      <main className="relative z-10 flex flex-col items-center gap-8 px-6 max-w-md w-full">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <Campfire className={calling ? "animate-pulse" : ""} />
          <h1 className="text-3xl font-light tracking-wide text-stone-200">Campfire</h1>
          <p className="text-stone-500 text-sm font-mono">~{ship}</p>
        </div>

        {/* Call input */}
        <div className="w-full flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleCall()}
              placeholder="~sampel-palnet"
              disabled={calling}
              className="flex-1 bg-stone-900 border border-stone-800 rounded-lg px-4 py-3 text-stone-100 placeholder:text-stone-600 focus:outline-none focus:border-amber-600/50 focus:ring-1 focus:ring-amber-600/20 transition-colors font-mono text-sm"
            />
            <button
              onClick={() => handleCall()}
              disabled={calling || !input.trim()}
              className="bg-amber-600 hover:bg-amber-500 disabled:bg-stone-800 disabled:text-stone-600 text-stone-950 font-medium px-6 py-3 rounded-lg transition-colors text-sm"
            >
              {calling ? "Calling..." : "Call"}
            </button>
          </div>
          {error && <p className="text-red-400 text-xs pl-1">{error}</p>}
          <ContactList contacts={contacts} onCall={(s) => handleCall(s)} />
        </div>

        {/* Rooms */}
        <div className="w-full flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-stone-500 uppercase tracking-wider">Rooms</p>
            <button
              onClick={() => setShowCreateRoom(!showCreateRoom)}
              className="text-xs text-amber-500 hover:text-amber-400 transition-colors"
            >
              {showCreateRoom ? "Cancel" : "+ New Room"}
            </button>
          </div>

          {/* Create room form */}
          {showCreateRoom && (
            <div className="flex flex-col gap-2 p-3 bg-stone-900 border border-stone-800 rounded-lg">
              <input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="room-name"
                className="bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm text-stone-100 placeholder:text-stone-600 focus:outline-none focus:border-amber-700/50 font-mono"
              />
              <input
                value={roomTitle}
                onChange={(e) => setRoomTitle(e.target.value)}
                placeholder="Display title (optional)"
                className="bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm text-stone-100 placeholder:text-stone-600 focus:outline-none focus:border-amber-700/50"
              />
              <label className="flex items-start gap-2 px-1 py-1 text-xs text-stone-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={roomPublic}
                  onChange={(e) => setRoomPublic(e.target.checked)}
                  className="accent-amber-600 mt-0.5"
                />
                <span className="flex flex-col">
                  <span>Public* — non-Urbit users can join with a link</span>
                  <span className="text-[10px] text-stone-600 mt-0.5">
                    *Experimental: guest connections are unreliable without a TURN server
                  </span>
                </span>
              </label>
              <button
                onClick={handleCreateRoom}
                disabled={!roomName.trim()}
                className="bg-amber-600 hover:bg-amber-500 disabled:bg-stone-800 text-stone-950 font-medium py-2 rounded transition-colors text-sm"
              >
                Create & Join
              </button>
            </div>
          )}

          {/* Room list */}
          {allRooms.length > 0 && (
            <div className="flex flex-col gap-1">
              {allRooms.map((room) => {
                const isHosted = room.kind === "hosted";
                const isOwner = room.host.replace(/^~/, "") === ship;
                return (
                  <div
                    key={`${room.host}/${room.name}`}
                    className="flex items-center gap-1 px-3 py-2.5 rounded-lg hover:bg-stone-800/60 transition-colors group"
                  >
                    <button
                      onClick={() => navigate(`/room/~${room.host.replace(/^~/, "")}/${room.name}`)}
                      className="flex items-center justify-between flex-1 text-left min-w-0"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm text-stone-200 truncate">
                          {room.title || room.name}
                        </span>
                        <span className="text-xs text-stone-500 font-mono truncate">
                          ~{room.host.replace(/^~/, "")}/{room.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-xs text-stone-600">
                          {room.members.length}
                        </span>
                        <span className="text-stone-700 group-hover:text-amber-500 transition-colors text-sm">
                          Join →
                        </span>
                      </div>
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const verb = isOwner ? "delete" : "leave";
                        if (!confirm(`${isOwner ? "Delete" : "Leave"} room "${room.title || room.name}"?`)) return;
                        await closeRoom(room.host, room.name);
                      }}
                      title={isOwner ? "Delete room" : "Leave room"}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-stone-600 hover:text-red-400 px-2 py-1"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Incoming call overlay */}
      {incoming && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-stone-900 border border-stone-700 rounded-2xl p-8 flex flex-col items-center gap-6 max-w-sm w-full mx-4 shadow-2xl shadow-amber-900/20">
            <div className="w-16 h-16 rounded-full bg-amber-600/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-stone-400 text-sm">Incoming call from</p>
              <p className="text-xl font-mono text-stone-100 mt-1">~{incoming.peer}</p>
            </div>
            <div className="flex gap-3 w-full">
              <button onClick={rejectCall} className="flex-1 bg-red-900/40 hover:bg-red-800/50 text-red-300 py-3 rounded-lg transition-colors text-sm font-medium">
                Decline
              </button>
              <button onClick={handleAnswer} className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-white py-3 rounded-lg transition-colors text-sm font-medium">
                Answer
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="absolute bottom-4 flex items-center gap-4 text-stone-700 text-xs">
        <span>v0.2.0</span>
        <label className="flex items-center gap-1.5 text-stone-500 hover:text-stone-300 cursor-pointer transition-colors">
          <input
            type="checkbox"
            checked={audioOnly}
            onChange={(e) => setAudioOnly(e.target.checked)}
            className="accent-amber-600 w-3 h-3"
          />
          Audio only
        </label>
        {notifPermission === "default" && (
          <button
            onClick={requestNotificationPermission}
            className="text-amber-600/60 hover:text-amber-500 transition-colors"
          >
            Enable notifications
          </button>
        )}
      </footer>
    </div>
  );
}
