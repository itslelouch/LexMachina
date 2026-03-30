import { Router, type IRouter } from "express";
import { loadCase, saveCase, addEvidence } from "../lib/memory.js";

const router: IRouter = Router();

router.get("/cases/:caseId/evidence", async (req, res) => {
  const { caseId } = req.params;
  const session = await loadCase(caseId);
  if (!session) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  res.json({ evidence: session.evidence ?? [] });
});

router.post("/cases/:caseId/evidence", async (req, res) => {
  const { caseId } = req.params;
  const { title, description, submittedBy } = req.body as {
    title?: string;
    description?: string;
    submittedBy?: "prosecution" | "defense";
  };

  if (!title || !description || !submittedBy) {
    res.status(400).json({ error: "title, description, and submittedBy are required" });
    return;
  }

  if (!["prosecution", "defense"].includes(submittedBy)) {
    res.status(400).json({ error: "submittedBy must be 'prosecution' or 'defense'" });
    return;
  }

  const session = await loadCase(caseId);
  if (!session) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  const item = addEvidence(session, title, description, submittedBy);
  await saveCase(session);
  res.status(201).json({ item, evidence: session.evidence });
});

router.patch("/cases/:caseId/evidence/:evidenceId", async (req, res) => {
  const { caseId, evidenceId } = req.params;
  const { admitted } = req.body as { admitted?: boolean | null };

  if (admitted === undefined) {
    res.status(400).json({ error: "admitted (true/false/null) is required" });
    return;
  }

  const session = await loadCase(caseId);
  if (!session) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  const item = session.evidence.find((e) => e.id === evidenceId);
  if (!item) {
    res.status(404).json({ error: "Evidence item not found" });
    return;
  }

  item.admitted = admitted;
  await saveCase(session);
  res.json({ item, evidence: session.evidence });
});

router.delete("/cases/:caseId/evidence/:evidenceId", async (req, res) => {
  const { caseId, evidenceId } = req.params;

  const session = await loadCase(caseId);
  if (!session) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  session.evidence = session.evidence.filter((e) => e.id !== evidenceId);
  await saveCase(session);
  res.json({ evidence: session.evidence });
});

export default router;
