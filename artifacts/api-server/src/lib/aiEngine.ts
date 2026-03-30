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

// ─── Internal witness helpers (no HTTP, mutate session in place) ────────────

function callWitnessInternal(session: CaseSession, person: CasePerson): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];
  if (session.activeWitness) {
    entries.push(addTranscriptEntry(session, "system",
      `${session.activeWitness.name} has been excused from the stand.`, "system"));
  }
  session.activeWitness = { personId: person.id, name: person.name, role: person.role, context: person.context };
  entries.push(addTranscriptEntry(session, "system",
    `${person.name} (${person.role}) has been called to the stand and sworn in.`, "system"));
  return entries;
}

function dismissWitnessInternal(session: CaseSession): TranscriptEntry | null {
  if (!session.activeWitness) return null;
  const name = session.activeWitness.name;
  session.activeWitness = null;
  return addTranscriptEntry(session, "system",
    `${name} has been dismissed from the stand. Thank you for your testimony.`, "system");
}

function pickWitnessForExamination(session: CaseSession): CasePerson | null {
  const alreadyCalled = new Set<string>();
  for (const entry of session.transcript) {
    const match = entry.content.match(/^(.+?) \(.+?\) has been called to the stand/);
    if (match) alreadyCalled.add(match[1]);
  }
  return session.persons.find(p => !p.deceased && !alreadyCalled.has(p.name)) ?? null;
}

// ─── Full AI-driven examination round ────────────────────────────────────────

export async function streamAiExaminationRound(
  session: CaseSession,
  examiningRole: Role,
  onRoleStart: (role: Role | "witness") => void,
  onToken: (role: Role | "witness", token: string) => void,
  onRoleEntry: (role: Role | "witness", entry: TranscriptEntry) => void,
  onSystemEntry: (entry: TranscriptEntry) => void,
): Promise<void> {
  const witness = pickWitnessForExamination(session);
  if (!witness) return;

  const opposingRole: Role = examiningRole === "prosecutor" ? "defense" : "prosecutor";
  const side = examiningRole === "prosecutor" ? "Prosecution" : "Defense";

  // 1. Examining attorney formally calls the witness
  onRoleStart(examiningRole);
  const callAnnounce = await streamAiStatement(
    session, examiningRole,
    (token) => onToken(examiningRole, token),
    `The ${side} wishes to call ${witness.name} (${witness.role}) to the stand. Formally announce this to the court.`
  );
  onRoleEntry(examiningRole, callAnnounce);

  // 2. System: witness sworn in
  const callEntries = callWitnessInternal(session, witness);
  await saveCase(session);
  for (const e of callEntries) onSystemEntry(e);

  // 3. Opening question from examining attorney
  onRoleStart(examiningRole);
  const q1 = await streamAiStatement(
    session, examiningRole,
    (token) => onToken(examiningRole, token),
    `Ask ${witness.name} your first direct examination question.`
  );
  onRoleEntry(examiningRole, q1);

  // 4. Witness answers q1
  onRoleStart("witness");
  const r1 = await streamWitnessResponse(session, q1.content, (token) => onToken("witness", token));
  onRoleEntry("witness", r1);

  // 5. Follow-up question
  onRoleStart(examiningRole);
  const q2 = await streamAiStatement(
    session, examiningRole,
    (token) => onToken(examiningRole, token),
    `Ask ${witness.name} a follow-up question that deepens or clarifies their testimony.`
  );
  onRoleEntry(examiningRole, q2);

  // 6. Witness answers q2
  onRoleStart("witness");
  const r2 = await streamWitnessResponse(session, q2.content, (token) => onToken("witness", token));
  onRoleEntry("witness", r2);

  // 7. Cross-examination by opposing counsel (if AI-controlled)
  if (session.roles[opposingRole] === "ai") {
    onRoleStart(opposingRole);
    const crossQ = await streamAiStatement(
      session, opposingRole,
      (token) => onToken(opposingRole, token),
      `Cross-examine ${witness.name} (${witness.role}). Challenge or undermine their testimony with a sharp, targeted question.`
    );
    onRoleEntry(opposingRole, crossQ);

    onRoleStart("witness");
    const crossR = await streamWitnessResponse(session, crossQ.content, (token) => onToken("witness", token));
    onRoleEntry("witness", crossR);
  }

  // 8. Judge's ruling / instruction (if AI-controlled)
  if (session.roles.judge === "ai") {
    onRoleStart("judge");
    const judgeNote = await streamAiStatement(
      session, "judge",
      (token) => onToken("judge", token),
      `Make a brief ruling or observation on the examination of ${witness.name}, then instruct them to step down.`
    );
    onRoleEntry("judge", judgeNote);
  }

  // 9. Dismiss witness
  const dismissEntry = dismissWitnessInternal(session);
  await saveCase(session);
  if (dismissEntry) onSystemEntry(dismissEntry);
}

