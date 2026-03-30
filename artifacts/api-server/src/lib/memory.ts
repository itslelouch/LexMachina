import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { logger } from "./logger.js";

const DATA_DIR = path.join(process.cwd(), "data", "cases");

export type RoleController = "user" | "ai";
export type LegalSystem = "general" | "indian" | "us_federal" | "uk";
export type AIDemeanor = "formal" | "aggressive" | "theatrical";
export type CourtPhase =
  | "pre_trial_motions"
  | "opening_statements"
  | "prosecution_case"
  | "defense_case"
  | "closing_arguments"
  | "verdict"
  | "concluded";

export type RoleAssignment = {
  judge: RoleController;
  prosecutor: RoleController;
  defense: RoleController;
};

export type TranscriptEntry = {
  id: string;
  role: "judge" | "prosecutor" | "defense" | "system" | "witness";
  speaker: string;
  content: string;
  timestamp: string;
  controlledBy: "user" | "ai" | "system";
};

export type Development = {
  id: string;
  title: string;
  content: string;
  timestamp: string;
};

export type CasePerson = {
  id: string;
  name: string;
  role: string;
  context: string;
  deceased: boolean;
};

export type ActiveWitness = {
  personId: string;
  name: string;
  role: string;
  context: string;
};

export type EvidenceItem = {
  id: string;
  exhibit: string;
  title: string;
  description: string;
  submittedBy: "prosecution" | "defense";
  admitted: boolean | null;
  timestamp: string;
};

export type JurySentiment = {
  prosecution: number;
  defense: number;
  neutral: number;
};

export type Verdict = {
  outcome: string;
  summary: string;
  timestamp: string;
};

export type CaseSession = {
  caseId: string;
  title: string;
  caseText: string;
  legalSystem: LegalSystem;
  demeanor: AIDemeanor;
  phase: CourtPhase;
  roles: RoleAssignment;
  transcript: TranscriptEntry[];
  developments: Development[];
  persons: CasePerson[];
  activeWitness: ActiveWitness | null;
  evidence: EvidenceItem[];
  jurySentiment: JurySentiment;
  verdict?: Verdict;
  createdAt: string;
  updatedAt: string;
};

export async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
}

function getCasePath(caseId: string): string {
  return path.join(DATA_DIR, `${caseId}.json`);
}

export async function saveCase(session: CaseSession): Promise<void> {
  await ensureDataDir();
  session.updatedAt = new Date().toISOString();
  await writeFile(getCasePath(session.caseId), JSON.stringify(session, null, 2), "utf-8");
}

export async function loadCase(caseId: string): Promise<CaseSession | null> {
  const filePath = getCasePath(caseId);
  if (!existsSync(filePath)) return null;
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<CaseSession>;
    return {
      persons: [],
      activeWitness: null,
      legalSystem: "general",
      demeanor: "formal",
      evidence: [],
      jurySentiment: { prosecution: 40, defense: 40, neutral: 20 },
      ...parsed,
    } as CaseSession;
  } catch (err) {
    logger.error({ caseId, err }, "Failed to load case from disk");
    return null;
  }
}

export async function deleteCase(caseId: string): Promise<boolean> {
  const filePath = getCasePath(caseId);
  if (!existsSync(filePath)) return false;
  await rm(filePath);
  return true;
}

export async function listCases(): Promise<
  Array<Pick<CaseSession, "caseId" | "title" | "phase" | "createdAt" | "legalSystem" | "demeanor"> & { verdict?: Verdict }>
> {
  await ensureDataDir();
  try {
    const files = await readdir(DATA_DIR);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));
    const cases = await Promise.all(
      jsonFiles.map(async (file) => {
        try {
          const raw = await readFile(path.join(DATA_DIR, file), "utf-8");
          const session = JSON.parse(raw) as CaseSession;
          return {
            caseId: session.caseId,
            title: session.title,
            phase: session.phase,
            createdAt: session.createdAt,
            legalSystem: session.legalSystem ?? "general",
            demeanor: session.demeanor ?? "formal",
            verdict: session.verdict,
          };
        } catch {
          return null;
        }
      })
    );
    return cases.filter(Boolean) as Array<Pick<CaseSession, "caseId" | "title" | "phase" | "createdAt" | "legalSystem" | "demeanor"> & { verdict?: Verdict }>;
  } catch {
    return [];
  }
}

