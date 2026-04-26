"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { RawSessionData, ScreenshotData } from "@/app/types";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  LogicalPosition,
  LogicalSize,
  currentMonitor,
} from "@tauri-apps/api/window";
import { emit, listen } from "@tauri-apps/api/event";

const blockerLabels: string[] = [];
const MAX_CONTEXT_SIZE = 5;
const ANALYSIS_INTERVAL_MS = 100 * 1000; // analyze every 40 seconds

type RawSessionDataWire = {
  title?: unknown;
  subject?: unknown;
  totalBreakTimeMinutes?: unknown;
  startTimestamp?: unknown;
  endTimestamp?: unknown;
  data?: unknown;
};

function toPositiveNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const n = Number.parseFloat(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback;
}

function toDate(value: unknown, fallback: Date) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return fallback;
}

export default function SessionWindow() {
  const [rawSessionData, setRawSessionData] = useState<RawSessionData | null>(null);
  const [recordingError, setRecordingError] = useState<string>("");

  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<number | null>(null);
  const [recordingEnabled, setRecordingEnabled] = useState(false);

  // break timer state
  const [onBreak, setOnBreak] = useState(false);
  const [breakSecondsLeft, setBreakSecondsLeft] = useState<number>(0);
  const breakTimerRef = useRef<number | null>(null);
  const breakInitializedRef = useRef(false);

  // stable refs so static event handlers always call the latest version
  const rawSessionDataRef = useRef<RawSessionData | null>(null);
  const analyzeCurrentScreenshotRef = useRef<() => Promise<void>>(async () => {});

  // screenshot helpers
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  async function enableRecording() {
    try {
      setRecordingError("");
      const getDisplayMedia = navigator.mediaDevices?.getDisplayMedia?.bind(navigator.mediaDevices);
      if (!getDisplayMedia) {
        setRecordingError(
          "Screen recording is not supported in this environment (navigator.mediaDevices.getDisplayMedia unavailable)."
        );
        return;
      }

      const s = await getDisplayMedia({ video: { cursor: "always" } } as DisplayMediaStreamOptions);
      streamRef.current = s as MediaStream;
      const v = document.createElement("video");
      v.style.display = "none";
      v.srcObject = streamRef.current;
      v.playsInline = true;
      document.body.appendChild(v);
      videoRef.current = v;
      await new Promise<void>((resolve) => {
        const onLoaded = () => resolve();
        v.addEventListener("loadedmetadata", onLoaded, { once: true });
      });
      await v.play();
      setRecordingEnabled(true);
    } catch (e) {
      console.error("failed to enable recording", e);
      setRecordingError("Failed to enable screen recording. Check browser/OS permissions and try again.");
    }

  }

  const [, setHistory] = useState<ScreenshotData[]>([]);
  const historyRef = useRef<ScreenshotData[]>([]);

	function appendHistory(entry: ScreenshotData) {
		setHistory((prev) => {
			const next = [...prev, entry];
			historyRef.current = next; // 🔑 keep ref in sync immediately
			return next;
		});
	}

  useEffect(() => {
    const unlistenPromise = listen<RawSessionDataWire>("session-data", (event) => {
      const incoming = event.payload;
      if (!incoming) return;

      const now = new Date();
      const startTimestamp = toDate(incoming.startTimestamp, now);
      const endTimestamp = toDate(incoming.endTimestamp, now);

      setRawSessionData({
        title: typeof incoming.title === "string" ? incoming.title : "Session",
        subject: typeof incoming.subject === "string" ? incoming.subject : "",
        totalBreakTimeMinutes: toPositiveNumber(incoming.totalBreakTimeMinutes, 10),
        startTimestamp,
        endTimestamp,
        data: Array.isArray(incoming.data) ? (incoming.data as ScreenshotData[]) : [],
      });
    });

    // let the homepage know we're mounted and ready to receive session data
    emit("session-window-ready").catch(() => {});

    return () => {
      unlistenPromise.then((un) => un()).catch(() => {});
    };
  }, []);

  const analyzeCurrentScreenshot = useCallback(async () => {
    try {
      // don't analyze if on a break
      if (onBreak) return;
      // ensure recording active and video present
      if (!streamRef.current || !videoRef.current) throw new Error("Recording not enabled");
      if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
      const v = videoRef.current!;
      const c = canvasRef.current!;
      c.width = v.videoWidth || window.innerWidth;
      c.height = v.videoHeight || window.innerHeight;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("no canvas context");
      ctx.drawImage(v, 0, 0, c.width, c.height);
      const dataUrl = c.toDataURL("image/png");

      const toSend = historyRef.current.slice(-MAX_CONTEXT_SIZE);
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl, history: toSend, subject: rawSessionData?.subject ?? "" }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        console.error("gemini analyze failed", data);
        return;
      }

      // append to history as ScreenshotData
      const entry: ScreenshotData = {
        timestamp: new Date(),
        focusType: data.focusType,
        websiteOrApp: data.websiteOrApp,
        isIdle: data.isIdle,
        description: data.description,
      };

      appendHistory(entry);

      if (data.focusType === "distracted") {
        const instruction =
          typeof data.instructOffDistraction === "string" ? data.instructOffDistraction : undefined;
        await openBlockers(instruction);
      }
    } catch (e) {
      console.error("analyzeCurrentScreenshot failed", e);
    }
  }, [rawSessionData?.subject, onBreak]);

  // keep refs in sync so static event handlers always have the latest values
  useEffect(() => { rawSessionDataRef.current = rawSessionData; }, [rawSessionData]);
  useEffect(() => { analyzeCurrentScreenshotRef.current = analyzeCurrentScreenshot; }, [analyzeCurrentScreenshot]);

  // initialize break budget once when session data first arrives
  useEffect(() => {
    if (rawSessionData && !breakInitializedRef.current) {
      setBreakSecondsLeft(rawSessionData.totalBreakTimeMinutes * 60);
      breakInitializedRef.current = true;
    }
  }, [rawSessionData]);

  // when break timer hits 0, end the break and re-block
  useEffect(() => {
    if (onBreak && breakSecondsLeft <= 0) {
      endBreak();
      openBlockers();
    }
  }, [breakSecondsLeft, onBreak]);

  useEffect(() => {
    const unlistenTrigger = listen("trigger-blockers", async () => {
      await openBlockers();
    });

    const unlistenClose = listen("close-blockers", async () => {
      await closeBlockers();
    });

    const unlistenAllowBreak = listen("allow-break", async () => {
      await closeBlockers();
      stopTimer();
      setOnBreak(true);
      setHistory((prev) => {
        const next = [...prev, { timestamp: new Date(), focusType: "break" as const, websiteOrApp: "Break", isIdle: false }];
        historyRef.current = next;
        return next;
      });
      if (breakTimerRef.current) clearInterval(breakTimerRef.current);
      breakTimerRef.current = window.setInterval(() => {
        setBreakSecondsLeft((s) => s - 1);
      }, 1000);
    });

    const unlistenDismissRetry = listen("dismiss-blockers-retry", async () => {
      await closeBlockers();
      setTimeout(() => { analyzeCurrentScreenshotRef.current(); }, 5000);
    });

    startTimer();

    return () => {
      unlistenTrigger.then((un) => un()).catch(() => {});
      unlistenClose.then((un) => un()).catch(() => {});
      unlistenAllowBreak.then((un) => un()).catch(() => {});
      unlistenDismissRetry.then((un) => un()).catch(() => {});
      stopTimer();
      if (breakTimerRef.current) clearInterval(breakTimerRef.current);
      closeBlockers();
    };
  }, []);

	
	useEffect(() => {
		if (!recordingEnabled) return;

		// start analysing screenshots at intervals
		const intervalId = window.setInterval(async () => {
			await analyzeCurrentScreenshot();
		}, ANALYSIS_INTERVAL_MS);

		return () => {
			window.clearInterval(intervalId);
		}
  }, [recordingEnabled, analyzeCurrentScreenshot]);

  async function openBlockers(instruction?: string) {
    const label = "blocker";
    const existing = await WebviewWindow.getByLabel(label);
    if (existing) {
      // Recreate blocker when instruction changes so gbtw receives the latest URL param.
      if (instruction) {
        try {
          await existing.close();
        } catch (e) {
          console.error("failed to recreate blocker", e);
          await existing.setFocus();
          return;
        }
        const idx = blockerLabels.indexOf(label);
        if (idx >= 0) blockerLabels.splice(idx, 1);
      } else {
        await existing.setFocus();
        return;
      }
    }

    const monitor = await currentMonitor();
    const blockerUrl = instruction
      ? `/session/gbtw?instruction=${encodeURIComponent(instruction)}`
      : "/session/gbtw";
    const blocker = new WebviewWindow(label, {
      url: blockerUrl,
      decorations: false,
      alwaysOnTop: true,
      resizable: false,
      transparent: true,
    });

    blocker.once("tauri://created", async () => {
      try {
        if (!monitor) return;
        const scale = monitor.scaleFactor || 1;
        const pos = monitor.position ?? { x: 0, y: 0 };
        await blocker.setPosition(new LogicalPosition(pos.x / scale, pos.y / scale));
        await blocker.setSize(new LogicalSize(monitor.size.width / scale, monitor.size.height / scale));
      } catch (e) {
        console.error("failed to size blocker", e);
      }
    });

    blocker.once("tauri://error", (e) => {
      console.error("failed to create blocker", e);
    });

    blockerLabels.push(label);
  }

  async function closeBlockers() {
    for (const label of blockerLabels.splice(0)) {
      const w = await WebviewWindow.getByLabel(label);
      if (w) {
        try {
          await w.close();
        } catch (e) {
          console.error("failed to close blocker", label, e);
        }
      }
    }
  }

  // count-up timer
  function startTimer() {
    if (timerRef.current) return;
    setRunning(true);
    timerRef.current = window.setInterval(() => {
      setSecondsLeft((s) => s + 1);
    }, 1000);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRunning(false);
  }

  function toggleTimer() {
    if (running) stopTimer();
    else startTimer();
  }

  function startBreak() {
    stopTimer();
    setOnBreak(true);
    appendHistory({ timestamp: new Date(), focusType: "break", websiteOrApp: "Break", isIdle: false });
    if (breakTimerRef.current) clearInterval(breakTimerRef.current);
    breakTimerRef.current = window.setInterval(() => {
      setBreakSecondsLeft((s) => s - 1);
    }, 1000);
  }

  function endBreak() {
    if (breakTimerRef.current) {
      clearInterval(breakTimerRef.current);
      breakTimerRef.current = null;
    }
    setOnBreak(false);
    appendHistory({ timestamp: new Date(), focusType: "break", websiteOrApp: "Break", isIdle: false });
    // breakSecondsLeft is intentionally NOT reset — preserves remaining balance
    startTimer();
  }

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(sec % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  }

  async function endSession() {
    if (!rawSessionData) return;

    const sessionEndPayload: RawSessionData = {
      ...rawSessionData,
      endTimestamp: new Date(),
      data: historyRef.current.slice(),
    };

    await emit("SessionEnd", sessionEndPayload);

    stopTimer();
    if (breakTimerRef.current) {
      clearInterval(breakTimerRef.current);
      breakTimerRef.current = null;
    }
    await closeBlockers();

    const homepage = await WebviewWindow.getByLabel("main");
    if (homepage) {
      await homepage.setFocus();
    }

    const sessionWindow = await WebviewWindow.getByLabel("session-window");
    if (sessionWindow) {
      await sessionWindow.close();
    }
  }

  return (
    <div className="p-4 w-full h-full flex flex-col gap-4 items-center justify-center">
      
			{(!recordingEnabled || !streamRef.current) && (
				<div>
					<h2>Please enable screen recording on all screens to start your session</h2>
          {recordingError && (
            <p className="mt-2 text-sm text-red-600">{recordingError}</p>
          )}
					<button
						onClick={enableRecording}
						className="px-3 py-1 rounded bg-purple-600 text-white hover:bg-purple-700"
					>
						Enable Recording
					</button>
				</div>
			)}

			{(recordingEnabled || streamRef.current) && (
				<div>
					<div className="flex flex-col items-center">
						<h2 className="text-lg font-semibold">{rawSessionData?.title || "Session Controller"}</h2>
					<div className="mt-2 text-2xl">{onBreak ? formatTime(Math.max(breakSecondsLeft, 0)) : formatTime(secondsLeft)}</div>
					{onBreak && breakSecondsLeft < 0 && (
						<div className="mt-1 text-sm text-orange-600">Break time exceeded by {formatTime(Math.abs(breakSecondsLeft))}</div>
					)}
					{!onBreak && (
						<div className="mt-1 text-xs text-gray-500">Break remaining: {formatTime(Math.max(breakSecondsLeft, 0))}</div>
					)}
					<div className="mt-2 flex gap-2 items-center">
						{!onBreak && (
							<button onClick={startBreak} className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700">
								Take a break
							</button>
						)}
							{onBreak && (
								<>
									<button onClick={endBreak} className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700">
										End break
									</button>
									<button onClick={() => { endBreak(); openBlockers(); }} className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600">
										Re-block
									</button>
								</>
							)}

              <button onClick={endSession} className="px-3 py-1 rounded bg-gray-600 text-white">
                End Session
              </button>

							{/* <button
								onClick={enableRecording}
								disabled={recordingEnabled}
								className={`px-3 py-1 rounded ${
									recordingEnabled
										? "bg-green-600 text-white cursor-default"
										: "bg-purple-600 text-white hover:bg-purple-700"
								}`}
							>
								{recordingEnabled ? "✓ Recording" : "Enable Recording"}
							</button> */}
						</div>
					</div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => openBlockers()}
              className="px-3 py-1 rounded bg-red-600 text-white"
            >
              Test Blocking
            </button>
            <button onClick={analyzeCurrentScreenshot} className="px-3 py-1 rounded bg-blue-700 text-white">
              Test Screenshot
            </button>
					</div>
				</div>
			)}

		</div>
	);
}