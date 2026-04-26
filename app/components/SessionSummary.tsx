"use client";

import React from "react";
import SessionSummaryCard from "./SessionSummaryCard";
import type { AppElement, FocusElement, RawSessionData, ScreenshotData, SessionData } from "../types";

type Props = {
  session: RawSessionData;
  onNext: () => void;
};

function secondsBetween(start: Date, end: Date) {
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
}

function toMs(value: Date) {
  return new Date(value).getTime();
}

function clampDate(value: Date, min: Date, max: Date) {
  const t = Math.min(Math.max(toMs(value), toMs(min)), toMs(max));
  return new Date(t);
}

function sortScreenshots(data: ScreenshotData[]) {
  return [...data]
    .map((entry) => ({
      ...entry,
      timestamp: new Date(entry.timestamp),
    }))
    .filter((entry) => !Number.isNaN(entry.timestamp.getTime()))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

function buildFocusElements(screenshots: ScreenshotData[], start: Date, end: Date): FocusElement[] {
  if (screenshots.length === 0) return [];

  const first = screenshots[0];
  let currentType = first.focusType;
  let segmentStart = new Date(start);
  const elements: FocusElement[] = [];

  for (let i = 1; i < screenshots.length; i++) {
    const screenshot = screenshots[i];
    const cutAt = clampDate(screenshot.timestamp, start, end);

    if (screenshot.focusType !== currentType) {
      if (toMs(cutAt) > toMs(segmentStart)) {
        elements.push({
          startTimestamp: segmentStart,
          endTimestamp: cutAt,
          focusType: currentType,
        });
      }
      segmentStart = cutAt;
      currentType = screenshot.focusType;
    }
  }

  if (toMs(end) > toMs(segmentStart)) {
    elements.push({
      startTimestamp: segmentStart,
      endTimestamp: new Date(end),
      focusType: currentType,
    });
  }

  return elements;
}

function normalizeActivityName(name: string) {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : "unknown";
}

function buildAppElements(screenshots: ScreenshotData[], start: Date, end: Date): AppElement[] {
  if (screenshots.length === 0) return [];

  const first = screenshots[0];
  let currentActivity = normalizeActivityName(first.websiteOrApp);
  let segmentStart = new Date(start);
  const elements: AppElement[] = [];

  for (let i = 1; i < screenshots.length; i++) {
    const screenshot = screenshots[i];
    const nextActivity = normalizeActivityName(screenshot.websiteOrApp);
    const cutAt = clampDate(screenshot.timestamp, start, end);

    if (nextActivity !== currentActivity) {
      if (toMs(cutAt) > toMs(segmentStart)) {
        elements.push({
          startTimestamp: segmentStart,
          endTimestamp: cutAt,
          activityName: currentActivity,
        });
      }
      segmentStart = cutAt;
      currentActivity = nextActivity;
    }
  }

  if (toMs(end) > toMs(segmentStart)) {
    elements.push({
      startTimestamp: segmentStart,
      endTimestamp: new Date(end),
      activityName: currentActivity,
    });
  }

  return elements;
}

function computeIdleTimeSeconds(screenshots: ScreenshotData[], sessionEnd: Date) {
  if (screenshots.length === 0) return 0;

  let idleSeconds = 0;
  for (let i = 0; i < screenshots.length; i++) {
    const current = screenshots[i];
    const next = i + 1 < screenshots.length ? screenshots[i + 1] : null;
    const startMs = toMs(current.timestamp);
    const endMs = next ? toMs(next.timestamp) : toMs(sessionEnd);
    if (current.isIdle && endMs > startMs) {
      idleSeconds += Math.round((endMs - startMs) / 1000);
    }
  }

  return Math.max(0, idleSeconds);
}

function buildSession(session: RawSessionData): SessionData {
  const start = new Date(session.startTimestamp);
  const end = new Date(session.endTimestamp);
  const screenshots = sortScreenshots(session.data)
    .map((entry) => ({
      ...entry,
      timestamp: clampDate(entry.timestamp, start, end),
    }))
    .filter((entry) => toMs(entry.timestamp) >= toMs(start) && toMs(entry.timestamp) <= toMs(end));

  const focusElements = buildFocusElements(screenshots, start, end);
  const appElements = buildAppElements(screenshots, start, end);
  const idleTimeSeconds = computeIdleTimeSeconds(screenshots, end);

  return {
    userId: "you",
    title: session.title,
    totalBreakTimeMinutes: session.totalBreakTimeMinutes,
    startTimestamp: start,
    endTimestamp: end,
    focusElements,
    appElements,
    idleTimeSeconds,
  };
}

export default function SessionSummary({ session, onNext }: Props) {
  const builtSession = React.useMemo(() => buildSession(session), [session]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fffaf6_0%,#fffdfb_45%,#f4efe9_100%)] px-6 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col items-center justify-center gap-4">
        <SessionSummaryCard session={builtSession} username="You" />

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