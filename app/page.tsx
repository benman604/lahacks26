"use client";

import React from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { currentMonitor, LogicalPosition, LogicalSize } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import LeftSidebar from "./components/LeftSidebar";
import FeedSection from "./components/FeedSection";
import SessionSummary from "./components/SessionSummary";
import RightSidebar from "./components/RightSidebar";
import { SessionData, type RawSessionData } from "./types";

const sessions: SessionData[] = [
  {
    userId: "ben",
    title: "Afternoon Study — Organic Chem",
    totalBreakTimeMinutes: 10,
    startTimestamp: new Date("2026-04-25T17:49:00"),
    endTimestamp: new Date("2026-04-25T19:29:00"),
    distractionTimes: [],
    focusElements: [
      {
        startTimestamp: new Date("2026-04-25T17:49:00"),
        endTimestamp: new Date("2026-04-25T18:39:00"),
        focusType: "productive",
      },
      {
        startTimestamp: new Date("2026-04-25T18:39:00"),
        endTimestamp: new Date("2026-04-25T18:49:00"),
        focusType: "break",
      },
      {
        startTimestamp: new Date("2026-04-25T18:49:00"),
        endTimestamp: new Date("2026-04-25T19:09:00"),
        focusType: "productive",
      },
      {
        startTimestamp: new Date("2026-04-25T19:09:00"),
        endTimestamp: new Date("2026-04-25T19:19:00"),
        focusType: "break",
      },
      {
        startTimestamp: new Date("2026-04-25T19:19:00"),
        endTimestamp: new Date("2026-04-25T19:29:00"),
        focusType: "productive",
      }
    ],
    appElements: [
      {
        startTimestamp: new Date("2026-04-25T17:49:00"),
        endTimestamp: new Date("2026-04-25T18:25:00"),
        activityName: "Lecture notes",
      },
      {
        startTimestamp: new Date("2026-04-25T18:25:00"),
        endTimestamp: new Date("2026-04-25T18:39:00"),
        activityName: "Practice problems",
      },
      {
        startTimestamp: new Date("2026-04-25T18:39:00"),
        endTimestamp: new Date("2026-04-25T18:49:00"),
        activityName: "Break",
      },
      {
        startTimestamp: new Date("2026-04-25T18:49:00"),
        endTimestamp: new Date("2026-04-25T19:09:00"),
        activityName: "Flashcards",
      },
      {
        startTimestamp: new Date("2026-04-25T19:09:00"),
        endTimestamp: new Date("2026-04-25T19:19:00"),
        activityName: "Messages",
      },
      {
        startTimestamp: new Date("2026-04-25T19:19:00"),
        endTimestamp: new Date("2026-04-25T19:29:00"),
        activityName: "Practice problems",
      },
    ],
    idleTimeSeconds: 240,
  },
  {
    userId: "esther",
    title: "Morning Focus — Linear Algebra",
    totalBreakTimeMinutes: 8,
    startTimestamp: new Date("2026-04-25T11:02:00"),
    endTimestamp: new Date("2026-04-25T12:02:00"),
    distractionTimes: [],
    focusElements: [
      {
        startTimestamp: new Date("2026-04-25T11:02:00"),
        endTimestamp: new Date("2026-04-25T11:47:00"),
        focusType: "productive",
      },
      {
        startTimestamp: new Date("2026-04-25T11:47:00"),
        endTimestamp: new Date("2026-04-25T11:55:00"),
        focusType: "break",
      },
      {
        startTimestamp: new Date("2026-04-25T11:55:00"),
        endTimestamp: new Date("2026-04-25T12:02:00"),
        focusType: "productive",
      },
    ],
    appElements: [
      {
        startTimestamp: new Date("2026-04-25T11:02:00"),
        endTimestamp: new Date("2026-04-25T11:30:00"),
        activityName: "Problem set",
      },
      {
        startTimestamp: new Date("2026-04-25T11:30:00"),
        endTimestamp: new Date("2026-04-25T11:47:00"),
        activityName: "Proof review",
      },
      {
        startTimestamp: new Date("2026-04-25T11:47:00"),
        endTimestamp: new Date("2026-04-25T11:55:00"),
        activityName: "Break",
      },
      {
        startTimestamp: new Date("2026-04-25T11:55:00"),
        endTimestamp: new Date("2026-04-25T12:02:00"),
        activityName: "Lecture recap",
      },
    ],
    idleTimeSeconds: 90,
  },
  {
    userId: "andyroo",
    title: "Late Night Grind — History Reading",
    totalBreakTimeMinutes: 10,
    startTimestamp: new Date("2026-04-25T21:10:00"),
    endTimestamp: new Date("2026-04-25T22:40:00"),
    distractionTimes: [],
    focusElements: [
      {
        startTimestamp: new Date("2026-04-25T21:10:00"),
        endTimestamp: new Date("2026-04-25T21:16:00"),
        focusType: "productive",
      },
      {
        startTimestamp: new Date("2026-04-25T21:16:00"),
        endTimestamp: new Date("2026-04-25T21:34:00"),
        focusType: "break",
      },
      {
        startTimestamp: new Date("2026-04-25T21:34:00"),
        endTimestamp: new Date("2026-04-25T21:48:00"),
        focusType: "break",
      },
      {
        startTimestamp: new Date("2026-04-25T21:48:00"),
        endTimestamp: new Date("2026-04-25T22:17:00"),
        focusType: "break",
      },
      {
        startTimestamp: new Date("2026-04-25T22:17:00"),
        endTimestamp: new Date("2026-04-25T22:28:00"),
        focusType: "break",
      },
      {
        startTimestamp: new Date("2026-04-25T22:28:00"),
        endTimestamp: new Date("2026-04-25T22:40:00"),
        focusType: "break",
      },
    ],
    appElements: [
      {
        startTimestamp: new Date("2026-04-25T21:10:00"),
        endTimestamp: new Date("2026-04-25T21:16:00"),
        activityName: "Reading outline",
      },
      {
        startTimestamp: new Date("2026-04-25T21:16:00"),
        endTimestamp: new Date("2026-04-25T21:25:00"),
        activityName: "Short videos",
      },
      {
        startTimestamp: new Date("2026-04-25T21:25:00"),
        endTimestamp: new Date("2026-04-25T21:34:00"),
        activityName: "Group chat",
      },
      {
        startTimestamp: new Date("2026-04-25T21:34:00"),
        endTimestamp: new Date("2026-04-25T21:48:00"),
        activityName: "Break",
      },
      {
        startTimestamp: new Date("2026-04-25T21:48:00"),
        endTimestamp: new Date("2026-04-25T22:06:00"),
        activityName: "Social media",
      },
      {
        startTimestamp: new Date("2026-04-25T22:06:00"),
        endTimestamp: new Date("2026-04-25T22:17:00"),
        activityName: "Online shopping",
      },
      {
        startTimestamp: new Date("2026-04-25T22:17:00"),
        endTimestamp: new Date("2026-04-25T22:28:00"),
        activityName: "Break",
      },
      {
        startTimestamp: new Date("2026-04-25T22:28:00"),
        endTimestamp: new Date("2026-04-25T22:40:00"),
        activityName: "Messages",
      },
    ],
    idleTimeSeconds: 1140,
  },
];

