import type { SessionData, SessionStats, SessionSummary } from "../types";

function sigmoid(x: number, center: number, a: number): number {
	return 1 / (1 + Math.exp(a * (x - center)));
}

function adherence(average: number, ideal: number): number {
	if (ideal <= 0) return 0;

	const alpha: number = 10 / ideal;
	if (average < ideal) return 1;

	if (average >= ideal && average <= 2 * ideal) {
		return 0.5 * sigmoid(average, 1.5 * ideal, alpha) + 0.5;
	}

	if (average > 2 * ideal) {
		return 0.5 * sigmoid(average, 2.5 * ideal, alpha);
	}

	return 0;
}

export function secondsBetween(start: Date, end: Date) {
	return Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 1000);
}

export function clampPercent(value: number) {
	return Math.max(0, Math.min(100, value));
}

function computeAverageDurationMinutes<T extends { startTimestamp: Date; endTimestamp: Date }>(
	elements: T[],
) {
	if (elements.length === 0) return 0;

	const totalSeconds = elements.reduce(
		(sum, el) => sum + secondsBetween(el.startTimestamp, el.endTimestamp),
		0,
	);

	return totalSeconds / elements.length / 60;
}

function calculateFlowScore(
	focusElements: SessionData["focusElements"],
	totalSessionTime: number,
) {
	const MIN_DEEP_WORK_THRESHOLD = 5 * 60;
	const MAX_ALLOWED_SWITCHES_PER_HOUR = 10;

	if (totalSessionTime <= 0) return 0;

	const deepBlocks = focusElements.filter((el) => {
		if (el.focusType !== "productive" && el.focusType !== "supportive") return false;
		return secondsBetween(el.startTimestamp, el.endTimestamp) >= MIN_DEEP_WORK_THRESHOLD;
	});

	const deepDuration = deepBlocks.reduce(
		(sum, block) => sum + secondsBetween(block.startTimestamp, block.endTimestamp),
		0,
	);
	const deepRatio = deepDuration / totalSessionTime;

	const transitions = Math.max(0, focusElements.length - 1);
	const maxAllowedSwitches = Math.max(
		1,
		Math.round((totalSessionTime / 3600) * MAX_ALLOWED_SWITCHES_PER_HOUR),
	);
	const transitionFactor = Math.max(0, 1 - transitions / maxAllowedSwitches);

	return Math.round(clampPercent(deepRatio * transitionFactor * 100));
}

export function computeSessionSummary(session: SessionData): SessionSummary {
	const totalSeconds = secondsBetween(session.startTimestamp, session.endTimestamp);

	const focusSeconds = session.focusElements
		.filter((el) => el.focusType === "productive" || el.focusType === "supportive")
		.reduce((sum, el) => sum + secondsBetween(el.startTimestamp, el.endTimestamp), 0);

	const breakElements = session.focusElements.filter((el) => el.focusType === "break");
	const averageBreakMinutes = computeAverageDurationMinutes(breakElements);

	return {
		username: "You",
		title: session.title,
		startTimestamp: session.startTimestamp,
		endTimestamp: session.endTimestamp,
		focusElements: session.focusElements,
		appElements: session.appElements,
		productivityRate: totalSeconds > 0 ? clampPercent((focusSeconds / totalSeconds) * 100) : 0,
		distractionRecoveryTime: 0,
		adherenceToBreakTime: adherence(averageBreakMinutes, session.totalBreakTimeMinutes) * 100,
		flowScore: calculateFlowScore(session.focusElements, totalSeconds),
		idleRatio:
			totalSeconds > 0 ? clampPercent((session.idleTimeSeconds / totalSeconds) * 100) : 0,
	};
}

export function computeProductivityScore(stats: SessionStats): number {
	const normalizedIdleRatio = stats.idleRatio > 1 ? stats.idleRatio / 100 : stats.idleRatio;
	const activeScore = 100 - normalizedIdleRatio * 100;

	const weightedScore =
		stats.productivityRate * 0.4 +
		stats.distractionRecoveryTime * 0.2 +
		stats.adherenceToBreakTime * 0.15 +
		stats.flowScore * 0.15 +
		activeScore * 0.1;

	return Math.round(Math.min(100, Math.max(0, weightedScore)));
}

function formatIsoDay(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}


function computeSessionDayStreak(sessionList: SessionData[]) {
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
      const metrics = computeSessionSummary(session);
      const totalSeconds = secondsBetween(session.startTimestamp, session.endTimestamp);
      const focusSeconds = totalSeconds * (metrics.productivityRate / 100);

      return sum + focusSeconds;
    }, 0) / 3600;

  const bestFocusStreakDays = computeSessionDayStreak(sessionList);
  const averageProductiveScore = Math.round(
    sessionList.reduce((sum, session) => {
      const metrics = computeSessionSummary(session);
      return sum + computeProductivityScore(metrics);
    }, 0) / Math.max(1, sessionList.length)
  );

  return {
    completedSessions: `${completedSessions}`,
    averageProductiveScore: `${averageProductiveScore}%`,
    focusHours: `${focusHours.toFixed(1)}h`,
    // mostStudied,
    bestFocusStreak: `${bestFocusStreakDays} days`,
  };
}

export function computeAverageMetrics(sessionList: SessionData[]) {
  const metricsTotals = sessionList.reduce(
    (totals, session) => {
      const metrics = computeSessionSummary(session);
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


