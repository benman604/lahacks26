"use client";

import { useState } from "react";

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

const sessions: SessionData[] = [
  {
    userId: "ben",
    title: "Afternoon Study — Organic Chem",
    idealBreakTimeMinutes: 5,
    startTimestamp: new Date("2026-04-25T17:49:00"),
    endTimestamp: new Date("2026-04-25T19:29:00"),
    focusElements: [
      {
        startTimestamp: new Date("2026-04-25T17:49:00"),
        endTimestamp: new Date("2026-04-25T18:39:00"),
        focusType: "focus",
      },
      {
        startTimestamp: new Date("2026-04-25T18:39:00"),
        endTimestamp: new Date("2026-04-25T18:49:00"),
        focusType: "break",
      },
      {
        startTimestamp: new Date("2026-04-25T18:49:00"),
        endTimestamp: new Date("2026-04-25T19:09:00"),
        focusType: "focus",
      },
      {
        startTimestamp: new Date("2026-04-25T19:09:00"),
        endTimestamp: new Date("2026-04-25T19:19:00"),
        focusType: "distracted",
      },
      {
        startTimestamp: new Date("2026-04-25T19:19:00"),
        endTimestamp: new Date("2026-04-25T19:29:00"),
        focusType: "focus",
      }
    ],
    appElements: [
      {
        startTimestamp: new Date("2026-04-25T17:49:00"),
        endTimestamp: new Date("2026-04-25T18:25:00"),
        activityName: "Lecture notes",
      },
      {
        startTimestamp: new Date("2026-04-25T18:25:00"),
        endTimestamp: new Date("2026-04-25T18:39:00"),
        activityName: "Practice problems",
      },
      {
        startTimestamp: new Date("2026-04-25T18:39:00"),
        endTimestamp: new Date("2026-04-25T18:49:00"),
        activityName: "Break",
      },
      {
        startTimestamp: new Date("2026-04-25T18:49:00"),
        endTimestamp: new Date("2026-04-25T19:09:00"),
        activityName: "Flashcards",
      },
      {
        startTimestamp: new Date("2026-04-25T19:09:00"),
        endTimestamp: new Date("2026-04-25T19:19:00"),
        activityName: "Messages",
      },
      {
        startTimestamp: new Date("2026-04-25T19:19:00"),
        endTimestamp: new Date("2026-04-25T19:29:00"),
        activityName: "Practice problems",
      },
    ],
    idleTimeSeconds: 240,
  },
  {
    userId: "esther",
    title: "Morning Focus — Linear Algebra",
    idealBreakTimeMinutes: 8,
    startTimestamp: new Date("2026-04-25T11:02:00"),
    endTimestamp: new Date("2026-04-25T12:02:00"),
    focusElements: [
      {
        startTimestamp: new Date("2026-04-25T11:02:00"),
        endTimestamp: new Date("2026-04-25T11:47:00"),
        focusType: "focus",
      },
      {
        startTimestamp: new Date("2026-04-25T11:47:00"),
        endTimestamp: new Date("2026-04-25T11:55:00"),
        focusType: "break",
      },
      {
        startTimestamp: new Date("2026-04-25T11:55:00"),
        endTimestamp: new Date("2026-04-25T12:02:00"),
        focusType: "focus",
      },
    ],
    appElements: [
      {
        startTimestamp: new Date("2026-04-25T11:02:00"),
        endTimestamp: new Date("2026-04-25T11:30:00"),
        activityName: "Problem set",
      },
      {
        startTimestamp: new Date("2026-04-25T11:30:00"),
        endTimestamp: new Date("2026-04-25T11:47:00"),
        activityName: "Proof review",
      },
      {
        startTimestamp: new Date("2026-04-25T11:47:00"),
        endTimestamp: new Date("2026-04-25T11:55:00"),
        activityName: "Break",
      },
      {
        startTimestamp: new Date("2026-04-25T11:55:00"),
        endTimestamp: new Date("2026-04-25T12:02:00"),
        activityName: "Lecture recap",
      },
    ],
    idleTimeSeconds: 90,
  },
  {
    userId: "andyroo",
    title: "Late Night Grind — History Reading",
    idealBreakTimeMinutes: 10,
    startTimestamp: new Date("2026-04-25T21:10:00"),
    endTimestamp: new Date("2026-04-25T22:40:00"),
    focusElements: [
      {
        startTimestamp: new Date("2026-04-25T21:10:00"),
        endTimestamp: new Date("2026-04-25T21:16:00"),
        focusType: "focus",
      },
      {
        startTimestamp: new Date("2026-04-25T21:16:00"),
        endTimestamp: new Date("2026-04-25T21:34:00"),
        focusType: "distracted",
      },
      {
        startTimestamp: new Date("2026-04-25T21:34:00"),
        endTimestamp: new Date("2026-04-25T21:48:00"),
        focusType: "break",
      },
      {
        startTimestamp: new Date("2026-04-25T21:48:00"),
        endTimestamp: new Date("2026-04-25T22:17:00"),
        focusType: "distracted",
      },
      {
        startTimestamp: new Date("2026-04-25T22:17:00"),
        endTimestamp: new Date("2026-04-25T22:28:00"),
        focusType: "break",
      },
      {
        startTimestamp: new Date("2026-04-25T22:28:00"),
        endTimestamp: new Date("2026-04-25T22:40:00"),
        focusType: "distracted",
      },
    ],
    appElements: [
      {
        startTimestamp: new Date("2026-04-25T21:10:00"),
        endTimestamp: new Date("2026-04-25T21:16:00"),
        activityName: "Reading outline",
      },
      {
        startTimestamp: new Date("2026-04-25T21:16:00"),
        endTimestamp: new Date("2026-04-25T21:25:00"),
        activityName: "Short videos",
      },
      {
        startTimestamp: new Date("2026-04-25T21:25:00"),
        endTimestamp: new Date("2026-04-25T21:34:00"),
        activityName: "Group chat",
      },
      {
        startTimestamp: new Date("2026-04-25T21:34:00"),
        endTimestamp: new Date("2026-04-25T21:48:00"),
        activityName: "Break",
      },
      {
        startTimestamp: new Date("2026-04-25T21:48:00"),
        endTimestamp: new Date("2026-04-25T22:06:00"),
        activityName: "Social media",
      },
      {
        startTimestamp: new Date("2026-04-25T22:06:00"),
        endTimestamp: new Date("2026-04-25T22:17:00"),
        activityName: "Online shopping",
      },
      {
        startTimestamp: new Date("2026-04-25T22:17:00"),
        endTimestamp: new Date("2026-04-25T22:28:00"),
        activityName: "Break",
      },
      {
        startTimestamp: new Date("2026-04-25T22:28:00"),
        endTimestamp: new Date("2026-04-25T22:40:00"),
        activityName: "Messages",
      },
    ],
    idleTimeSeconds: 1140,
  },
];

const defaultPosts: FeedPost[] = [];

export default function FeedSection({
  posts = defaultPosts,
  highlightedPostId,
  onHighlightPostId,
}: {
  posts?: FeedPost[];
  highlightedPostId: number | null;
  onHighlightPostId: (postId: number) => void;
}) {
  const [subject, setSubject] = useState("Organic Chem");
  const [duration, setDuration] = useState("50");
  const [breakTime, setBreakTime] = useState("10");

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