export function createNewCase(
  title: string,
  caseText: string,
  roles: RoleAssignment,
  legalSystem: LegalSystem = "general",
  demeanor: AIDemeanor = "formal"
): CaseSession {
  const caseId = randomUUID();
  const now = new Date().toISOString();

  const openingEntry: TranscriptEntry = {
    id: randomUUID(),
    role: "system",
    speaker: "Court",
    content: `Court is now in session. The Honorable Judge presiding. This is the matter of: ${title}. All parties are present. Proceedings will begin with Pre-Trial Motions.`,
    timestamp: now,
    controlledBy: "system",
  };

  return {
    caseId,
    title,
    caseText,
    legalSystem,
    demeanor,
    phase: "pre_trial_motions",
    roles,
    transcript: [openingEntry],
    developments: [],
    persons: [],
    activeWitness: null,
    evidence: [],
    jurySentiment: { prosecution: 40, defense: 40, neutral: 20 },
    createdAt: now,
    updatedAt: now,
  };
}

export function addTranscriptEntry(
  session: CaseSession,
  role: "judge" | "prosecutor" | "defense" | "system" | "witness",
  content: string,
  controlledBy: "user" | "ai" | "system",
  speakerOverride?: string
): TranscriptEntry {
  const defaultNames: Record<string, string> = {
    judge: "The Honorable Judge",
    prosecutor: "Prosecution Counsel",
    defense: "Defense Counsel",
    system: "Court",
    witness: "Witness",
  };

  const entry: TranscriptEntry = {
    id: randomUUID(),
    role,
    speaker: speakerOverride ?? defaultNames[role] ?? role,
    content,
    timestamp: new Date().toISOString(),
    controlledBy,
  };

  session.transcript.push(entry);

  // Update jury sentiment based on AI entries
  if (controlledBy === "ai" && (role === "prosecutor" || role === "defense")) {
    const shift = Math.floor(Math.random() * 5) + 1;
    if (role === "prosecutor") {
      session.jurySentiment.prosecution = Math.min(85, session.jurySentiment.prosecution + shift);
      session.jurySentiment.defense = Math.max(15, session.jurySentiment.defense - shift);
    } else {
      session.jurySentiment.defense = Math.min(85, session.jurySentiment.defense + shift);
      session.jurySentiment.prosecution = Math.max(15, session.jurySentiment.prosecution - shift);
    }
  }

  return entry;
}

export function addDevelopment(
  session: CaseSession,
  title: string,
  content: string
): Development {
  const dev: Development = {
    id: randomUUID(),
    title,
    content,
    timestamp: new Date().toISOString(),
  };
  session.developments.push(dev);

  const announcementEntry: TranscriptEntry = {
    id: randomUUID(),
    role: "system",
    speaker: "Court",
    content: `[NEW CASE DEVELOPMENT FILED]: "${title}" — ${content.slice(0, 200)}${content.length > 200 ? "..." : ""}`,
    timestamp: new Date().toISOString(),
    controlledBy: "system",
  };
  session.transcript.push(announcementEntry);

  return dev;
}

export function addEvidence(
  session: CaseSession,
  title: string,
  description: string,
  submittedBy: "prosecution" | "defense"
): EvidenceItem {
  const exhibitLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const usedExhibits = new Set(session.evidence.map((e) => e.exhibit.replace(/^Exhibit\s+/i, "")));
  let exhibitLabel = "A";
  for (const letter of exhibitLetters) {
    if (!usedExhibits.has(letter)) {
      exhibitLabel = letter;
      break;
    }
  }

  const item: EvidenceItem = {
    id: randomUUID(),
    exhibit: `Exhibit ${exhibitLabel}`,
    title,
    description,
    submittedBy,
    admitted: null,
    timestamp: new Date().toISOString(),
  };
  session.evidence.push(item);

  const announcementEntry: TranscriptEntry = {
    id: randomUUID(),
    role: "system",
    speaker: "Court",
    content: `[EVIDENCE SUBMITTED]: ${item.exhibit} — "${title}" (submitted by ${submittedBy === "prosecution" ? "Prosecution" : "Defense"})`,
    timestamp: new Date().toISOString(),
    controlledBy: "system",
  };
  session.transcript.push(announcementEntry);

  return item;
}
