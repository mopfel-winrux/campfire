import React, { createContext, useContext, useEffect, useState } from "react";

interface Settings {
  audioOnly: boolean;
  setAudioOnly: (v: boolean) => void;
}

const SettingsContext = createContext<Settings>(null!);

const STORAGE_KEY = "campfire-settings";

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [audioOnly, setAudioOnlyState] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed.audioOnly === "boolean") {
          setAudioOnlyState(parsed.audioOnly);
        }
      }
    } catch {}
  }, []);

  const setAudioOnly = (v: boolean) => {
    setAudioOnlyState(v);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ audioOnly: v }));
    } catch {}
  };

  return (
    <SettingsContext.Provider value={{ audioOnly, setAudioOnly }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
