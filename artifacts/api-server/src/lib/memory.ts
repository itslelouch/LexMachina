import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { logger } from "./logger.js";

const DATA_DIR = path.join(process.cwd(), "data", "cases");

export type RoleController = "user" | "ai";
export type CourtPhase =
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

export type CaseSession = {
  caseId: string;
  title: string;
  caseText: string;
  phase: CourtPhase;
  roles: RoleAssignment;
  transcript: TranscriptEntry[];
  developments: Development[];
  persons: CasePerson[];
  activeWitness: ActiveWitness | null;
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
  Array<Pick<CaseSession, "caseId" | "title" | "phase" | "createdAt">>
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
          };
        } catch {
          return null;
        }
      })
    );
    return cases.filter(Boolean) as Array<Pick<CaseSession, "caseId" | "title" | "phase" | "createdAt">>;
  } catch {
    return [];
  }
}

export function createNewCase(
  title: string,
  caseText: string,
  roles: RoleAssignment
): CaseSession {
  const caseId = randomUUID();
  const now = new Date().toISOString();

  const openingEntry: TranscriptEntry = {
    id: randomUUID(),
    role: "system",
    speaker: "Court",
    content: `Court is now in session. The Honorable Judge presiding. This is the matter of: ${title}. All parties are present. Proceedings will begin with Opening Statements.`,
    timestamp: now,
    controlledBy: "system",
  };

  return {
    caseId,
    title,
    caseText,
    phase: "opening_statements",
    roles,
    transcript: [openingEntry],
    developments: [],
    persons: [],
    activeWitness: null,
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
