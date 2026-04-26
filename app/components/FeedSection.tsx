"use client";

import { useEffect, useState } from "react";

import SessionSummaryCard from "./SessionSummaryCard";
import type { SessionData } from "../types";
import { MOCK_SESSIONS } from "../lib/mockSessions";
import {
  appendLocalSession,
  loadLocalSessions,
  subscribeToSessionsUpdated,
} from "../lib/localSessions";
import {
  calculateProductivityScore,
  computeSessionMetrics,
  computeSessionDayStreak,
  filterSessionsForCurrentWeek,
  formatWeekRange,
  getCurrentWeekBounds,
  secondsBetween,
} from "../lib/sessionStats";

function buildDemoSessionFromInputs({
  subject,
  durationMinutes,
  breakMinutes,
}: {
  subject: string;
  durationMinutes: number;
  breakMinutes: number;
}): SessionData {
  const randInt = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  const jitteredDuration = Math.max(20, durationMinutes + randInt(-10, 15));
  const sessionTypePool = ["focus-first", "balanced", "choppy"] as const;
  const sessionType = sessionTypePool[randInt(0, sessionTypePool.length - 1)];

  const focusStartRatio =
    sessionType === "focus-first"
      ? randInt(42, 58) / 100
      : sessionType === "balanced"
        ? randInt(30, 45) / 100
        : randInt(22, 35) / 100;
  const breakRatio = Math.min(0.28, Math.max(0.07, (breakMinutes + randInt(-3, 5)) / 100));
  const distractRatio =
    sessionType === "focus-first"
      ? randInt(8, 16) / 100
      : sessionType === "balanced"
        ? randInt(12, 22) / 100
        : randInt(18, 30) / 100;

  const focusOneMinutes = Math.max(8, Math.floor(jitteredDuration * focusStartRatio));
  const actualBreakMinutes = Math.max(3, Math.floor(jitteredDuration * breakRatio));
  const distractedMinutes = Math.max(4, Math.floor(jitteredDuration * distractRatio));
  const focusTwoMinutes = Math.max(
    6,
    jitteredDuration - focusOneMinutes - actualBreakMinutes - distractedMinutes
  );

  const end = new Date();
  const startJitterMinutes = randInt(0, 40);
  const start = new Date(
    end.getTime() - (focusOneMinutes + actualBreakMinutes + distractedMinutes + focusTwoMinutes + startJitterMinutes) * 60 * 1000
  );

  const t1 = new Date(start.getTime() + focusOneMinutes * 60 * 1000);
  const t2 = new Date(t1.getTime() + actualBreakMinutes * 60 * 1000);
  const t3 = new Date(t2.getTime() + distractedMinutes * 60 * 1000);

  const studyApps = [
    "Lecture notes",
    "Practice problems",
    "Textbook reading",
    "Flashcards",
    "Problem set",
    "Review sheet",
    `${subject || "Subject"} notes`,
  ];
  const distractApps = ["Messages", "Social media", "Video clips", "Online shopping", "Group chat"];

  const pick = (arr: string[]) => arr[randInt(0, arr.length - 1)];
  const demoUsers = ["ben", "esther", "andreww"];

  return {
    userId: demoUsers[randInt(0, demoUsers.length - 1)],
    title: `Lock-in - ${subject.trim() || "General Study"}`,
    idealBreakTimeMinutes: breakMinutes,
    startTimestamp: start,
    endTimestamp: end,
    focusElements: [
      { startTimestamp: start, endTimestamp: t1, focusType: "focus" },
      { startTimestamp: t1, endTimestamp: t2, focusType: "break" },
      { startTimestamp: t2, endTimestamp: t3, focusType: "distracted" },
      { startTimestamp: t3, endTimestamp: end, focusType: "focus" },
    ],
    appElements: [
      { startTimestamp: start, endTimestamp: t1, activityName: pick(studyApps) },
      { startTimestamp: t1, endTimestamp: t2, activityName: "Break" },
      { startTimestamp: t2, endTimestamp: t3, activityName: pick(distractApps) },
      { startTimestamp: t3, endTimestamp: end, activityName: pick(studyApps) },
    ],
    idleTimeSeconds: Math.round((focusOneMinutes + actualBreakMinutes + distractedMinutes + focusTwoMinutes) * 60 * (randInt(2, 14) / 100)),
  };
}

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

    const refreshSessions = () => {
      loadLocalSessions()
        .then((nextSessions) => {
          if (alive) {
            setSessions(nextSessions);
          }
        })
        .catch((error) => {
          console.error("Failed to load sessions", error);
        });
    };

    refreshSessions();
    const unsubscribe = subscribeToSessionsUpdated(refreshSessions);

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const selectClass =
    "text-sm border border-gray-300 rounded px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-orange-400";

  const weeklySessions = filterSessionsForCurrentWeek(sessions);
  const averageWeeklyProductiveScore = Math.round(
    weeklySessions.reduce((sum, session) => {
      const metrics = computeSessionMetrics(session);
      return sum + calculateProductivityScore(metrics);
    }, 0) / Math.max(1, weeklySessions.length)
  );
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
    { label: "Avg Productivity", value: `${averageWeeklyProductiveScore}%`, delta: "avg" },
    { label: "Longest streak", value: `${longestWeeklyStreak} days`, delta: "best" },
  ];
  const { start: weekStart, end: weekEnd } = getCurrentWeekBounds();
  const weekRange = formatWeekRange(weekStart, weekEnd);

  async function appendDemoSession() {
    const parsedDuration = Math.max(1, Number.parseInt(duration || "50", 10) || 50);
    const parsedBreak = Math.max(1, Number.parseInt(breakTime || "10", 10) || 10);

    const nextSession = buildDemoSessionFromInputs({
      subject,
      durationMinutes: parsedDuration,
      breakMinutes: parsedBreak,
    });

    // Add compact metrics/timeline for immediate rendering even without raw playback data.
    nextSession.summaryMetrics = computeSessionMetrics(nextSession);

    setSessions((prev) => [nextSession, ...prev]);

    try {
      await appendLocalSession(nextSession);
    } catch (error) {
      console.error("Failed to append local session", error);
    }
  }

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

        <button
          onClick={appendDemoSession}
          className="w-full py-2 rounded-lg text-sm font-semibold border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 transition-colors"
        >
          Save demo session
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
                : session.userId === "andreww"
                  ? "Andyroo"
                  : "Unknown User"
          }
        />
      ))}
    </main>
  );
}
