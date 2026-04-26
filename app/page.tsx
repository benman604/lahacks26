"use client";

import React from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { currentMonitor, LogicalPosition, LogicalSize } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import LeftSidebar from "./components/LeftSidebar";
import FeedSection, { type FeedPost } from "./components/FeedSection";
import RightSidebar from "./components/RightSidebar";
import { type RawSessionData } from "./types";

const posts: FeedPost[] = [
  {
    id: 1,
    initials: "B",
    color: "#3A6B9E",
    name: "Ben M.",
    date: "April 26, 2026 · 5:49 PM",
    title: "Afternoon Study — Organic Chem",
    kudos: 12,
    comments: [
      { initials: "M", color: "#7B5EA7", name: "Maya K.", text: "this is huge — keep going!" },
      { initials: "J", color: "#3A7D44", name: "Jordan T.", text: "the 90-min stretch is unreal!" },
    ],
  },
  {
    id: 2,
    initials: "E",
    color: "#BF4800",
    name: "Esther E.",
    date: "April 25, 2026 · 11:02 AM",
    title: "Morning Focus — Linear Algebra",
    kudos: 5,
    comments: [],
  },
];

function deriveSubjectFromTitle(title: string) {
  const parts = title.split("—");
  const maybe = parts.length > 1 ? parts[parts.length - 1] : title;
  return maybe.trim();
}

function parsePositiveInt(value: string, fallback: number) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export default function Home() {
  const latestRawSessionDataRef = React.useRef<RawSessionData | null>(null);

  React.useEffect(() => {
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

    return () => {
      unlistenPromise.then((un) => un()).catch(() => {});
    };
  }, []);

  const [highlightedPostId, setHighlightedPostId] = React.useState<number | null>(posts[0]?.id ?? null);
  const highlightedPost = React.useMemo(
    () => posts.find((p) => p.id === highlightedPostId) ?? null,
    [highlightedPostId]
  );

  const [subject, setSubject] = React.useState(() => {
    const initial = posts[0]?.title ? deriveSubjectFromTitle(posts[0].title) : "";
    return initial || "Organic Chem";
  });
  const [duration, setDuration] = React.useState("50");
  const [breakTime, setBreakTime] = React.useState("10");

  function buildRawSessionData(): RawSessionData {
    const plannedDurationMinutes = parsePositiveInt(duration, 50);
    const idealBreakTimeMinutes = parsePositiveInt(breakTime, 10);
    const startTimestamp = new Date();
    const endTimestamp = new Date(startTimestamp.getTime() + plannedDurationMinutes * 60_000);
    const cleanSubject = subject.trim() || (highlightedPost ? deriveSubjectFromTitle(highlightedPost.title) : "");

    return {
      title: highlightedPost?.title ?? `${cleanSubject || "Session"}`,
      subject: cleanSubject || "",
      plannedDurationMinutes,
      idealBreakTimeMinutes,
      startTimestamp,
      endTimestamp,
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
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("failed to position session window", e);
      }
    });
  }

  const selectClass =
    "text-sm border border-gray-300 rounded px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-orange-400";

  return (
    <div className="flex gap-8 max-w-7xl mx-auto w-full px-6 py-8">
      <div className="hidden lg:block"><LeftSidebar /></div>
      <main className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Start lock-in bar */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex flex-col gap-3">
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
                className={`${selectClass} w-full`}
              />
            </div>

            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
                Duration
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value.replace(/\D/g, ""))}
                  placeholder="50"
                  className={`${selectClass} w-full`}
                />
                <span className="text-xs text-gray-400 shrink-0">min</span>
              </div>
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
                  className={`${selectClass} w-full`}
                />
                <span className="text-xs text-gray-400 shrink-0">min</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => openSession(buildRawSessionData())}
            className="col-span-2 py-2 rounded-lg text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "var(--p2p-accent)" }}
          >
            Start lock-in
          </button>
        </div>

        <FeedSection
          posts={posts}
          highlightedPostId={highlightedPostId}
          onHighlightPostId={(postId) => {
            setHighlightedPostId(postId);
            const p = posts.find((x) => x.id === postId);
            if (p) setSubject(deriveSubjectFromTitle(p.title));
          }}
        />
      </main>
      <div className="hidden lg:block"><RightSidebar /></div>
    </div>
  );
}
