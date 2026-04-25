"use client";

import { getCurrentWindow } from "@tauri-apps/api/window";

export default function GPTW() {
  async function close() {
    try {
      await getCurrentWindow().close();
    } catch (e) {
      // fallback: log error so it's visible during debugging
      // eslint-disable-next-line no-console
      console.error("failed to close window", e);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40">
      <div className="flex flex-col items-center gap-6 bg-white/90 backdrop-blur-md px-10 py-8 rounded-2xl">
        
        <h1 className="text-5xl font-bold text-gray-900">
          Hey!
        </h1>

        <h3 className="text-lg text-gray-600">
          Get back to work bud.
        </h3>

        <div className="flex gap-4 mt-2">
          <button 
            className="px-6 py-2 rounded-full bg-red-500 text-white hover:bg-red-600 transition"
            onClick={close}
          >
            Close
          </button>

          <button className="px-6 py-2 rounded-full bg-green-500 text-white hover:bg-green-600 transition">
            Allow
          </button>
        </div>

      </div>
    </div>
  );
}