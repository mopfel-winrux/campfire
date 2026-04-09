import React, { createContext, useContext, useMemo } from "react";
import Urbit from "@urbit/http-api";

interface UrbitCtx {
  urbit: Urbit;
  ship: string;
}

const UrbitContext = createContext<UrbitCtx>(null!);

export function UrbitProvider({ children }: { children: React.ReactNode }) {
  const ctx = useMemo(() => {
    const urbit = new Urbit("", "");
    const ship =
      (window as any).ship || "";
    urbit.ship = ship;
    urbit.verbose = true;
    return { urbit, ship };
  }, []);

  return (
    <UrbitContext.Provider value={ctx}>{children}</UrbitContext.Provider>
  );
}

export const useUrbit = () => useContext(UrbitContext);
