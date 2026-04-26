"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { currentMonitor, LogicalPosition, LogicalSize } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import LeftSidebar from "./components/LeftSidebar";
import FeedSection, { type FeedPost } from "./components/FeedSection";
import SessionSummary from "./components/SessionSummary";
import RightSidebar from "./components/RightSidebar";
import { SessionData, type FocusType, type RawSessionData } from "./types";
import { db } from "../lib/db";
import { collection, getDocs } from "firebase/firestore";

type TimestampLike = {
  toDate?: () => Date;
  seconds?: number;
  nanoseconds?: number;
};

type SessionDataWire = Partial<Omit<SessionData, "startTimestamp" | "endTimestamp" | "focusElements" | "appElements">> & {
  startTimestamp?: unknown;
  endTimestamp?: unknown;
  focusElements?: Array<{
    startTimestamp?: unknown;
    endTimestamp?: unknown;
    focusType?: unknown;
  }>;
  appElements?: Array<{
    startTimestamp?: unknown;
    endTimestamp?: unknown;
    activityName?: unknown;
  }>;
};

const sessions: SessionData[] = [];

function toDateFromFirestore(value: unknown, fallback: Date) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }

  const timestamp = value as TimestampLike;
  if (timestamp && typeof timestamp.toDate === "function") {
    const d = timestamp.toDate();
    if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
  }
  if (timestamp && typeof timestamp.seconds === "number") {
    const ms = timestamp.seconds * 1000 + (timestamp.nanoseconds ?? 0) / 1_000_000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d;
  }

  return fallback;
}

function normalizeSessionDataFromFirestore(payload: SessionDataWire): SessionData {
  const now = new Date();
  const startTimestamp = toDateFromFirestore(payload.startTimestamp, now);
  const endTimestamp = toDateFromFirestore(payload.endTimestamp, startTimestamp);

  const focusElements = Array.isArray(payload.focusElements)
    ? payload.focusElements.map((entry) => ({
        startTimestamp: toDateFromFirestore(entry.startTimestamp, startTimestamp),
        endTimestamp: toDateFromFirestore(entry.endTimestamp, endTimestamp),
        focusType: normalizeFocusType(entry.focusType),
      }))
    : [];

  const appElements = Array.isArray(payload.appElements)
    ? payload.appElements.map((entry) => ({
        startTimestamp: toDateFromFirestore(entry.startTimestamp, startTimestamp),
        endTimestamp: toDateFromFirestore(entry.endTimestamp, endTimestamp),
        activityName: typeof entry.activityName === "string" ? entry.activityName : "unknown",
      }))
    : [];

  return {
    userId: typeof payload.userId === "string" ? payload.userId : "unknown",
    title: typeof payload.title === "string" ? payload.title : "Session",
    totalBreakTimeMinutes:
      typeof payload.totalBreakTimeMinutes === "number" ? payload.totalBreakTimeMinutes : 0,
    startTimestamp,
    endTimestamp,
    focusElements,
    appElements,
    idleTimeSeconds: typeof payload.idleTimeSeconds === "number" ? payload.idleTimeSeconds : 0,
  };
}

function normalizeFocusType(value: unknown): FocusType {
  if (
    value === "productive" ||
    value === "supportive" ||
    value === "neutral" ||
    value === "break"
  ) {
    return value;
  }
  return "neutral";
}

function deriveSubjectFromTitle(title: string) {
  const parts = title.split("—");
  const maybe = parts.length > 1 ? parts[parts.length - 1] : title;
  return maybe.trim();
}

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
  const [allSessions, setAllSessions] = React.useState<SessionData[]>(sessions);

  const fetchSessions = React.useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, "p2p2"));
      const fetchedSessions = snapshot.docs
        .map((doc) => normalizeSessionDataFromFirestore(doc.data() as SessionDataWire))
        .sort((a, b) => b.startTimestamp.getTime() - a.startTimestamp.getTime());

      setAllSessions(fetchedSessions);
    } catch (e) {
      console.error("failed to load sessions", e);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    const unlistenPromise = listen("session-window-ready", async () => {
      const data = latestRawSessionDataRef.current;
      if (!data) return;
      const w = await WebviewWindow.getByLabel("session-window");
      if (!w) return;
      try {
        await w.emit("session-data", data);
      } catch (e) {
        // eslint-disable-next-line no-console
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
        // eslint-disable-next-line no-console
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
        // eslint-disable-next-line no-console
        console.error("failed to position session window", e);
      }
    });
  }

  if (sessionSummaryData) {
    return (
      <SessionSummary
        session={sessionSummaryData}
        onNext={async () => {
          await fetchSessions();
          setSessionSummaryData(null);
        }}
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
