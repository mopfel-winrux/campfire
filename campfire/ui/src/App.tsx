import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { UrbitProvider } from "./hooks/useUrbit";
import { SettingsProvider } from "./hooks/useSettings";
import { CallProvider } from "./hooks/useCall";
import Home from "./pages/Home";
import CallPage from "./pages/CallPage";
import RoomPage from "./pages/RoomPage";

export default function App() {
  return (
    <UrbitProvider>
      <SettingsProvider>
        <CallProvider>
        <BrowserRouter basename="/apps/campfire">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/call/:patp" element={<Home />} />
            <Route path="/chat/:uuid" element={<CallPage />} />
            <Route path="/room/:host/:name" element={<RoomPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        </CallProvider>
      </SettingsProvider>
    </UrbitProvider>
  );
}
