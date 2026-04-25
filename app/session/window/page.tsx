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

  const [image, setImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [geminiResult, setGeminiResult] = useState<{ value: string; text: string } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    const unlistenPromise = listen("trigger-blockers", async () => {
      await openBlockers();
    });

    return () => {
      unlistenPromise.then((un) => un()).catch(() => {});
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

  function startTimer(seconds: number) {
    if (timerRef.current) return;
    setSecondsLeft(seconds);
    setRunning(true);
    timerRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          stopTimer();
          // when timer ends, trigger blockers
          openBlockers().catch((e) => console.error(e));
          return 0;
        }
        return s - 1;
      });
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
      <div className="flex flex-col items-center">
        <h2 className="text-lg font-semibold">Session Controller</h2>
        <div className="mt-2 text-2xl">{formatTime(secondsLeft)}</div>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => startTimer(25 * 60)}
            className="px-3 py-1 rounded bg-blue-600 text-white"
          >
            Start 25m
          </button>
          <button onClick={() => startTimer(5 * 60)} className="px-3 py-1 rounded bg-green-600 text-white">
            Start 5m
          </button>
          <button onClick={stopTimer} className="px-3 py-1 rounded bg-yellow-500">
            Pause
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

      {/* Gemini image analysis */}
      <div className="w-full max-w-sm flex flex-col gap-3 border-t border-gray-200 pt-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
            Analyze screenshot
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
          />
        </label>

        {preview && (
          <img
            src={preview}
            alt="preview"
            className="w-full max-h-32 object-contain rounded border border-gray-200"
          />
        )}

        <button
          onClick={analyzeImage}
          disabled={!image || analyzing}
          className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm font-medium disabled:opacity-40 hover:bg-blue-700 transition-colors"
        >
          {analyzing ? "Analyzing…" : "Analyze ▶"}
        </button>

        {geminiResult && (
          <div className="flex flex-col items-center gap-1 py-3 bg-gray-50 rounded-lg border border-gray-200">
            <span className="text-3xl font-bold">{geminiResult.value}</span>
            <p className="text-sm text-gray-600 text-center px-3">{geminiResult.text}</p>
          </div>
        )}
      </div>
    </div>
  );
}