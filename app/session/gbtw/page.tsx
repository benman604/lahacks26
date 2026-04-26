"use client";

import { useEffect, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";

type DistractionInstructionPayload = {
  instruction?: unknown;
};

export default function GPTW() {
  const [instruction, setInstruction] = useState<string>("");

  useEffect(() => {
    const unlistenPromise = listen<DistractionInstructionPayload>(
      "show-distraction-instruction",
      (event) => {
        const nextInstruction = event.payload?.instruction;
        if (typeof nextInstruction === "string") {
          setInstruction(nextInstruction);
        }
      }
    );

    return () => {
      unlistenPromise.then((unlisten) => unlisten()).catch(() => {});
    };
  }, []);

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

        {instruction && (
          <p className="max-w-2xl text-center text-base text-white/95">
            {instruction}
          </p>
        )}

        <h3 className="text-lg">Get back to work bud.</h3>

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
            Allow
          </button>
        </div>

      </div>
    </div>
  );
}