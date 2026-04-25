"use client";

import React from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { currentMonitor, LogicalPosition, LogicalSize } from "@tauri-apps/api/window";
import LeftSidebar from "./components/LeftSidebar";
import FeedSection from "./components/FeedSection";
import RightSidebar from "./components/RightSidebar";

export default function Home() {
  async function openSession() {
    const label = "session-window";
    const existing = await WebviewWindow.getByLabel(label);
    if (existing) {
      await existing.setFocus();
      return;
    }

    const win = new WebviewWindow(label, {
      url: "/session/window",
      decorations: true,
      alwaysOnTop: true,
      resizable: true,
      transparent: false,
      minimizable: true,
    });

    win.once("tauri://created", async () => {
      try {
        const monitor = await currentMonitor();
        if (!monitor) return;
        const { width, height } = monitor.size;
        const w = 420;
        const h = 220;
        const x = Math.floor((width - w) / 2);
        const y = Math.floor((height - h) / 2);
        await win.setPosition(new LogicalPosition(x, y));
        await win.setSize(new LogicalSize(w, h));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("failed to position session window", e);
      }
    });
  }

  return (
    <div className="flex gap-8 max-w-7xl mx-auto w-full px-6 py-8">
      <div className="hidden lg:block"><LeftSidebar /></div>
      <FeedSection openSession={openSession} />
      <div className="hidden lg:block"><RightSidebar /></div>
    </div>
  );
}