function parsePositiveInt(value: string, fallback: number) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

type ScreenshotDataWire = {
  timestamp?: unknown;
  focusType?: unknown;
  websiteOrApp?: unknown;
  isIdle?: unknown;
};

type RawSessionDataWire = {
  title?: unknown;
  subject?: unknown;
  totalBreakTimeMinutes?: unknown;
  startTimestamp?: unknown;
  endTimestamp?: unknown;
  distractionCount?: unknown;
  data?: unknown;
};

function toDate(value: unknown, fallback: Date) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return fallback;
}

function toPositiveNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const n = Number.parseFloat(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback;
}

function normalizeRawSessionData(payload: RawSessionDataWire): RawSessionData {
  const now = new Date();
  const startTimestamp = toDate(payload.startTimestamp, now);
  const endTimestamp = toDate(payload.endTimestamp, now);

  const data: RawSessionData["data"] = Array.isArray(payload.data)
    ? payload.data.map((entry) => {
        const wire = entry as ScreenshotDataWire;
        // @ts-expect-error because data from wire is not typed
        const focusType: RawSessionData["data"][number]["focusType"] = wire.focusType as string;

        return {
          timestamp: toDate(wire.timestamp, now),
          focusType,
          websiteOrApp: typeof wire.websiteOrApp === "string" ? wire.websiteOrApp : "unknown",
          isIdle: Boolean(wire.isIdle),
        };
      })
    : [];

  return {
    title: typeof payload.title === "string" ? payload.title : "Session",
    totalBreakTimeMinutes: toPositiveNumber(payload.totalBreakTimeMinutes, 10),
    startTimestamp,
    endTimestamp,
    distractionCount: typeof payload.distractionCount === "number" ? payload.distractionCount : 0,
    data,
  };
}

