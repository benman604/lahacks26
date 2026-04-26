import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import * as z from "zod";

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

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });
  }

  const { dataUrl } = await req.json();
  const [header, imageBase64] = dataUrl.split(",");
  const mimeType = header.split(":")[1].split(";")[0];

  const message = new HumanMessage({
    content: [
      { type: "text", text: PROMPT },
      {
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${imageBase64}` },
      },
    ],
  });


  const result: z.infer<typeof ScreenshotDataSchema> = await structuredModel.invoke([message]);
  console.log("[gemini]", JSON.stringify(result, null, 2));
  return Response.json(result);
}
