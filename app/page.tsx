"use client";

import React, { useEffect } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  availableMonitors,
  LogicalPosition,
  LogicalSize,
} from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";

const blockerLabels: string[] = [];

export default function Home() {
  useEffect(() => {
    let mounted = true;

    const unlistenPromise = listen("close-blockers", async () => {
      if (!mounted) return;

      for (const label of blockerLabels.splice(0)) {
        const w = await WebviewWindow.getByLabel(label);

        if (w) {
          try {
            await w.close();
          } catch (e) {
            console.error("failed to close blocker", label, e);
          }
        }
      }
    });

    return () => {
      mounted = false;
      unlistenPromise.then((un) => un()).catch(() => {});
    };
  }, []);

  async function openBlockers() {
    const monitors = await availableMonitors();

    for (let i = 0; i < monitors.length; i++) {
      const m = monitors[i];
      const label = `blocker-${i}`;

      // prevent duplicates
      const existing = await WebviewWindow.getByLabel(label);
      if (existing) {
        await existing.setFocus();
        continue;
      }

      const blocker = new WebviewWindow(label, {
        url: "/session/gbtw",
        decorations: false,
        alwaysOnTop: true,
        resizable: false,
        transparent: true,
      });

      blocker.once("tauri://created", async () => {
        try {
          const scale = m.scaleFactor;

          // IMPORTANT: use monitor position + size (physical → convert)
          await blocker.setPosition(
            new LogicalPosition(m.position.x / scale, m.position.y / scale)
          );

          await blocker.setSize(
            new LogicalSize(
              m.size.width / scale,
              m.size.height / scale
            )
          );
        } catch (e) {
          console.error("failed to size blocker", e);
        }
      });

      blocker.once("tauri://error", (e) => {
        console.error("failed to create blocker", e);
      });

      blockerLabels.push(label);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <button
        onClick={openBlockers}
        className="px-6 py-3 rounded-full bg-black text-white"
      >
        Start Session
      </button>
    </div>
  );
}