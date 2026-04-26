"use client";

import { useEffect, useState } from "react";

import type { SessionData } from "../types";
import { loadLocalSessions } from "../lib/localSessions";
import { MOCK_SESSIONS } from "../lib/mockSessions";
import { computeAverageMetrics, computeLifetimeStats } from "../lib/sessionStats";

export default function LeftSidebar() {
  const [sessions, setSessions] = useState<SessionData[]>(MOCK_SESSIONS);

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

  const averageMetrics = computeAverageMetrics(sessions);
  const lifetime = computeLifetimeStats(sessions);

  const lifetimeAverages = [
    { label: "Foc", value: `${averageMetrics.focus}` },
    { label: "Rec", value: `${averageMetrics.recovery}` },
    { label: "Fix", value: `${averageMetrics.fixes}` },
    { label: "Cha", value: `${averageMetrics.chaos}` },
    { label: "Pon", value: `${averageMetrics.ponder}` },
  ];

  const lifetimeStats = [
    { label: "Focus Hours", value: lifetime.focusHours },
    { label: "Completed Sessions", value: lifetime.completedSessions },
    { label: "Most Studied", value: lifetime.mostStudied },
    { label: "Best Focus Streak", value: lifetime.bestFocusStreak },
  ];

  return (
    <aside className="w-48 shrink-0 flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 pt-2">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-semibold"
          style={{ backgroundColor: "#7B5230" }}
        >
          A
        </div>
        <div className="text-center">
          <p className="font-semibold text-sm">Andrew Suh</p>
          <p className="text-xs text-gray-500">@andreww</p>
        </div>
      </div>

      <div className="grid grid-cols-2 text-center border-t border-b border-gray-200 py-3">
        {[
          { value: "12", label: "FOLLOWERS" },
          { value: "8", label: "FOLLOWING" },
        ].map(({ value, label }) => (
          <div key={label}>
            <p className="font-bold text-sm">{value}</p>
            <p className="text-[10px] text-gray-500 tracking-wide">{label}</p>
          </div>
        ))}
      </div>

      <section className="rounded-lg border border-gray-200 bg-white px-3 py-3">
        <div className="mb-2">
          <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
            Lifetime stats
          </p>
        </div>

        <div className="mb-3 grid grid-cols-5 gap-1">
          {lifetimeAverages.map(({ label, value }) => (
            <div key={label} className="rounded border border-gray-100 bg-gray-50 px-1.5 py-1 text-center">
              <p className="text-[9px] uppercase tracking-wide text-gray-500">{label}</p>
              <p className="text-xs font-semibold text-gray-900">{value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {lifetimeStats.map(({ label, value }) => (
            <div key={label} className="border-b border-gray-100 last:border-b-0 pb-2 last:pb-0">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
              <p className="text-sm font-semibold text-gray-900 leading-tight">{value}</p>
            </div>
          ))}
        </div>
      </section>

    </aside>
  );
}
