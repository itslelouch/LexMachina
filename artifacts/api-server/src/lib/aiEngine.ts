import { callLongCat } from "./longcat.js";
import {
  buildJudgeSystemPrompt,
  buildProsecutorSystemPrompt,
  buildDefenseSystemPrompt,
  buildTurnPrompt,
} from "./prompts.js";
import {
  addTranscriptEntry,
  saveCase,
  type CaseSession,
  type TranscriptEntry,
} from "./memory.js";

export async function generateAiStatement(
  session: CaseSession,
  role: "judge" | "prosecutor" | "defense",
  additionalContext?: string
): Promise<TranscriptEntry> {
  let systemPrompt: string;

  if (role === "judge") {
    systemPrompt = buildJudgeSystemPrompt(session);
  } else if (role === "prosecutor") {
    systemPrompt = buildProsecutorSystemPrompt(session);
  } else {
    systemPrompt = buildDefenseSystemPrompt(session);
  }

  const turnPrompt = buildTurnPrompt(role, additionalContext);

  const result = await callLongCat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: turnPrompt },
    ],
    {
      maxTokens: 1024,
      temperature: 0.85,
    }
  );

  const entry = addTranscriptEntry(session, role, result.content, "ai");
  await saveCase(session);

  return entry;
}

export async function generateAllAiStatements(
  session: CaseSession
): Promise<TranscriptEntry[]> {
  const entries: TranscriptEntry[] = [];

  const order: Array<"judge" | "prosecutor" | "defense"> = [
    "judge",
    "prosecutor",
    "defense",
  ];

  for (const role of order) {
    if (session.roles[role] === "ai") {
      const entry = await generateAiStatement(session, role);
      entries.push(entry);
    }
  }

  return entries;
}

export async function generateAiResponsesAfterUserSpoke(
  session: CaseSession,
  speakingRole: "judge" | "prosecutor" | "defense"
): Promise<TranscriptEntry[]> {
  const entries: TranscriptEntry[] = [];

  const responseOrder: Array<"judge" | "prosecutor" | "defense"> = [
    "judge",
    "prosecutor",
    "defense",
  ].filter((r) => r !== speakingRole) as Array<
    "judge" | "prosecutor" | "defense"
  >;

  for (const role of responseOrder) {
    if (session.roles[role] === "ai") {
      const entry = await generateAiStatement(session, role);
      entries.push(entry);
    }
  }

  return entries;
}
