const PROMPT =
  "Look at this image. Return a score from 1–10 and one sentence of feedback.";

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });
  }

  const { imageBase64, mimeType } = await req.json();

  const body = {
    contents: [
      {
        parts: [
          { text: PROMPT },
          { inlineData: { mimeType, data: imageBase64 } },
        ],
      },
    ],
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    return Response.json({ error: err }, { status: 500 });
  }

  const data = await res.json();
  const raw: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  // Extract the first number as the score value, rest as feedback text
  const match = raw.match(/(\d+(?:\.\d+)?)/);
  const value = match ? `${match[1]}/10` : "–";
  const text = raw.replace(/^\s*\d+(?:\.\d+)?\s*[/\\]?\s*10\s*[.:\-–]?\s*/i, "").trim() || raw;

  return Response.json({ value, text });
}
