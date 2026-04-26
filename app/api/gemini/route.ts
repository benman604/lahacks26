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
  focusType: z.enum(["focus", "distracted", "break"]),
  websiteOrApp: z.string(),
  isIdle: z.boolean(),
  description: z.string().describe("Description of what is on screen"),
});

const structuredModel = model.withStructuredOutput(ScreenshotDataSchema);

const PROMPT =
  "Analyze this screenshot. Identify the website or app visible. Determine if the user appears focused, distracted, or on a break. Then describe what you see on the screen in depth/what the user seems to be doing";

const HistoryItemSchema = z.object({
  // timestamp optional for compatibility
  timestamp: z.string().optional(),
  focusType: z.enum(["focus", "distracted", "break"]),
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
  const { dataUrl, history = [] } = body as { dataUrl?: string; history?: unknown };

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
  content.push({ type: "text", text: PROMPT });

  for (const h of historyItems) {
    const when = h.timestamp ? `at ${h.timestamp}` : "previous";
    const desc = h.description ? ` Description: ${h.description}` : "";
    const txt = `Previous screenshot ${when} — focusType: ${h.focusType}; websiteOrApp: ${h.websiteOrApp}; isIdle: ${h.isIdle}.${desc}`;
    content.push({ type: "text", text: txt });
  }

  if (imageBase64) {
    content.push({ type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } });
  }

  const message = new HumanMessage({ content });

  const result: z.infer<typeof ScreenshotDataSchema> = await structuredModel.invoke([message]);
  console.log("[gemini]", JSON.stringify(result, null, 2));
  return Response.json(result);
}
