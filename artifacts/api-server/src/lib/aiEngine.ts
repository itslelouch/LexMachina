import { callLongCat, streamLongCat } from "./longcat.js";
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

type Role = "judge" | "prosecutor" | "defense";

function buildMessages(session: CaseSession, role: Role, additionalContext?: string) {
  let systemPrompt: string;
  if (role === "judge") systemPrompt = buildJudgeSystemPrompt(session);
  else if (role === "prosecutor") systemPrompt = buildProsecutorSystemPrompt(session);
  else systemPrompt = buildDefenseSystemPrompt(session);

  const turnPrompt = buildTurnPrompt(role, additionalContext);
  return [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: turnPrompt },
  ];
}

export async function generateAiStatement(
  session: CaseSession,
  role: Role,
  additionalContext?: string
): Promise<TranscriptEntry> {
  const messages = buildMessages(session, role, additionalContext);
  const result = await callLongCat(messages, { maxTokens: 1024, temperature: 0.85 });
  const entry = addTranscriptEntry(session, role, result.content, "ai");
  await saveCase(session);
  return entry;
}

export async function streamAiStatement(
  session: CaseSession,
  role: Role,
  onToken: (token: string) => void,
  additionalContext?: string
): Promise<TranscriptEntry> {
  const messages = buildMessages(session, role, additionalContext);
  const fullContent = await streamLongCat(
    messages,
    { maxTokens: 1024, temperature: 0.85 },
    onToken
  );
  const entry = addTranscriptEntry(session, role, fullContent, "ai");
  await saveCase(session);
  return entry;
}

export async function streamAllAiStatements(
  session: CaseSession,
  onRoleStart: (role: Role) => void,
  onToken: (role: Role, token: string) => void,
  onRoleEntry: (role: Role, entry: TranscriptEntry) => void
): Promise<TranscriptEntry[]> {
  const entries: TranscriptEntry[] = [];
  const order: Role[] = ["judge", "prosecutor", "defense"];

  for (const role of order) {
    if (session.roles[role] === "ai") {
      onRoleStart(role);
      const entry = await streamAiStatement(
        session,
        role,
        (token) => onToken(role, token)
      );
      onRoleEntry(role, entry);
      entries.push(entry);
    }
  }

  return entries;
}

export async function streamNextAiResponse(
  session: CaseSession,
  speakingRole: Role,
  onRoleStart: (role: Role) => void,
  onToken: (role: Role, token: string) => void,
  onRoleEntry: (role: Role, entry: TranscriptEntry) => void
): Promise<TranscriptEntry | null> {
  const order: Role[] = ["judge", "prosecutor", "defense"];
  const nextRole = order.find((r) => r !== speakingRole && session.roles[r] === "ai");
  if (!nextRole) return null;

  onRoleStart(nextRole);
  const entry = await streamAiStatement(
    session,
    nextRole,
    (token) => onToken(nextRole, token)
  );
  onRoleEntry(nextRole, entry);
  return entry;
}

export async function generateAllAiStatements(
  session: CaseSession
): Promise<TranscriptEntry[]> {
  const entries: TranscriptEntry[] = [];
  const order: Role[] = ["judge", "prosecutor", "defense"];
  for (const role of order) {
    if (session.roles[role] === "ai") {
      const entry = await generateAiStatement(session, role);
      entries.push(entry);
    }
  }
  return entries;
}
