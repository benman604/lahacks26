"use client";

import { useEffect, useState } from "react";

import SessionSummaryCard from "./SessionSummaryCard";
import type { SessionData } from "../types";
import { MOCK_SESSIONS } from "../lib/mockSessions";
import { loadLocalSessions } from "../lib/localSessions";
import {
  computeAverageMetrics,
  computeSessionMetrics,
  computeSessionDayStreak,
  filterSessionsForCurrentWeek,
  formatWeekRange,
  getCurrentWeekBounds,
  secondsBetween,
} from "../lib/sessionStats";

export default function FeedSection({
  openBlockers,
}: {
  openBlockers: () => void;
}) {
  const [sessions, setSessions] = useState<SessionData[]>(MOCK_SESSIONS);
  const [subject, setSubject] = useState("Organic Chem");
  const [duration, setDuration] = useState("50");
  const [breakTime, setBreakTime] = useState("10");

  useEffect(() => {
    let alive = true;

    loadLocalSessions()
      .then((nextSessions) => {
        if (alive) {
          setSessions(nextSessions);
        }
      })
      .catch((error) => {
        console.error("Failed to load sessions", error);
      });

    return () => {
      alive = false;
    };
  }, []);

  const selectClass =
    "text-sm border border-gray-300 rounded px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-orange-400";

  const weeklySessions = filterSessionsForCurrentWeek(sessions);
  const averageMetrics = computeAverageMetrics(weeklySessions);
  const weeklyFocusMinutes = Math.round(
    weeklySessions.reduce((sum, session) => {
      const totalSeconds = secondsBetween(session.startTimestamp, session.endTimestamp);
      const metrics = computeSessionMetrics(session);
      return sum + (totalSeconds * metrics.productivityRate) / 100 / 60;
    }, 0)
  );
  const longestWeeklyStreak = computeSessionDayStreak(weeklySessions);
  const weeklySnapshot = [
    { label: "Focus minutes", value: `${weeklyFocusMinutes}`, delta: "week" },
    { label: "Sessions", value: `${weeklySessions.length}`, delta: "count" },
    { label: "Avg Focus", value: `${averageMetrics.focus}%`, delta: "avg" },
    { label: "Longest streak", value: `${longestWeeklyStreak} days`, delta: "best" },
  ];
  const { start: weekStart, end: weekEnd } = getCurrentWeekBounds();
  const weekRange = formatWeekRange(weekStart, weekEnd);

  return (
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
          onClick={openBlockers}
          className="w-full py-2 rounded-lg text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          style={{ backgroundColor: "var(--p2p-accent)" }}
        >
          Start lock-in
        </button>

        <section className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold tracking-wide text-gray-700 uppercase">
              Weekly snapshot
            </p>
            <p className="text-[11px] text-gray-500">{weekRange}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {weeklySnapshot.map(({ label, value, delta }) => (
              <div key={label} className="rounded-md bg-white border border-orange-100 px-2 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
                <div className="flex items-end justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">{value}</p>
                  <span className="text-[10px] font-semibold text-orange-700">{delta}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Feed posts */}
      {sessions.map((session) => (
        <SessionSummaryCard
          key={`${session.userId}-${session.startTimestamp.toISOString()}`}
          session={session}
          username={
            session.userId === "ben"
              ? "Ben M."
              : session.userId === "esther"
                ? "Esther E."
                : session.userId === "andyroo"
                  ? "Andyroo"
                  : "Unknown User"
          }
        />
      ))}
    </main>
  );
}
