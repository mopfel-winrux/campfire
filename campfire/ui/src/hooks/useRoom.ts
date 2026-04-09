import { useCallback, useEffect, useRef, useState } from "react";
import { useUrbit } from "./useUrbit";

export interface Room {
  host: string;
  name: string;
  title: string;
  members: string[];
  public: boolean;
  created: string;
}

export function useRoom() {
  const { urbit, ship } = useUrbit();
  const [hostedRooms, setHostedRooms] = useState<Room[]>([]);
  const [joinedRooms, setJoinedRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const subIdRef = useRef<number | null>(null);

  // Load rooms on mount
  useEffect(() => {
    if (!ship) return;
    refreshRooms();
  }, [ship]);

  const refreshRooms = useCallback(async () => {
    try {
      const hosted = await urbit.scry<any>({ app: "campfire", path: "/hosted" });
      if (Array.isArray(hosted)) {
        setHostedRooms(hosted.map(parseRoom));
      }
    } catch (e) {
      console.warn("Could not load hosted rooms:", e);
    }
    try {
      const joined = await urbit.scry<any>({ app: "campfire", path: "/joined" });
      if (Array.isArray(joined)) {
        setJoinedRooms(joined.map(parseRoom));
      }
    } catch (e) {
      console.warn("Could not load joined rooms:", e);
    }
  }, [urbit]);

  const createRoom = useCallback(
    async (name: string, title: string, isPublic = false) => {
      await urbit.poke({
        app: "campfire",
        mark: "campfire-action",
        json: { type: "create", name, title, public: isPublic },
      });
      await refreshRooms();
    },
    [urbit, refreshRooms]
  );

  const joinRoom = useCallback(
    async (host: string, name: string) => {
      // Subscribe for live updates
      const subId = await urbit.subscribe({
        app: "campfire",
        path: "/joined",
        event: (evt: any) => {
          console.log("Room event:", evt);
          if (evt.type === "snapshot") {
            setCurrentRoom(parseRoom(evt.room));
          } else if (evt.type === "joined") {
            setCurrentRoom((r) =>
              r ? { ...r, members: [...new Set([...r.members, evt.who])] } : r
            );
          } else if (evt.type === "left") {
            setCurrentRoom((r) =>
              r ? { ...r, members: r.members.filter((m) => m !== evt.who) } : r
            );
          } else if (evt.type === "closed") {
            setCurrentRoom(null);
          }
        },
        err: (e: any) => console.error("Room sub error:", e),
        quit: () => console.warn("Room subscription quit"),
      });
      subIdRef.current = subId;

      // Poke to join (might fail if already joined — that's ok)
      try {
        await urbit.poke({
          app: "campfire",
          mark: "campfire-action",
          json: { type: "join", host: `~${host.replace(/^~/, "")}`, name },
        });
      } catch (e) {
        console.warn("Join poke failed (may already be joined):", e);
      }

      // Fallback: scry for current state after a short delay
      setTimeout(async () => {
        try {
          const joined = await urbit.scry<any[]>({ app: "campfire", path: "/joined" });
          if (Array.isArray(joined)) {
            const match = joined.find((r: any) => r.name === name);
            if (match) {
              console.log("Room fallback scry found:", match);
              setCurrentRoom(parseRoom(match));
            }
          }
        } catch (e) {
          console.warn("Room fallback scry failed:", e);
        }
      }, 2000);
    },
    [urbit]
  );

  const joinHostedRoom = useCallback(
    async (name: string) => {
      const subId = await urbit.subscribe({
        app: "campfire",
        path: `/room/${name}`,
        event: (evt: any) => {
          console.log("Hosted room event:", evt);
          if (evt.type === "snapshot") {
            setCurrentRoom(parseRoom(evt.room));
          } else if (evt.type === "joined") {
            setCurrentRoom((r) =>
              r ? { ...r, members: [...new Set([...r.members, evt.who])] } : r
            );
          } else if (evt.type === "left") {
            setCurrentRoom((r) =>
              r ? { ...r, members: r.members.filter((m) => m !== evt.who) } : r
            );
          } else if (evt.type === "closed") {
            setCurrentRoom(null);
          }
        },
        err: (e: any) => console.error("Hosted room sub error:", e),
        quit: () => console.warn("Hosted room subscription quit"),
      });
      subIdRef.current = subId;

      // Fallback scry
      setTimeout(async () => {
        try {
          const hosted = await urbit.scry<any[]>({ app: "campfire", path: "/hosted" });
          if (Array.isArray(hosted)) {
            const match = hosted.find((r: any) => r.name === name);
            if (match) {
              console.log("Hosted room fallback scry found:", match);
              setCurrentRoom(parseRoom(match));
            }
          }
        } catch (e) {
          console.warn("Hosted room fallback scry failed:", e);
        }
      }, 1500);
    },
    [urbit]
  );

  const leaveRoom = useCallback(
    async (host: string, name: string) => {
      if (host.replace(/^~/, "") === ship) {
        // We're the host — close the room
        await urbit.poke({
          app: "campfire",
          mark: "campfire-action",
          json: { type: "close", name },
        });
      } else {
        await urbit.poke({
          app: "campfire",
          mark: "campfire-action",
          json: { type: "leave", host: `~${host.replace(/^~/, "")}`, name },
        });
      }
      if (subIdRef.current !== null) {
        urbit.unsubscribe(subIdRef.current);
        subIdRef.current = null;
      }
      setCurrentRoom(null);
      await refreshRooms();
    },
    [urbit, ship, refreshRooms]
  );

  return {
    hostedRooms,
    joinedRooms,
    currentRoom,
    createRoom,
    joinRoom,
    joinHostedRoom,
    leaveRoom,
    refreshRooms,
  };
}

function parseRoom(data: any): Room {
  return {
    host: data.host || "",
    name: data.name || "",
    title: data.title || "",
    members: Array.isArray(data.members) ? data.members : [],
    public: data.public || false,
    created: data.created || "",
  };
}
