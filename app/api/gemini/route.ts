import { ChatGroq } from "@langchain/groq";
import { HumanMessage } from "@langchain/core/messages";
import * as z from "zod";
import { ScreenshotData } from "@/app/types";

const model = new ChatGroq({
  model: "meta-llama/llama-4-scout-17b-16e-instruct",
});

const ScreenshotDataSchema = z.object({
  focusType: z
    .enum(["productive", "supportive", "neutral", "distracted"])
    .describe(`
Classify the user's current activity:
- productive: directly working on the stated subject/task
- supportive: indirectly helping the task, such as tutorials, explanations, docs, examples, research, or reference material
- neutral: unclear or insufficient evidence
- distracted: clearly unrelated to the stated subject/task
`),
  websiteOrApp: z.string().describe(
    "The website or app currently visible that takes up a majority of the screen."
  ),
  isIdle: z.string().optional().describe("Whether the user appears idle. Return 'true' or 'false'."),
  description: z.string().optional().describe(
    "Detailed description of what is visible and what the user seems to be doing."
  ),
  relevanceToSubject: z.string().optional().describe(
    "Explain how the screen content relates or does not relate to the stated subject."
  ),
  confidence: z.string().optional().describe("Confidence score between 0 and 1."),
  instructOffDistraction: z.string().optional().describe(
    "Only populate if focusType is distracted."
  ),
});

const structuredModel = model.withStructuredOutput(ScreenshotDataSchema);

const HARDCODED_SITES = [
  "Instagram",
  "Discord",
];

const PROMPT = `
Analyze this screenshot to determine whether the user is working toward their stated goal.

You will be given:
- The subject/task the user is supposed to be working on
- Recent screenshot history
- The current screenshot

First identify the website/app and visible content.
Then decide whether the current activity helps the user's stated subject/task.

Classify the activity as:
- productive: directly working on the subject/task
- supportive: related learning, research, tutorials, explanations, examples, documentation, reference material, or setup work
- neutral: unclear whether it is related
- distracted: clearly unrelated to the subject/task

Important:
- Do NOT mark something distracted just because it is YouTube, Google, a browser, or messaging.
- Educational videos, lectures, explanations, documentation, or examples related to the subject should be supportive, not distracted.
- If the connection to the subject is plausible but not certain, use neutral or supportive with lower confidence.
- Only use distracted when the screen is clearly unrelated to the stated subject.
- These sites/apps are always distracted regardless of context: ${HARDCODED_SITES.join(", ")}.
- Use recent history to distinguish a quick lookup from sustained distraction.
- If focusType is distracted, provide a short instruction to get back on track.
`;

const HistoryItemSchema = z.object({
  timestamp: z.string().optional(),
  focusType: z.enum(["productive", "supportive", "neutral", "distracted"]),
  websiteOrApp: z.string(),
  isIdle: z.union([z.boolean(), z.string()]).optional(),
  description: z.string().optional(),
  relevanceToSubject: z.string().optional(),
  confidence: z.number().optional(),
});

const HistorySchema = z.array(HistoryItemSchema);

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "GROQ_API_KEY not set" }, { status: 500 });
  }

  const body = await req.json();
  const { dataUrl, history = [], subject } = body as {
    dataUrl?: string;
    history?: unknown;
    subject?: unknown;
  };

  const subjectText = typeof subject === "string" ? subject.trim() : "";
  const promptWithSubject = subjectText
    ? `${PROMPT}\n\nCURRENT USER SUBJECT/TASK: ${subjectText}`
    : `${PROMPT}\n\nCURRENT USER SUBJECT/TASK: unknown`;

  console.log("Received data for Gemini analysis", { dataUrl: !!dataUrl, history: history });
  // attempt to validate history; if validation fails, log the error and fall back to raw array if possible
  const parsedHistory = HistorySchema.safeParse(history);
  if (!parsedHistory.success) {
    console.warn("/api/gemini: history did not validate against schema", parsedHistory.error.format());
  }
  const historyItems = Array.isArray(history) ? (parsedHistory.success ? parsedHistory.data : history) : [];
  console.log(`/api/gemini: using ${Array.isArray(historyItems) ? historyItems.length : 0} history items`);

  const [header, imageBase64] = (dataUrl || "").split(",");
  const mimeType = header ? header.split(":")[1].split(";")[0] : "image/png";

  // Build messages: prompt, then prior history summaries, then current image
  const content: any[] = [];
  content.push({ type: "text", text: promptWithSubject });

  for (const h of historyItems) {
    const when = h.timestamp ? `at ${h.timestamp}` : "previously";
    const parts = [`focusType: ${h.focusType}`, `app: ${h.websiteOrApp}`];
    if (h.confidence != null) parts.push(`confidence: ${h.confidence}`);
    if (h.relevanceToSubject) parts.push(`relevance: ${h.relevanceToSubject}`);
    if (h.description) parts.push(`description: ${h.description}`);
    content.push({ type: "text", text: `Screenshot ${when} — ${parts.join("; ")}` });
  }

  console.log("Constructed message content for Gemini", { content });

  if (imageBase64) {
    content.push({ type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } });
  }

  const message = new HumanMessage({ content });

  let raw;
  try {
    raw = await structuredModel.invoke([message]);
  } catch (e) {
    console.error("[groq] invoke failed", e);
    return Response.json({ error: String(e) }, { status: 500 });
  }

  const result = {
    ...raw,
    isIdle: raw.isIdle === true || (raw.isIdle as unknown) === "true",
    description: raw.description ?? "",
    relevanceToSubject: raw.relevanceToSubject ?? "",
    confidence: raw.confidence ?? null,
  };
  console.log("[groq]", JSON.stringify(result, null, 2));
  return Response.json(result);
}
