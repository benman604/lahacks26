import type { SessionData, SessionMetrics, SessionStats } from "../types";

export function secondsBetween(start: Date, end: Date) {
  return Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 1000);
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function sigmoid(x: number, center: number, a: number): number {
  return 1 / (1 + Math.exp(a * (x - center)));
}

function standardSigmoid(z: number): number {
  return sigmoid(-z, 0, 1);
}

function calculateDistractionScore(average: number, beta: number = 30): number {
  const alpha = 10 / beta;

  if (average >= 0 && average <= beta) {
    const z = -alpha * (average - 0.5 * beta);
    return 0.5 * standardSigmoid(z) + 0.5;
  }

  if (average > beta) {
    const z = -alpha * (average - 1.5 * beta);
    return 0.5 * standardSigmoid(z);
  }

  return 0;
}

function adherence(average: number, ideal: number): number {
  const alpha = 10 / ideal;
  if (average < ideal) return 1;

  if (average >= ideal && average <= 2 * ideal) {
    return 0.5 * sigmoid(average, 1.5 * ideal, alpha) + 0.5;
  }

  if (average > 2 * ideal) {
    return 0.5 * sigmoid(average, 2.5 * ideal, alpha);
  }

  return 0;
}

function computeAverageDurationMinutes<T extends { startTimestamp: Date; endTimestamp: Date }>(
  elements: T[]
) {
  if (elements.length === 0) return 0;

  const totalSeconds = elements.reduce(
    (sum, el) => sum + secondsBetween(el.startTimestamp, el.endTimestamp),
    0
  );

  return totalSeconds / elements.length / 60;
}

function calculateFlowScore(
  focusElements: SessionData["focusElements"],
  totalSessionTime: number
): number {
  const MIN_DEEP_WORK_THRESHOLD = 5 * 60;
  const MAX_ALLOWED_SWITCHES_PER_HOUR = 10;

  if (totalSessionTime <= 0) return 0;

  const deepBlocks = focusElements.filter((el) => {
    if (el.focusType !== "focus") return false;
    const duration = secondsBetween(el.startTimestamp, el.endTimestamp);
    return duration >= MIN_DEEP_WORK_THRESHOLD;
  });

  const deepDuration = deepBlocks.reduce(
    (sum, block) => sum + secondsBetween(block.startTimestamp, block.endTimestamp),
    0
  );
  const deepRatio = deepDuration / totalSessionTime;

  const transitions = Math.max(0, focusElements.length - 1);
  const maxAllowedSwitches = Math.max(
    1,
    Math.round((totalSessionTime / 3600) * MAX_ALLOWED_SWITCHES_PER_HOUR)
  );
  const transitionFactor = Math.max(0, 1 - transitions / maxAllowedSwitches);

  return Math.round(clampPercent(deepRatio * transitionFactor * 100));
}