export default function Home() {
  const latestRawSessionDataRef = React.useRef<RawSessionData | null>(null);
  const [sessionSummaryData, setSessionSummaryData] = React.useState<RawSessionData | null>(null);
  const [allSessions] = React.useState<SessionData[]>(sessions);

  React.useEffect(() => {
    const unlistenPromise = listen("session-window-ready", async () => {
      const data = latestRawSessionDataRef.current;
      if (!data) return;
      const w = await WebviewWindow.getByLabel("session-window");
      if (!w) return;
      try {
        await w.emit("session-data", data);
      } catch (e) {
        console.error("failed to emit session-data", e);
      }
    });

    const unlistenSessionEndPromise = listen<RawSessionDataWire>("SessionEnd", async (event) => {
      setSessionSummaryData(normalizeRawSessionData(event.payload));

      // un-minimize the main window when a session ends
      const currentWindow = await WebviewWindow.getCurrent();
      if (currentWindow) {
        await currentWindow.unminimize();
      }
    });

    return () => {
      unlistenPromise.then((un) => un()).catch(() => {});
      unlistenSessionEndPromise.then((un) => un()).catch(() => {});
    };
  }, []);

  const [subject, setSubject] = React.useState<string>("Organic Chem");
  const [breakTime, setBreakTime] = React.useState<string>("10");

  function buildRawSessionData(): RawSessionData {
    const totalBreakTimeMinutes = parsePositiveInt(breakTime, 10);
    const startTimestamp = new Date();

    return {
      title: subject,
      totalBreakTimeMinutes,
      startTimestamp,
      endTimestamp: startTimestamp,
      distractionCount: 0,
      data: [],
    };
  }

  async function openSession(rawSessionData: RawSessionData) {
    latestRawSessionDataRef.current = rawSessionData;
    const label = "session-window";
    const existing = await WebviewWindow.getByLabel(label);
    if (existing) {
      await existing.setFocus();
      try {
        await existing.emit("session-data", rawSessionData);
      } catch (e) {
        console.error("failed to emit session-data to existing window", e);
      }
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
        const scale = monitor.scaleFactor;
        const logicalWidth = monitor.size.width / scale;
        const logicalHeight = monitor.size.height / scale;
        const w = 420;
        const h = 220;
        const x = Math.floor((logicalWidth - w) / 2);
        const y = Math.floor((logicalHeight - h) / 2);
        await win.setPosition(new LogicalPosition(x, y));
        await win.setSize(new LogicalSize(w, h));

        // Minimize the current window to reduce distraction
        const currentWindow = await WebviewWindow.getCurrent();
        if (currentWindow) {
          await currentWindow.minimize();
        }
      } catch (e) {
        console.error("failed to position session window", e);
      }
    });
  }

  if (sessionSummaryData) {
    return (
      <SessionSummary
        session={sessionSummaryData}
        onNext={() => setSessionSummaryData(null)}
      />
    );
  }

  const selectClass =
    "text-sm border border-gray-300 rounded px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-orange-400";

  return (
    <div className="flex gap-8 max-w-7xl mx-auto w-full px-6 py-8">
      <div className="hidden lg:block"><LeftSidebar sessions={allSessions} /></div>
      <main className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Start lock-in bar */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <div className="flex gap-3 items-end">
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Organic Chem"
                className={selectClass}
              />
            </div>

            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
                Break time
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={breakTime}
                  onChange={(e) => setBreakTime(e.target.value.replace(/\D/g, ""))}
                  placeholder="10"
                  className={`${selectClass} w-20`}
                />
                <span className="text-xs text-gray-400 shrink-0">min</span>
              </div>
            </div>

            <button
              onClick={() => openSession(buildRawSessionData())}
              className="flex-1 py-1.5 rounded-lg text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "var(--p2p-accent)" }}
            >
              Start lock-in
            </button>
          </div>
        </div>

        <FeedSection
          sessions={allSessions}
        />
      </main>
      <div className="hidden lg:block"><RightSidebar /></div>
    </div>
  );
}
