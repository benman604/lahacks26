import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import * as z from "zod";
import { ScreenshotData } from "@/app/types";

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  maxOutputTokens: 2048,
});

const ScreenshotDataSchema = z.object({
  //timestamp: z.date(),
  focusType: z.enum(["productive", "distracted", "break"]).describe("Whether the user appears productive, distracted, or on a break"),
  websiteOrApp: z.string().describe("The website or app currently visible that takes up a majority of the screen. If on browser, identify the main website (e.g. 'YouTube', 'Reddit', 'Google Docs'). If on desktop, identify the primary application (e.g. 'Slack', 'VS Code', 'Finder')"),
  isIdle: z.boolean().describe("Whether the user is idle"),
  description: z.string().describe("Description of what is on screen"),
});

const structuredModel = model.withStructuredOutput(ScreenshotDataSchema);

const HARDCODED_SITES = [
  "Instagram",
  "Discord",
];

const PROMPT = `Analyze this screenshot. Identify the website or app visible. Based on what the user is supposed to be working on, determine if the user appears productive/working towards their goals or distracted. Then describe what you see on the screen in depth/what the user seems to be doing.
The following sites/apps are always considered distracting regardless of context: ${HARDCODED_SITES.join(", ")}.`;

const HistoryItemSchema = z.object({
  // timestamp optional for compatibility
  timestamp: z.string().optional(),
  focusType: z.enum(["productive", "distracted", "break"]),
  websiteOrApp: z.string(),
  isIdle: z.boolean(),
  description: z.string().optional(),
});

const HistorySchema = z.array(HistoryItemSchema);

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });
  }

  const body = await req.json();
  const { dataUrl, history = [], subject } = body as {
    dataUrl?: string;
    history?: unknown;
    subject?: unknown;
  };

  const subjectText = typeof subject === "string" ? subject.trim() : "";
  const promptWithSubject = subjectText
    ? `${PROMPT} Make sure the user is working on ${subjectText}.`
    : PROMPT;

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
    const when = h.timestamp ? `at ${h.timestamp}` : "previous";
    const desc = h.description ? ` Description: ${h.description}` : "";
    const txt = `Previous screenshot ${when} — focusType: ${h.focusType}; websiteOrApp: ${h.websiteOrApp}; isIdle: ${h.isIdle}.${desc}`;
    content.push({ type: "text", text: txt });
  }

  console.log("Constructed message content for Gemini", { content });

  if (imageBase64) {
    content.push({ type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } });
  }

  const message = new HumanMessage({ content });

  const result: z.infer<typeof ScreenshotDataSchema> = await structuredModel.invoke([message]);
  console.log("[gemini]", JSON.stringify(result, null, 2));
  return Response.json(result);
}
