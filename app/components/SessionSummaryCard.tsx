"use client";

import type { CSSProperties } from "react";
import type { SessionData, SessionSummary } from "../types";
import {
  clampPercent,
  computeProductivityScore,
  computeSessionSummary,
  secondsBetween,
} from "../lib/sessionStats";

type Props = {
  session: SessionData;
  username?: string;
};

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

function formatRange(start: Date, end: Date) {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

function formatSessionDateLabel(date: Date) {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (target.getTime() === today.getTime()) return "Today";
  if (target.getTime() === yesterday.getTime()) return "Yesterday";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(target);
}

function getTrafficLightColor(score: number) {
  const rounded = Math.round(clampPercent(score));
  if (rounded >= 100) return "#00F5FF"; // Electric Cyan for "Perfect"
  if (rounded <= 69) return "#dc2626";
  if (rounded <= 89) return "#facc15";
  return "#16a34a";
}

function TimelineSegment({
  width,
  className,
  tooltip,
  style,
}: {
  width: number;
  className?: string;
  tooltip: string;
  style?: CSSProperties;
}) {
  if (width <= 0) return null;

  return (
    <div
      className={`group relative h-full min-w-[3px] cursor-default transition hover:-translate-y-0.5 hover:brightness-105 ${className ?? ""}`}
      style={{ width: `${width}%`, ...style }}
    >
      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2 py-1 text-[11px] font-semibold text-white shadow-lg group-hover:block">
        {tooltip}
      </div>
    </div>
  );
}

function mixHex(a: string, b: string, t: number) {
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
  const tt = clamp01(t);

  const parse = (hex: string) => {
    const normalized = hex.replace("#", "");
    const r = Number.parseInt(normalized.slice(0, 2), 16);
    const g = Number.parseInt(normalized.slice(2, 4), 16);
    const bl = Number.parseInt(normalized.slice(4, 6), 16);
    return { r, g, b: bl };
  };

  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, "0");

  const ca = parse(a);
  const cb = parse(b);

  const r = ca.r + (cb.r - ca.r) * tt;
  const g = ca.g + (cb.g - ca.g) * tt;
  const bl = ca.b + (cb.b - ca.b) * tt;

  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
}

function StatPill({ label, value }: { label: string; value: number }) {
  const radius = 21;
  const circumference = 2 * Math.PI * radius;
  const progress = clampPercent(value);
  const dashOffset = circumference * (1 - progress / 100);
  const ringColor = getTrafficLightColor(progress);

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-center flex min-h-16 flex-col items-center justify-center">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
        {label}
      </div>
      <div className="relative mt-1 h-16 w-16">
        <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
          {/* 1. Define the Glow Filter */}
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background Circle */}
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="6"
          />

          {/* Progress Circle with Conditional Glow */}
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            // Only apply filter if value is 100
            filter={value > 99 ? "url(#glow)" : "none"}
            className="transition-all duration-500 ease-in-out"
          />
        </svg>

        {/* Center Text with Conditional Glow/Color */}
        <div 
          className="absolute inset-0 flex items-center justify-center text-lg font-bold leading-none"
          style={{ 
            color: value > 99 ? ringColor : "#111827",
            textShadow: value > 99 ? `0 0 8px ${ringColor}44` : "none" 
          }}
        >
          {Math.round(value)}
        </div>
      </div>
    </div>
  );
}

