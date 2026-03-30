import { Router, type IRouter } from "express";
import {
  createNewCase,
  loadCase,
  saveCase,
  deleteCase,
  listCases as listAllCases,
  addDevelopment,
  addTranscriptEntry,
  type RoleAssignment,
  type CourtPhase,
} from "../lib/memory.js";
import { PHASE_LABELS } from "../lib/prompts.js";
import { extractPersonsFromText, mergePersons } from "../lib/aiEngine.js";

const router: IRouter = Router();

router.get("/cases", async (req, res) => {
  const cases = await listAllCases();
  cases.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  res.json({ cases });
});

router.post("/cases", async (req, res) => {
  const { title, caseText, roles } = req.body as {
    title?: string;
    caseText?: string;
    roles?: RoleAssignment;
  };

  if (!title || !caseText || !roles) {
    res.status(400).json({ error: "title, caseText, and roles are required" });
    return;
  }

  if (!["user", "ai"].includes(roles.judge) ||
      !["user", "ai"].includes(roles.prosecutor) ||
      !["user", "ai"].includes(roles.defense)) {
    res.status(400).json({ error: "Each role must be 'user' or 'ai'" });
    return;
  }

  const session = createNewCase(title, caseText, roles);
  await saveCase(session);

  extractPersonsFromText(caseText)
    .then((extracted) => {
      session.persons = mergePersons(session.persons, extracted);
      return saveCase(session);
    })
    .catch(() => {});

  res.status(201).json(session);
});

router.get("/cases/:caseId", async (req, res) => {
  const { caseId } = req.params;
  const session = await loadCase(caseId);

  if (!session) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  res.json(session);
});

router.delete("/cases/:caseId", async (req, res) => {
  const { caseId } = req.params;
  const deleted = await deleteCase(caseId);

  if (!deleted) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  res.json({ success: true });
});

router.put("/cases/:caseId/roles", async (req, res) => {
  const { caseId } = req.params;
  const { roles } = req.body as { roles?: RoleAssignment };

  if (!roles) {
    res.status(400).json({ error: "roles is required" });
    return;
  }

  const session = await loadCase(caseId);
  if (!session) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  session.roles = roles;
  await saveCase(session);

  res.json(session);
});

router.post("/cases/:caseId/developments", async (req, res) => {
  const { caseId } = req.params;
  const { title, content } = req.body as {
    title?: string;
    content?: string;
  };

  if (!title || !content) {
    res.status(400).json({ error: "title and content are required" });
    return;
  }

  const session = await loadCase(caseId);
  if (!session) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  addDevelopment(session, title, content);
  await saveCase(session);

  extractPersonsFromText(`${title}: ${content}`)
    .then((extracted) => {
      session.persons = mergePersons(session.persons, extracted);
      return saveCase(session);
    })
    .catch(() => {});

  res.json(session);
});

router.put("/cases/:caseId/phase", async (req, res) => {
  const { caseId } = req.params;
  const { phase } = req.body as { phase?: CourtPhase };

  const validPhases: CourtPhase[] = [
    "opening_statements",
    "prosecution_case",
    "defense_case",
    "closing_arguments",
    "verdict",
    "concluded",
  ];

  if (!phase || !validPhases.includes(phase)) {
    res.status(400).json({ error: "Invalid phase value" });
    return;
  }

  const session = await loadCase(caseId);
  if (!session) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  const oldPhase = session.phase;
  session.phase = phase;

  if (oldPhase !== phase) {
    const phaseLabel = PHASE_LABELS[phase] ?? phase.replace(/_/g, " ");
    addTranscriptEntry(
      session,
      "system",
      `⚖️ The court has advanced to: ${phaseLabel.toUpperCase()}`,
      "system"
    );
  }

  await saveCase(session);
  res.json(session);
});

export default router;
