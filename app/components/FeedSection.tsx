"use client";

import SessionSummaryCard from "./SessionSummaryCard";
import type { SessionData } from "../types";

export type FeedComment = {
  initials: string;
  color: string;
  name: string;
  text: string;
};

export type FeedPost = {
  id: number;
  initials: string;
  color: string;
  name: string;
  date: string;
  title: string;
  kudos: number;
  comments: FeedComment[];
};

const defaultPosts: FeedPost[] = [];

export default function FeedSection({
  sessions
}: {
  sessions: SessionData[];
}) {
  const selectClass =
    "text-sm border border-gray-300 rounded px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-orange-400";

  return (
    <main className="flex-1 flex flex-col gap-4 min-w-0">

      {/* Feed posts */}
      {sessions.map((session) => (
        <SessionSummaryCard
          key={`${session.userId}-${session.startTimestamp.toISOString()}`}
          session={session}
          username={
            session.userId === "ben"
              ? "Ben M."
              : session.userId === "esther"
                ? "Esther E."
                : session.userId === "andyroo"
                  ? "Andyroo"
                  : "Unknown User"
          }
        />
      ))}
    </main>
  );
}
