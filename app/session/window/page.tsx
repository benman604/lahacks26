"use client";

import React, { useEffect, useRef, useState } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { availableMonitors, LogicalPosition, LogicalSize, currentMonitor } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";

const blockerLabels: string[] = [];

export default function SessionWindow() {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<number | null>(null);
  const [recordingEnabled, setRecordingEnabled] = useState(false);

  // screenshot helpers
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  async function enableRecording() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = await (navigator.mediaDevices as any).getDisplayMedia({ video: { cursor: "always" } });
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
      // eslint-disable-next-line no-console
      console.error("failed to enable recording", e);
    }

  }

  function toggleTimer() {
    if (running) stopTimer();
    else startTimer();
  }
  const [image, setImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [geminiResult, setGeminiResult] = useState<{ value: string; text: string } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    const unlistenTrigger = listen("trigger-blockers", async () => {
      await openBlockers();
    });

    const unlistenClose = listen("close-blockers", async () => {
      await closeBlockers();
    });

    startTimer();

    return () => {
      unlistenTrigger.then((un) => un()).catch(() => {});
      unlistenClose.then((un) => un()).catch(() => {});
      stopTimer();
      closeBlockers();
    };
  }, []);

  async function openBlockers() {
    let monitors = [] as any[];
    try {
      monitors = await availableMonitors();
    } catch (e) {
      const m = await currentMonitor();
      if (m) monitors = [m];
    }

    for (let i = 0; i < monitors.length; i++) {
      const m = monitors[i];
      const label = `blocker-${i}`;

      const existing = await WebviewWindow.getByLabel(label);
      if (existing) {
        await existing.setFocus();
        continue;
      }

      const blocker = new WebviewWindow(label, {
        url: "/session/gbtw",
        decorations: false,
        alwaysOnTop: true,
        resizable: false,
        transparent: true,
      });

      blocker.once("tauri://created", async () => {
        try {
          const scale = m.scaleFactor || 1;
          const pos = m.position ?? { x: 0, y: 0 };
          await blocker.setPosition(new LogicalPosition(pos.x / scale, pos.y / scale));
          await blocker.setSize(new LogicalSize(m.size.width / scale, m.size.height / scale));
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("failed to size blocker", e);
        }
      });

      blocker.once("tauri://error", (e) => {
        // eslint-disable-next-line no-console
        console.error("failed to create blocker", e);
      });

      blockerLabels.push(label);
    }
  }

  async function closeBlockers() {
    for (const label of blockerLabels.splice(0)) {
      const w = await WebviewWindow.getByLabel(label);
      if (w) {
        try {
          await w.close();
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("failed to close blocker", label, e);
        }
      }
    }
  }

  async function takeScreenshotAndSend() {
    try {
      // recording must be enabled first
      if (!streamRef.current) {
        throw new Error("Recording not enabled. Click 'Enable Recording' first.");
      }

      const v = videoRef.current!;
      if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
      const c = canvasRef.current!;
      c.width = v.videoWidth || window.innerWidth;
      c.height = v.videoHeight || window.innerHeight;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("no canvas context");
      ctx.drawImage(v, 0, 0, c.width, c.height);
      const dataUrl = c.toDataURL("image/png");

      // send to server
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });

      if (!res.ok) {
        const txt = await res.text();
        // eslint-disable-next-line no-console
        console.error("screenshot upload failed", res.status, txt);
      } else {
        // eslint-disable-next-line no-console
        console.log("screenshot uploaded");
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("takeScreenshotAndSend failed", e);
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

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      setImage({ base64, mimeType: file.type });
      setPreview(dataUrl);
      setGeminiResult(null);
    };
    reader.readAsDataURL(file);
  }

  async function analyzeImage() {
    if (!image) return;
    setAnalyzing(true);
    setGeminiResult(null);
    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: image.base64, mimeType: image.mimeType }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setGeminiResult(data);
    } catch (err) {
      setGeminiResult({ value: "–", text: String(err) });
    } finally {
      setAnalyzing(false);
    }
  }

  function toggleTimer() {
    if (running) stopTimer();
    else startTimer();
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

  return (
    <div className="p-4 w-full h-full flex flex-col gap-4 items-center justify-center">
      
			{(!recordingEnabled || !streamRef.current) && (
				<div>
					<h2>Please enable screen recording on all screens to start your session</h2>
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
						<h2 className="text-lg font-semibold">Session Controller</h2>
						<div className="mt-2 text-2xl">{formatTime(secondsLeft)}</div>
						<div className="mt-2 flex gap-2 items-center">
							<button onClick={toggleTimer} className="px-3 py-1 rounded bg-blue-600 text-white">
								{running ? "Pause" : "Play"}
							</button>
							<button
								onClick={enableRecording}
								disabled={recordingEnabled}
								className={`px-3 py-1 rounded ${
									recordingEnabled
										? "bg-green-600 text-white cursor-default"
										: "bg-purple-600 text-white hover:bg-purple-700"
								}`}
							>
								{recordingEnabled ? "✓ Recording" : "Enable Recording"}
							</button>
						</div>
					</div>
					<div className="flex gap-2">
						<button
							onClick={() => openBlockers()}
							className="px-3 py-1 rounded bg-red-600 text-white"
						>
							Test Blocking
						</button>
						<button onClick={takeScreenshotAndSend} className="px-3 py-1 rounded bg-blue-700 text-white">
							Test Screenshot
						</button>
						<button
							onClick={() => {
								stopTimer();
								closeBlockers();
							}}
							className="px-3 py-1 rounded bg-gray-700 text-white"
						>
							Stop Session
						</button>
					</div>
				</div>
			)}

		</div>
	);
}