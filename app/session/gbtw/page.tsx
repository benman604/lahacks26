"use client";

import { emit } from "@tauri-apps/api/event";
import { useSearchParams } from "next/navigation";

export default function GPTW() {
  const searchParams = useSearchParams();
  const instruction = searchParams.get("instruction")?.trim() ?? "";

  async function dismiss() {
    try {
      await emit("dismiss-blockers-retry");
    } catch (e) {
      console.error("failed to emit dismiss-blockers-retry", e);
    }
  }

  async function allowBreak() {
    try {
      await emit("allow-break");
    } catch (e) {
      console.error("failed to emit allow-break", e);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40">
      <div className="flex flex-col items-center gap-6 backdrop-blur-md px-10 py-8">

        <h1 className="text-5xl font-bold">Hey!</h1>

        <h3 className="text-lg ">
          {instruction || "Get back to work bud."}
        </h3>

        <div className="flex gap-4 mt-2">
          <button
            className="px-6 py-2 rounded-full bg-red-500 text-white hover:bg-red-600 transition"
            onClick={dismiss}
          >
            Close
          </button>

          <button
            className="px-6 py-2 rounded-full bg-green-500 text-white hover:bg-green-600 transition"
            onClick={allowBreak}
          >
            Start Break
          </button>
        </div>

      </div>
    </div>
  );
}