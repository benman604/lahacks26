type FocusElement = {
	startTimestamp: Date;
	endTimestamp: Date;
	focusType: "focus" | "distracted" | "break";
}

type AppElement = {
	startTimestamp: Date;
	endTimestamp: Date;
	activityName: string;
}

type ScreenshotData = {
	timestamp: Date;
	focusType: "focus" | "distracted" | "break";
	websiteOrApp: string;
	isIdle: boolean;
}

type RawSessionData = {
	title: string;
	idealBreakTimeMinutes: number;
	startTimestamp: Date;
	endTimestamp: Date;
	data: ScreenshotData[];
}

type SessionData = {
	userId: string;
	title: string;
	startTimestamp: Date;
	endTimestamp: Date;
	focusElements: FocusElement[];
	appElements: AppElement[];
	idleTimeSeconds: number;
}

// Define a function Adherence(average, ideal) that outputs a score from 0-100 based on the formula above

type SessionSummary = {
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

