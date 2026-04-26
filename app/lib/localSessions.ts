"use client";

import { invoke } from "@tauri-apps/api/core";

import type {
  AppTimelineSummarySegment,
  FocusTimelineSummarySegment,
  SessionData,
  SessionTimelineSummary,
} from "../types";
import { MOCK_SESSIONS } from "./mockSessions";
import { computeSessionMetrics, secondsBetween } from "./sessionStats";

const SESSIONS_UPDATED_EVENT = "p2p:sessions-updated";

function notifySessionsUpdated() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(SESSIONS_UPDATED_EVENT));
}

export function subscribeToSessionsUpdated(listener: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = () => listener();
  window.addEventListener(SESSIONS_UPDATED_EVENT, handler);

  return () => {
    window.removeEventListener(SESSIONS_UPDATED_EVENT, handler);
  };
}

type RawFocusElement = {
  startTimestamp: string;
  endTimestamp: string;
  focusType: "focus" | "distracted" | "break";
};

type RawAppElement = {
  startTimestamp: string;
  endTimestamp: string;
  activityName: string;
};

type RawSessionData = {
  userId: string;
  title: string;
  idealBreakTimeMinutes: number;
  startTimestamp: string;
  endTimestamp: string;
  focusElements?: RawFocusElement[];
  appElements?: RawAppElement[];
  idleTimeSeconds: number;
  summaryMetrics?: {
    productivityRate: number;
    distractionRecoveryTime: number;
    adherenceToBreakTime: number;
    flowScore?: number;
    chaosScore?: number;
    idleRatio: number;
  };
  timelineSummary?: {
    focusSegments: Array<{
      focusType: "focus" | "distracted" | "break";
      widthPct: number;
    }>;
    appSegments: Array<{
      activityName: string;
      widthPct: number;
    }>;
  };
};

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function clampPct(value: number) {
  return Math.max(0, Math.min(100, value));
}

function buildTimelineSummary(session: SessionData): SessionTimelineSummary {
  const totalSeconds = secondsBetween(session.startTimestamp, session.endTimestamp);

  const focusSegments: FocusTimelineSummarySegment[] = session.focusElements
    .map((el) => {
      const duration = secondsBetween(el.startTimestamp, el.endTimestamp);
      const widthPct = totalSeconds > 0 ? (duration / totalSeconds) * 100 : 0;

      return {
        focusType: el.focusType,
        widthPct: clampPct(widthPct),
      };
    })
    .filter((segment) => segment.widthPct > 0);

  const appSegments: AppTimelineSummarySegment[] = session.appElements
    .map((el) => {
      const duration = secondsBetween(el.startTimestamp, el.endTimestamp);
      const widthPct = totalSeconds > 0 ? (duration / totalSeconds) * 100 : 0;

      return {
        activityName: el.activityName,
        widthPct: clampPct(widthPct),
      };
    })
    .filter((segment) => segment.widthPct > 0);

  return {
    focusSegments,
    appSegments,
  };
}

function toRawSessionSummary(session: SessionData): RawSessionData {
  const summaryMetrics = computeSessionMetrics(session);
  const timelineSummary =
    session.timelineSummary ??
    (session.focusElements.length > 0 || session.appElements.length > 0
      ? buildTimelineSummary(session)
      : { focusSegments: [], appSegments: [] });

  return {
    userId: session.userId,
    title: session.title,
    idealBreakTimeMinutes: session.idealBreakTimeMinutes,
    startTimestamp: session.startTimestamp.toISOString(),
    endTimestamp: session.endTimestamp.toISOString(),
    idleTimeSeconds: Math.round(
      (summaryMetrics.idleRatio / 100) * secondsBetween(session.startTimestamp, session.endTimestamp)
    ),
    summaryMetrics,
    timelineSummary,
  };
}

function toFullRawSession(session: SessionData): RawSessionData {
  return {
    userId: session.userId,
    title: session.title,
    idealBreakTimeMinutes: session.idealBreakTimeMinutes,
    startTimestamp: session.startTimestamp.toISOString(),
    endTimestamp: session.endTimestamp.toISOString(),
    focusElements: session.focusElements.map((el) => ({
      startTimestamp: el.startTimestamp.toISOString(),
      endTimestamp: el.endTimestamp.toISOString(),
      focusType: el.focusType,
    })),
    appElements: session.appElements.map((el) => ({
      startTimestamp: el.startTimestamp.toISOString(),
      endTimestamp: el.endTimestamp.toISOString(),
      activityName: el.activityName,
    })),
    idleTimeSeconds: session.idleTimeSeconds,
  };
}

