"use client";

import React from "react";
import SessionSummaryCard from "./SessionSummaryCard";
import type { AppElement, FocusElement, RawSessionData, SessionData } from "../types";

type Props = {
  session: RawSessionData;
  onNext: () => void;
};

function secondsBetween(start: Date, end: Date) {
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
}

function buildSegments(start: Date, end: Date, names: Array<FocusElement["focusType"]>, ratios: number[]) {
  const totalSeconds = secondsBetween(start, end);
  let cursor = new Date(start);

  return names.map((focusType, index) => {
    const isLast = index === names.length - 1;
    const segmentSeconds = isLast
      ? Math.max(1, Math.round((new Date(end).getTime() - cursor.getTime()) / 1000))
      : Math.max(1, Math.round(totalSeconds * ratios[index]));
    const segmentStart = new Date(cursor);
    const segmentEnd = isLast ? new Date(end) : new Date(cursor.getTime() + segmentSeconds * 1000);
    cursor = segmentEnd;

    return {
      startTimestamp: segmentStart,
      endTimestamp: segmentEnd,
      focusType,
    } satisfies FocusElement;
  });
}

function buildAppSegments(start: Date, end: Date) {
  const totalSeconds = secondsBetween(start, end);
  const activityNames = ["Docs", "Browser", "Notes", "Messages"];
  const ratios = [0.34, 0.26, 0.22, 0.18];
  let cursor = new Date(start);

  return activityNames.map((activityName, index) => {
    const isLast = index === activityNames.length - 1;
    const segmentSeconds = isLast
      ? Math.max(1, Math.round((new Date(end).getTime() - cursor.getTime()) / 1000))
      : Math.max(1, Math.round(totalSeconds * ratios[index]));
    const segmentStart = new Date(cursor);
    const segmentEnd = isLast ? new Date(end) : new Date(cursor.getTime() + segmentSeconds * 1000);
    cursor = segmentEnd;

    return {
      startTimestamp: segmentStart,
      endTimestamp: segmentEnd,
      activityName,
    } satisfies AppElement;
  });
}

function buildDemoSession(session: RawSessionData): SessionData {
  const focusElements = buildSegments(
    session.startTimestamp,
    session.endTimestamp,
    ["focus", "distracted", "break", "focus"],
    [0.42, 0.18, 0.12, 0.28]
  );
  const appElements = buildAppSegments(session.startTimestamp, session.endTimestamp);
  const totalSeconds = secondsBetween(session.startTimestamp, session.endTimestamp);

  return {
    userId: "demo",
    title: session.title,
    idealBreakTimeMinutes: session.idealBreakTimeMinutes,
    startTimestamp: session.startTimestamp,
    endTimestamp: session.endTimestamp,
    focusElements,
    appElements,
    idleTimeSeconds: Math.max(0, Math.round(totalSeconds * 0.16)),
  };
}

export default function SessionSummary({ session, onNext }: Props) {
  const demoSession = React.useMemo(() => buildDemoSession(session), [session]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fffaf6_0%,#fffdfb_45%,#f4efe9_100%)] px-6 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col items-center justify-center gap-4">
        <SessionSummaryCard session={demoSession} username="You" />

        <button
          onClick={onNext}
          className="rounded-full px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--p2p-accent)" }}
        >
          Next
        </button>
      </div>
    </div>
  );
}