export function formatWeekRange(start: Date, end: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function getWeekBounds(referenceDate: Date) {
  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());

  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export function getCurrentWeekBounds(referenceDate: Date = new Date()) {
  return getWeekBounds(referenceDate);
}

export function filterSessionsForCurrentWeek(
  sessionList: SessionData[],
  referenceDate: Date = new Date()
) {
  const { start, end } = getWeekBounds(referenceDate);

  return sessionList.filter((session) => {
    const t = session.startTimestamp.getTime();
    return t >= start.getTime() && t <= end.getTime();
  });
}

export function computeAverageMetrics(sessionList: SessionData[]) {
  const metricsTotals = sessionList.reduce(
    (totals, session) => {
      const metrics = computeSessionMetrics(session);
      const activityScore = 100 - metrics.idleRatio;

      return {
        focus: totals.focus + metrics.productivityRate,
        recovery: totals.recovery + metrics.distractionRecoveryTime,
        discipline: totals.discipline + metrics.adherenceToBreakTime,
        flow: totals.flow + metrics.flowScore,
        activity: totals.activity + activityScore,
      };
    },
    { focus: 0, recovery: 0, discipline: 0, flow: 0, activity: 0 }
  );

  const divisor = Math.max(1, sessionList.length);

  return {
    focus: Math.round(metricsTotals.focus / divisor),
    recovery: Math.round(metricsTotals.recovery / divisor),
    discipline: Math.round(metricsTotals.discipline / divisor),
    flow: Math.round(metricsTotals.flow / divisor),
    activity: Math.round(metricsTotals.activity / divisor),
  };
}

export const calculateProductivityScore = (stats: SessionStats): number => {
  const normalizedIdleRatio = stats.idleRatio > 1 ? stats.idleRatio / 100 : stats.idleRatio;
  const activeScore = 100 - normalizedIdleRatio * 100;

  const weightedScore =
    stats.productivityRate * 0.4 +
    stats.distractionRecoveryTime * 0.2 +
    stats.adherenceToBreakTime * 0.15 +
    stats.flowScore * 0.15 +
    activeScore * 0.1;

  return Math.round(Math.min(100, Math.max(0, weightedScore)));
};

export function computeSessionMetrics(session: SessionData): SessionMetrics {
  const totalSeconds = secondsBetween(session.startTimestamp, session.endTimestamp);

  if (session.summaryMetrics) {
    const persisted = session.summaryMetrics as SessionMetrics & { chaosScore?: number };
    if (typeof persisted.flowScore === "number") {
      return persisted;
    }

    if (typeof persisted.chaosScore === "number") {
      return {
        ...persisted,
        flowScore: 100 - persisted.chaosScore,
      };
    }
  }

  const focusSeconds = session.focusElements
    .filter((el) => el.focusType === "focus")
    .reduce((sum, el) => sum + secondsBetween(el.startTimestamp, el.endTimestamp), 0);

  const distractionElements = session.focusElements.filter(
    (el) => el.focusType === "distracted"
  );

  const breakElements = session.focusElements.filter((el) => el.focusType === "break");

  const averageDistractionMinutes = computeAverageDurationMinutes(distractionElements);
  const averageBreakMinutes = computeAverageDurationMinutes(breakElements);
  return {
    productivityRate: totalSeconds > 0 ? clampPercent((focusSeconds / totalSeconds) * 100) : 0,
    distractionRecoveryTime: calculateDistractionScore(averageDistractionMinutes, 30) * 100,
    adherenceToBreakTime: adherence(averageBreakMinutes, session.idealBreakTimeMinutes) * 100,
    flowScore: calculateFlowScore(session.focusElements, totalSeconds),
    idleRatio: totalSeconds > 0 ? clampPercent((session.idleTimeSeconds / totalSeconds) * 100) : 0,
  };
}

function extractSubjectFromTitle(title: string) {
  const parts = title.split("-");
  return parts.length > 1 ? parts[parts.length - 1].trim() : title.trim();
}

function formatIsoDay(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function computeSessionDayStreak(sessionList: SessionData[]) {
  if (sessionList.length === 0) return 0;

  const uniqueDayStamps = [...new Set(sessionList.map((s) => formatIsoDay(s.startTimestamp)))]
    .map((day) => new Date(`${day}T00:00:00`).getTime())
    .sort((a, b) => a - b);

  let longest = 1;
  let current = 1;
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 1; i < uniqueDayStamps.length; i += 1) {
    if (uniqueDayStamps[i] - uniqueDayStamps[i - 1] === dayMs) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
}

export function computeLifetimeStats(sessionList: SessionData[]) {
  const completedSessions = sessionList.length;

  const focusHours =
    sessionList.reduce((sum, session) => {
      const metrics = computeSessionMetrics(session);
      const totalSeconds = secondsBetween(session.startTimestamp, session.endTimestamp);
      const focusSeconds = totalSeconds * (metrics.productivityRate / 100);

      return sum + focusSeconds;
    }, 0) / 3600;

  const subjectCounts = new Map<string, number>();
  for (const session of sessionList) {
    const subject = extractSubjectFromTitle(session.title);
    subjectCounts.set(subject, (subjectCounts.get(subject) ?? 0) + 1);
  }

  let mostStudied = "-";
  let bestCount = 0;
  for (const [subject, count] of subjectCounts) {
    if (count > bestCount) {
      mostStudied = subject;
      bestCount = count;
    }
  }

  const bestFocusStreakDays = computeSessionDayStreak(sessionList);
  const averageProductiveScore = Math.round(
    sessionList.reduce((sum, session) => {
      const metrics = computeSessionMetrics(session);
      return sum + calculateProductivityScore(metrics);
    }, 0) / Math.max(1, sessionList.length)
  );

  return {
    completedSessions: `${completedSessions}`,
    averageProductiveScore: `${averageProductiveScore}%`,
    focusHours: `${focusHours.toFixed(1)}h`,
    mostStudied,
    bestFocusStreak: `${bestFocusStreakDays} days`,
  };
}