// ─── Stream all AI statements (or trigger witness examination if applicable) ─

export async function streamAllAiStatements(
  session: CaseSession,
  onRoleStart: (role: Role | "witness") => void,
  onToken: (role: Role | "witness", token: string) => void,
  onRoleEntry: (role: Role | "witness", entry: TranscriptEntry) => void,
  onSystemEntry?: (entry: TranscriptEntry) => void,
): Promise<TranscriptEntry[]> {
  const entries: TranscriptEntry[] = [];
  const sysEntry = onSystemEntry ?? (() => {});

  // If a witness is already on the stand, continue questioning them
  if (session.activeWitness) {
    const examiner: Role | null =
      session.roles.prosecutor === "ai" ? "prosecutor" :
      session.roles.defense === "ai" ? "defense" : null;

    if (examiner) {
      onRoleStart(examiner);
      const questionEntry = await streamAiStatement(
        session, examiner,
        (token) => onToken(examiner, token),
        `Continue examining ${session.activeWitness.name} (${session.activeWitness.role}). Ask a relevant follow-up question.`
      );
      onRoleEntry(examiner, questionEntry);
      entries.push(questionEntry);

      onRoleStart("witness");
      const witnessEntry = await streamWitnessResponse(
        session, questionEntry.content,
        (token) => onToken("witness", token)
      );
      onRoleEntry("witness", witnessEntry);
      entries.push(witnessEntry);
    }
    return entries;
  }

  // During prosecution or defense case phase with available persons → run full examination
  const examinationPhases = ["prosecution_case", "defense_case"];
  if (examinationPhases.includes(session.phase) && session.persons.length > 0) {
    const examiningRole: Role = session.phase === "prosecution_case" ? "prosecutor" : "defense";
    const examinerIsAi = session.roles[examiningRole] === "ai";

    if (examinerIsAi && pickWitnessForExamination(session)) {
      await streamAiExaminationRound(
        session, examiningRole,
        onRoleStart, onToken, onRoleEntry, sysEntry
      );
      return entries;
    }
  }

  // Default: all AI roles speak in order
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
  // Route to witness only when Prosecutor or Defense speaks — not when Judge rules
  const witnessQuestioners: (Role | "witness")[] = ["prosecutor", "defense"];
  if (session.activeWitness && witnessQuestioners.includes(speakingRole)) {
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

  // Collect ALL AI roles that should respond (not just the first one)
  // This ensures Defense also speaks when user is Judge
  const aiRoles = order.filter(
    (r) => r !== speakingRole && session.roles[r] === "ai"
  );
  if (aiRoles.length === 0) return null;

  // Only inject human context for the first responding role
  const speakingRoleAssignment = speakingRole === "witness" ? "ai" : session.roles[speakingRole as Role];
  const humanContext = speakingRoleAssignment === "user" && lastUserMessage
    ? `The previous statement was made by a HUMAN PLAYER who may be using informal language. They said: "${lastUserMessage}". Interpret their intent charitably and respond directly to the substance of what they meant. Keep the proceedings moving.`
    : undefined;

  let lastEntry: TranscriptEntry | null = null;
  for (let i = 0; i < aiRoles.length; i++) {
    const role = aiRoles[i];
    onRoleStart(role);
    const entry = await streamAiStatement(
      session,
      role,
      (token) => onToken(role, token),
      i === 0 ? humanContext : undefined
    );
    onRoleEntry(role, entry);
    lastEntry = entry;
  }
  return lastEntry;
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
