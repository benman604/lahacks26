// Flow:
// 1. User starts a session and provides a title and ideal break time
// 2. During the session, every N seconds, a screenshot is taken and the following data is recorded: timestamp, focus type (focused, distracted, or break), website or app name, and whether the user is idle. A user is focused if on a focused website or app, distracted if not, and on a break if they intentionally started a break. isIdle is true if the screenshot looks basically the same as the previous one (indicating no activity, need to figure out prompt for this). websiteOrApp is the name of the website or app that the user is on, or "unknown" if it can't be determined.
// 3. When the session ends the raw RawSessionData is processed to create a SessionData object. The main difference is that instead of having raw screenshot data, we have focusElements and appElements. focusElements are contiguous periods of time where the user is in the same focus type. For appElements, the AI is first asked to come up with categories of apps that are roughly the same activity and then making contiguous periods of time where the user is in the same category of app/website. idleTimeSeconds is the total time during the session where the user is idle. The start and end timestamps of the session are also included in SessionData for easy access.
// 4. When the user is viewing their session summary card, the SessionData is processed to create a SessionSummary.

export type FocusElement = {
	startTimestamp: Date;
	endTimestamp: Date;
	focusType: FocusType;
}

export type AppElement = {
	startTimestamp: Date;
	endTimestamp: Date;
	activityName: string;
}

export type FocusType = "productive" | "supportive" | "neutral" | "distracted" | "break";

export type ScreenshotData = {
	timestamp: Date;
	focusType: FocusType;
	websiteOrApp: string;
	isIdle: boolean;
	description?: string;
	relevanceToSubject?: string;
	confidence?: number | null;
}

export type RawSessionData = {
	title: string;
	subject: string;
	idealBreakTimeMinutes: number;
	startTimestamp: Date;
	endTimestamp: Date;
	data: ScreenshotData[];
}

export type SessionData = {
	userId: string;
	title: string;
	idealBreakTimeMinutes: number;
	startTimestamp: Date;
	endTimestamp: Date;
	focusElements: FocusElement[];
	appElements: AppElement[];
	idleTimeSeconds: number;
}

// Define a function Adherence(average, ideal) that outputs a score from 0-100 based on the formula above

export type SessionSummary = {
	username: string;
	title: string;
	startTimestamp: Date;
	endTimestamp: Date;
	focusElements: FocusElement[];
	appElements: AppElement[];
	// Percentage of time spent focused during the session (focused time divided by total session time)
	productivityRate: number;
	// Adherence(average distraction recovery time, 0)
	distractionRecoveryTime: number;
	// Adherence(average break time, ideal break time)
	adherenceToBreakTime: number;
	// Use Shannon entropy over all activities in the session (divided by log(# of activities) to normalize) and then multiplied by 100 to get a score from 0-100
	chaosScore: number;
	// (Idle Time) / (Total Time)
	idleRatio: number;
}

