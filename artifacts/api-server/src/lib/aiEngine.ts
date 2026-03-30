import { callLongCat, streamLongCat } from "./longcat.js";
import {
  buildJudgeSystemPrompt,
  buildProsecutorSystemPrompt,
  buildDefenseSystemPrompt,
  buildTurnPrompt,
  buildWitnessSystemPrompt,
  buildWitnessTurnPrompt,
  buildPersonExtractionPrompt,
} from "./prompts.js";
import {
  addTranscriptEntry,
  saveCase,
  type CaseSession,
  type TranscriptEntry,
  type CasePerson,
} from "./memory.js";
import { randomUUID } from "node:crypto";

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
  const fullContent = await streamLongCat(messages, { maxTokens: 1024, temperature: 0.85 }, onToken);
  const entry = addTranscriptEntry(session, role, fullContent, "ai");
  await saveCase(session);
  return entry;
}

export async function streamWitnessResponse(
  session: CaseSession,
  question: string,
  onToken: (token: string) => void
): Promise<TranscriptEntry> {
  if (!session.activeWitness) throw new Error("No active witness on stand");

  const { name, role, context } = session.activeWitness;
  const systemPrompt = buildWitnessSystemPrompt(session, name, role, context);
  const turnPrompt = buildWitnessTurnPrompt(question);

  const fullContent = await streamLongCat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: turnPrompt },
    ],
    { maxTokens: 512, temperature: 0.9 },
    onToken
  );

  const entry = addTranscriptEntry(session, "witness", fullContent, "ai", name);
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
      const entry = await streamAiStatement(session, role, (token) => onToken(role, token));
      onRoleEntry(role, entry);
      entries.push(entry);
    }
  }

  return entries;
}

export async function streamNextAiResponse(
  session: CaseSession,
  speakingRole: Role | "witness",
  lastUserMessage: string,
  onRoleStart: (role: Role | "witness") => void,
  onToken: (role: Role | "witness", token: string) => void,
  onRoleEntry: (role: Role | "witness", entry: TranscriptEntry) => void
): Promise<TranscriptEntry | null> {
  if (session.activeWitness && speakingRole !== "witness") {
    onRoleStart("witness");
    const entry = await streamWitnessResponse(
      session,
      lastUserMessage,
      (token) => onToken("witness", token)
    );
    onRoleEntry("witness", entry);
    return entry;
  }

  const order: Role[] = ["judge", "prosecutor", "defense"];
  const nextRole = order.find(
    (r) => r !== speakingRole && session.roles[r] === "ai"
  );
  if (!nextRole) return null;

  // Determine if the triggering speaker was a human player
  const speakingRoleAssignment = speakingRole === "witness" ? "ai" : session.roles[speakingRole as Role];
  const humanContext = speakingRoleAssignment === "user" && lastUserMessage
    ? `The previous statement was made by a HUMAN PLAYER who may be using informal language. They said: "${lastUserMessage}". Interpret their intent charitably and respond directly to the substance of what they meant. Keep the proceedings moving.`
    : undefined;

  onRoleStart(nextRole);
  const entry = await streamAiStatement(
    session,
    nextRole,
    (token) => onToken(nextRole, token),
    humanContext
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

export async function extractPersonsFromText(text: string): Promise<Omit<CasePerson, "id">[]> {
  const prompt = buildPersonExtractionPrompt(text);

  try {
    const result = await callLongCat(
      [{ role: "user", content: prompt }],
      { maxTokens: 1024, temperature: 0.2 }
    );

    const cleaned = result.content.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/i, "");
    const parsed = JSON.parse(cleaned) as Array<{ name: string; role: string; context: string }>;

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((p) => p.name && p.role && p.context)
      .map((p) => ({
        name: String(p.name).trim(),
        role: String(p.role).trim(),
        context: String(p.context).trim(),
        deceased: Boolean(p.deceased),
      }));
  } catch {
    return [];
  }
}

export function mergePersons(existing: CasePerson[], newOnes: Omit<CasePerson, "id">[]): CasePerson[] {
  const merged = [...existing];

  for (const newPerson of newOnes) {
    const alreadyExists = merged.some(
      (p) => p.name.toLowerCase() === newPerson.name.toLowerCase()
    );
    if (!alreadyExists) {
      merged.push({ id: randomUUID(), ...newPerson });
    }
  }

  return merged;
}
