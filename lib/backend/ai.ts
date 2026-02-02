import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export interface AIResult {
  summary_text: string;
  status_label: "FOCUSED" | "DISTRACTED" | "MIXED";
}

export async function generateSessionSummary(
  logs: any[],
  sessionContext: {
    subject: string;
    plannedDuration: number;
    actualDuration?: number;
    status: string;
  },
): Promise<AIResult> {
  const logStream = logs
    .map((l) => `[${l.created}] ${l.type.toUpperCase()}: ${l.message}`)
    .join("\n");

  const prompt = `
You are the "Mirror" of the HIA (Hold Idiot Accountable) system.
Your goal is to reflect the user's focus session back to them truthfully.

Context:
- Subject: ${sessionContext.subject}
- Status: ${sessionContext.status}
- Planned Duration: ${Math.floor(sessionContext.plannedDuration / 60)}m
- Actual Duration: ${
    sessionContext.actualDuration
      ? Math.floor(sessionContext.actualDuration / 60) + "m"
      : "Ongoing"
  }

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
4. Do not include markdown formatting like \`\`\`json. Just the raw JSON.
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
