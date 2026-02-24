import Groq from "groq-sdk";
import { config } from "@/lib/backend/config";
import { formatDuration } from "@/lib/utils";
import { Log } from "@/lib/backend/schema";

const groq = new Groq({
  apiKey: config.groqApiKey,
});

export interface AIResult {
  summary_text: string;
  status_label: "FOCUSED" | "DISTRACTED" | "MIXED";
}

export async function generateSessionSummary(
  logs: Log[],
  sessionContext: {
    subject: string;
    plannedDuration: number;
    actualDuration?: number;
    status: string;
    reason?: string;
  },
): Promise<AIResult> {
  const subjectLower = sessionContext.subject.toLowerCase();
  if (subjectLower.includes("test") && subjectLower.includes("session")) {
    return {
      summary_text: "No summary is generated for test sessions.",
      status_label: "FOCUSED",
    };
  }

  const logStream = logs
    .map((l) => `[${l.created_at}] ${l.type.toUpperCase()}: ${l.message}`)
    .join("\n");

  const prompt = `
You are the "Mirror" of the HIA (Hold Idiot Accountable) system.
Your goal is to reflect the user's focus session back to them truthfully.

Context:
- Subject: ${sessionContext.subject}
- Status: ${sessionContext.status}
- Planned Duration: ${formatDuration(sessionContext.plannedDuration)}
- Actual Duration: ${
    sessionContext.actualDuration
      ? formatDuration(Math.floor(sessionContext.actualDuration))
      : "Ongoing"
  }
${sessionContext.reason ? `- End Reason provided by user: ${sessionContext.reason}` : ""}

Session Logs:
${logStream}

Instructions:
1. Analyze the session data.
2. Return a JSON object strictly adhering to this schema:
   {
     "summary_text": "A 2-3 sentence factual summary of the session behavior.",
     "status_label": "ONE OF: FOCUSED, DISTRACTED, MIXED"
   }
3. 'summary_text' should be calm, non-judgmental, and truth-telling.
4. If a reason for ending the session was provided, incorporate that reason into the 'summary_text' so the user sees their own justification reflected back to them.
5. When mentioning durations in summary_text, use human-readable format like "2hr 15min" or "20min" instead of seconds.
6. Do not include markdown formatting like \`\`\`json. Just the raw JSON.
`;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
      max_completion_tokens: 150,
      response_format: { type: "json_object" },
    });

    const content = chatCompletion.choices[0]?.message?.content;
    if (!content) throw new Error("No content returned");

    return JSON.parse(content) as AIResult;
  } catch (error) {
    console.error("Groq generation failed:", error);
    return {
      summary_text: "Summary unavailable due to an error.",
      status_label: "MIXED",
    };
  }
}
