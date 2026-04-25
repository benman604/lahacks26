"use client";

import React, { useEffect, useRef, useState } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { availableMonitors, LogicalPosition, LogicalSize, currentMonitor } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";

const blockerLabels: string[] = [];

export default function SessionWindow() {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const unlistenPromise = listen("trigger-blockers", async () => {
      await openBlockers();
    });

    return () => {
      unlistenPromise.then((un) => un()).catch(() => {});
      stopTimer();
      closeBlockers();
    };
  }, []);

  async function openBlockers() {
    let monitors = [] as any[];
    try {
      monitors = await availableMonitors();
    } catch (e) {
      const m = await currentMonitor();
      if (m) monitors = [m];
    }

    for (let i = 0; i < monitors.length; i++) {
      const m = monitors[i];
      const label = `blocker-${i}`;

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
          const scale = m.scaleFactor || 1;
          const pos = m.position ?? { x: 0, y: 0 };
          await blocker.setPosition(new LogicalPosition(pos.x / scale, pos.y / scale));
          await blocker.setSize(new LogicalSize(m.size.width / scale, m.size.height / scale));
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("failed to size blocker", e);
        }
      });

      blocker.once("tauri://error", (e) => {
        // eslint-disable-next-line no-console
        console.error("failed to create blocker", e);
      });

      blockerLabels.push(label);
    }
  }

  async function closeBlockers() {
    for (const label of blockerLabels.splice(0)) {
      const w = await WebviewWindow.getByLabel(label);
      if (w) {
        try {
          await w.close();
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("failed to close blocker", label, e);
        }
      }
    }
  }

  function startTimer(seconds: number) {
    if (timerRef.current) return;
    setSecondsLeft(seconds);
    setRunning(true);
    timerRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          stopTimer();
          // when timer ends, trigger blockers
          openBlockers().catch((e) => console.error(e));
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRunning(false);
  }

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(sec % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  }

  return (
    <div className="p-4 w-full h-full flex flex-col gap-4 items-center justify-center">
      <div className="flex flex-col items-center">
        <h2 className="text-lg font-semibold">Session Controller</h2>
        <div className="mt-2 text-2xl">{formatTime(secondsLeft)}</div>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => startTimer(25 * 60)}
            className="px-3 py-1 rounded bg-blue-600 text-white"
          >
            Start 25m
          </button>
          <button onClick={() => startTimer(5 * 60)} className="px-3 py-1 rounded bg-green-600 text-white">
            Start 5m
          </button>
          <button onClick={stopTimer} className="px-3 py-1 rounded bg-yellow-500">
            Pause
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => openBlockers()}
          className="px-3 py-1 rounded bg-red-600 text-white"
        >
          Test Blocking
        </button>

        <button
          onClick={() => {
            stopTimer();
            closeBlockers();
          }}
          className="px-3 py-1 rounded bg-gray-700 text-white"
        >
          Stop Session
        </button>
      </div>
    </div>
  );
}