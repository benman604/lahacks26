"use client";

import { useState } from "react";

export type FeedPost = {
  id: number;
  initials: string;
  color: string;
  name: string;
  date: string;
  title: string;
  kudos: number;
  comments: { initials: string; color: string; name: string; text: string }[];
};

const defaultPosts: FeedPost[] = [
  {
    id: 1,
    initials: "B",
    color: "#3A6B9E",
    name: "Ben M.",
    date: "April 26, 2026 · 5:49 PM",
    title: "Afternoon Study — Organic Chem",
    kudos: 12,
    comments: [
      { initials: "M", color: "#7B5EA7", name: "Maya K.", text: "this is huge — keep going!" },
      { initials: "J", color: "#3A7D44", name: "Jordan T.", text: "the 90-min stretch is unreal!" },
    ],
  },
  {
    id: 2,
    initials: "E",
    color: "#BF4800",
    name: "Esther E.",
    date: "April 25, 2026 · 11:02 AM",
    title: "Morning Focus — Linear Algebra",
    kudos: 5,
    comments: [],
  },
];

function Avatar({ initials, color }: { initials: string; color: string }) {
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
}

export default function FeedSection({
  posts = defaultPosts,
  highlightedPostId,
  onHighlightPostId,
}: {
  posts?: FeedPost[];
  highlightedPostId: number | null;
  onHighlightPostId: (postId: number) => void;
}) {
  const [commentDraft, setCommentDraft] = useState("");
  const basePostClassName =
    "bg-white border border-gray-200 rounded-xl px-5 py-4 flex flex-col gap-3 cursor-pointer transition-colors hover:bg-gray-50";

  return (
    <>
      {posts.map((post) => (
        <article
          key={post.id}
          onClick={() => onHighlightPostId(post.id)}
          className={
            post.id === highlightedPostId
              ? "bg-white border-2 rounded-xl px-5 py-4 flex flex-col gap-3 cursor-pointer"
              : basePostClassName
          }
          style={post.id === highlightedPostId ? { borderColor: "var(--p2p-accent)" } : {}}
        >
          <div className="flex items-start gap-3">
            <Avatar initials={post.initials} color={post.color} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-sm">{post.name}</span>
                  <span className="text-xs text-gray-500 ml-2">{post.date}</span>
                </div>
                <button className="text-gray-400 hover:text-gray-600 text-lg leading-none px-1">
                  &hellip;
                </button>
              </div>
              <h2 className="font-semibold text-base mt-0.5">{post.title}</h2>
            </div>
          </div>

          {/* Session visualization placeholder */}
          {post.id === 1 && (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 h-20 flex items-center justify-center text-xs text-gray-400 tracking-widest uppercase">
              [ Session Visualization ]
            </div>
          )}

          {/* Kudos & comments count */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <button
              className="flex items-center gap-1 hover:opacity-80"
              style={{ color: "var(--p2p-accent)" }}
            >
              <span>&#9825;</span>
              <span>{post.kudos} kudos</span>
            </button>
            <button className="flex items-center gap-1 hover:opacity-80">
              <span>&#9679;</span>
              <span>{post.comments.length} comments</span>
            </button>
          </div>

          {/* Comments */}
          {post.comments.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-gray-100 pt-2">
              {post.comments.map((c) => (
                <div key={c.name} className="flex items-start gap-2">
                  <Avatar initials={c.initials} color={c.color} />
                  <p className="text-xs text-gray-700 pt-1.5">
                    <span className="font-semibold">{c.name}</span> {c.text}
                  </p>
                </div>
              ))}

              {/* Comment input */}
              <div className="flex items-center gap-2 mt-1">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                  style={{ backgroundColor: "#7B5230" }}
                >
                  A
                </div>
                <input
                  type="text"
                  placeholder="Leave some encouragement..."
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  className="flex-1 text-xs border-b border-gray-300 focus:outline-none focus:border-orange-400 py-1 bg-transparent placeholder-gray-400"
                />
              </div>
            </div>
          )}
        </article>
      ))}
    </>
  );
}
