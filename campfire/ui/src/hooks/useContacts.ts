import { useEffect, useState } from "react";
import { useUrbit } from "./useUrbit";

export interface Contact {
  nickname: string;
  avatar: string;
  color: string;
}

export function useContacts() {
  const { urbit } = useUrbit();
  const [contacts, setContacts] = useState<Map<string, Contact>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!urbit.ship) return;

    urbit
      .scry<Record<string, any>>({ app: "contacts", path: "/all" })
      .then((rolodex) => {
        const map = new Map<string, Contact>();
        if (rolodex && typeof rolodex === "object") {
          for (const [ship, data] of Object.entries(rolodex)) {
            if (!data || ship === urbit.ship) continue;
            const info = data?.info || data;
            map.set(ship, {
              nickname: info?.nickname || "",
              avatar: info?.avatar || "",
              color: info?.color || "#999999",
            });
          }
        }
        setContacts(map);
      })
      .catch((err) => {
        console.warn("Could not load contacts (agent may not be installed):", err);
      })
      .finally(() => setLoading(false));
  }, [urbit]);

  return { contacts, loading };
}