function RadarChart({ summary }: { summary: SessionSummary }) {
  const stats = [
    { label: "Focus", value: summary.productivityRate },
    { label: "Stamina", value: summary.stamina },
    { label: "Discipline", value: summary.adherenceToBreakTime },
    { label: "Flow", value: summary.flowScore },
    { label: "Activity", value: 100 - summary.idleRatio },
  ];

  const center = 110;
  const maxRadius = 76;
  const outerVertices = [0, 1, 2, 3, 4].map((i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return {
      x: center + Math.cos(angle) * maxRadius,
      y: center + Math.sin(angle) * maxRadius,
    };
  });
  const outerPoints = outerVertices.map(({ x, y }) => `${x},${y}`).join(" ");

  const points = stats
    .map((stat, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / stats.length;
      const radius = (clampPercent(stat.value) / 100) * maxRadius;

      return `${center + Math.cos(angle) * radius},${center + Math.sin(angle) * radius}`;
    })
    .join(" ");

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-gray-400">
        Session Shape
      </div>

      <svg viewBox="-18 -18 256 266" className="h-56 w-full">
        <defs>
          <radialGradient id="radarBaseGradient" cx="50%" cy="50%" r="58%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#9ca3af" />
          </radialGradient>
        </defs>

        <polygon
          points={outerPoints}
          fill="url(#radarBaseGradient)"
          stroke="#6b7280"
          strokeWidth="1.8"
        />

        {[0.75, 0.5, 0.25].map((ratio) => (
          <polygon
            key={ratio}
            points={outerVertices
              .map(({ x, y }) => {
                const px = center + (x - center) * ratio;
                const py = center + (y - center) * ratio;
                return `${px},${py}`;
              })
              .join(" ")}
            fill="none"
            stroke="#9ca3af"
            strokeWidth="1.2"
          />
        ))}

        {outerVertices.map(({ x, y }, i) => (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={x}
            y2={y}
            stroke="#4b5563"
            strokeWidth="1.6"
          />
        ))}

        <polygon
          points={points}
          fill="rgba(191,72,0,0.3)"
          stroke="var(--p2p-accent)"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {stats.map((stat, i) => {
          const angle = -Math.PI / 2 + (i * 2 * Math.PI) / stats.length;
          const x = center + Math.cos(angle) * 103;
          const y = center + Math.sin(angle) * 103;

          return (
            <text
              key={stat.label}
              x={x}
              y={y}
              textAnchor="middle"
              className="fill-gray-500 text-[12px] font-bold"
            >
              {stat.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export default function SessionSummaryCard({
  session,
  username = "You",
}: Props) {
  const summary = computeSessionSummary(session);
  const sessionDateLabel = formatSessionDateLabel(summary.startTimestamp);
  const roundedProductivity = computeProductivityScore({
    productivityRate: summary.productivityRate,
    stamina: summary.stamina,
    adherenceToBreakTime: summary.adherenceToBreakTime,
    flowScore: summary.flowScore,
    idleRatio: summary.idleRatio,
  });
  const focusBadgeBackground = getTrafficLightColor(roundedProductivity);
  const isFocusedYellow = roundedProductivity >= 70 && roundedProductivity <= 89 || roundedProductivity >= 100;
  const focusBadgeText = isFocusedYellow ? "#111827" : "#ffffff";

  const totalSeconds = secondsBetween(summary.startTimestamp, summary.endTimestamp);

  const focusTimeline = summary.focusElements.map((el) => {
          const seconds = secondsBetween(el.startTimestamp, el.endTimestamp);
          
          const color =
            el.focusType === "productive"
              ? "#87ae73"
              : el.focusType === "supportive"
                ? "#fbbf24"
                : el.focusType === "neutral"
                  ? "#b0a4d6"
                  : "#4f8bc3";

          return {
            width: totalSeconds > 0 ? (seconds / totalSeconds) * 100 : 0,
            color,
            tooltip: `${el.focusType} · ${formatRange(el.startTimestamp, el.endTimestamp)}`,
          };
        })

  const basePalette = ["#904c77", "#e49ab0", "#ecb8a5", "#eccfc3", "#957d95"];
  const tintPalette = basePalette.map((c) => mixHex(c, "#ffffff", 0.28));
  const shadePalette = basePalette.map((c) => mixHex(c, "#000000", 0.18));
  const appPalette = [...basePalette, ...tintPalette, ...shadePalette];

  // Create app timeline segments, assigning colors based on activity name
  const createAppTimeline = (
    appElements: SessionData["appElements"],
  ) => {
      const activityColors = new Map<string, string>();
      let nextColorIndex = 0;

      const source = appElements.map((el) => {
              const seconds = secondsBetween(el.startTimestamp, el.endTimestamp);
              return {
                activityName: el.activityName,
                width: totalSeconds > 0 ? (seconds / totalSeconds) * 100 : 0,
                tooltip: `${el.activityName} · ${formatRange(el.startTimestamp, el.endTimestamp)}`,
              };
            })

      const appTimeline = source.map((item) => {
        let backgroundColor = activityColors.get(item.activityName);
        if (!backgroundColor) {
          backgroundColor = appPalette[nextColorIndex % appPalette.length];
          activityColors.set(item.activityName, backgroundColor);
          nextColorIndex += 1;
        }

        return {
          width: item.width,
          backgroundColor,
          tooltip: item.tooltip,
        };
      });

      return appTimeline;
  }

  const appTimeline = createAppTimeline(summary.appElements);

  return (
    <article className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500">
            {username} · {sessionDateLabel} · {formatRange(summary.startTimestamp, summary.endTimestamp)}
          </p>
          <h2 className="font-semibold text-xl mt-0.5">{summary.title}</h2>
        </div>

        <div
          className="rounded-full px-3 py-1 text-xs font-bold shrink-0 transition-all duration-500"
          style={{ 
            backgroundColor: focusBadgeBackground, 
            color: focusBadgeText,
            // Using filter: drop-shadow instead of box-shadow keeps the sizing more consistent
            filter: roundedProductivity >= 100 
              ? `drop-shadow(0 0 6px ${focusBadgeBackground})` 
              : `drop-shadow(0 0 3px ${focusBadgeBackground}66)`
          }}
        >
          {roundedProductivity}% productive
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <RadarChart summary={summary} />

        <div className="flex flex-col justify-center gap-4 min-w-0">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <StatPill label="Focus" value={summary.productivityRate} />
            <StatPill label="Stamina" value={summary.stamina} />
            <StatPill label="Discipline" value={summary.adherenceToBreakTime} />
            <StatPill label="Flow" value={summary.flowScore} />
            <StatPill label="Activity" value={100 - summary.idleRatio} />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[11px] font-semibold uppercase tracking-widest text-gray-400">
              <span>Attention timeline</span>
              <span>{formatRange(summary.startTimestamp, summary.endTimestamp)}</span>
            </div>

            <div className="flex h-8 overflow-visible rounded-full bg-gray-100">
              {focusTimeline.map((segment, i) => (
                <TimelineSegment
                  key={i}
                  width={segment.width}
                  style={{ backgroundColor: segment.color }}
                  tooltip={segment.tooltip}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[11px] font-semibold uppercase tracking-widest text-gray-400">
              <span>App timeline</span>
              <span>Activity mix</span>
            </div>

            <div className="flex h-8 overflow-visible rounded-full bg-gray-100">
              {appTimeline.map((segment, i) => (
                <TimelineSegment
                  key={i}
                  width={segment.width}
                  style={{ backgroundColor: segment.backgroundColor }}
                  tooltip={segment.tooltip}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