function hydrateSession(raw: RawSessionData): SessionData {
  const focusElements = (raw.focusElements ?? []).map((el) => ({
    startTimestamp: new Date(el.startTimestamp),
    endTimestamp: new Date(el.endTimestamp),
    focusType: el.focusType,
  }));

  const appElements = (raw.appElements ?? []).map((el) => ({
    startTimestamp: new Date(el.startTimestamp),
    endTimestamp: new Date(el.endTimestamp),
    activityName: el.activityName,
  }));

  const timelineSummary: SessionTimelineSummary | undefined = raw.timelineSummary
    ? {
        focusSegments: raw.timelineSummary.focusSegments.map((segment) => ({
          focusType: segment.focusType,
          widthPct: clampPct(segment.widthPct),
        })),
        appSegments: raw.timelineSummary.appSegments.map((segment) => ({
          activityName: segment.activityName,
          widthPct: clampPct(segment.widthPct),
        })),
      }
    : undefined;

  const summaryMetrics = raw.summaryMetrics
    ? {
        productivityRate: raw.summaryMetrics.productivityRate,
        distractionRecoveryTime: raw.summaryMetrics.distractionRecoveryTime,
        adherenceToBreakTime: raw.summaryMetrics.adherenceToBreakTime,
        flowScore:
          typeof raw.summaryMetrics.flowScore === "number"
            ? raw.summaryMetrics.flowScore
            : 100 - (raw.summaryMetrics.chaosScore ?? 0),
        idleRatio: raw.summaryMetrics.idleRatio,
      }
    : undefined;

  return {
    userId: raw.userId,
    title: raw.title,
    idealBreakTimeMinutes: raw.idealBreakTimeMinutes,
    startTimestamp: new Date(raw.startTimestamp),
    endTimestamp: new Date(raw.endTimestamp),
    focusElements,
    appElements,
    idleTimeSeconds: raw.idleTimeSeconds,
    summaryMetrics,
    timelineSummary,
  };
}

function isSummaryOnly(raw: RawSessionData) {
  return (
    Boolean(raw.summaryMetrics) &&
    Boolean(raw.timelineSummary) &&
    !raw.focusElements &&
    !raw.appElements
  );
}

function compactRawSession(raw: RawSessionData): RawSessionData {
  const hydrated = hydrateSession(raw);
  if (hydrated.summaryMetrics) {
    return {
      userId: hydrated.userId,
      title: hydrated.title,
      idealBreakTimeMinutes: hydrated.idealBreakTimeMinutes,
      startTimestamp: hydrated.startTimestamp.toISOString(),
      endTimestamp: hydrated.endTimestamp.toISOString(),
      idleTimeSeconds: hydrated.idleTimeSeconds,
      summaryMetrics: hydrated.summaryMetrics,
      timelineSummary: hydrated.timelineSummary,
    };
  }

  if (raw.focusElements && raw.appElements) {
    return toRawSessionSummary(hydrated);
  }

  const fallback = toRawSessionSummary(hydrated);
  return fallback;
}

export async function loadLocalSessions(): Promise<SessionData[]> {
  if (!isTauriRuntime()) {
    return MOCK_SESSIONS;
  }

  try {
    let stored = await invoke<RawSessionData[]>("list_sessions");

    if (stored.length === 0) {
      const seed = MOCK_SESSIONS.map(toRawSessionSummary);
      await invoke("replace_sessions", { sessions: seed });
      notifySessionsUpdated();
      stored = await invoke<RawSessionData[]>("list_sessions");
    } else if (stored.some((session) => !isSummaryOnly(session))) {
      const compact = stored.map(compactRawSession);
      await invoke("replace_sessions", { sessions: compact });
      notifySessionsUpdated();
      stored = await invoke<RawSessionData[]>("list_sessions");
    }

    return stored.map(hydrateSession);
  } catch (error) {
    console.error("Failed loading local sessions", error);
    return MOCK_SESSIONS;
  }
}

export async function appendLocalSession(session: SessionData): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  const summaryPayload = toRawSessionSummary(session);
  await invoke("append_session", { session: summaryPayload });
  notifySessionsUpdated();
}

export function toRawSessionForDebug(session: SessionData): RawSessionData {
  return toFullRawSession(session);
}
