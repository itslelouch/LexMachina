import { Router, type IRouter, type Response } from "express";
import { loadCase, saveCase, type CasePerson } from "../lib/memory.js";
import { extractPersonsFromText } from "../lib/aiEngine.js";
import { randomUUID } from "node:crypto";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

function setupSSE(res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
}

function sseEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function sseError(res: Response, message: string) {
  try {
    res.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
  } catch { /* already closed */ }
}

router.get("/cases/:caseId/persons", async (req, res) => {
  const { caseId } = req.params;
  const session = await loadCase(caseId);
  if (!session) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  res.json({ persons: session.persons, activeWitness: session.activeWitness });
});

router.post("/cases/:caseId/persons/extract", async (req, res) => {
  const { caseId } = req.params;
  const session = await loadCase(caseId);
  if (!session) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  const fullText = [
    session.caseText,
    ...session.developments.map((d) => `${d.title}: ${d.content}`),
  ].join("\n\n");

  const extracted = await extractPersonsFromText(fullText);
  const existingIds: Record<string, string> = {};
  session.persons.forEach(p => { existingIds[p.name.toLowerCase()] = p.id; });
  session.persons = extracted.map(p => ({
    id: existingIds[p.name.toLowerCase()] ?? randomUUID(),
    ...p,
  }));
  await saveCase(session);

  res.json({ persons: session.persons });
});

router.post("/cases/:caseId/witness/call", async (req, res) => {
  const { caseId } = req.params;
  const { personId } = req.body as { personId?: string };

  if (!personId) {
    res.status(400).json({ error: "personId is required" });
    return;
  }

  const session = await loadCase(caseId);
  if (!session) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  const person = session.persons.find((p) => p.id === personId);
  if (!person) {
    res.status(404).json({ error: "Person not found in case" });
    return;
  }

  if (person.deceased) {
    res.status(400).json({ error: `${person.name} is deceased and cannot be called to testify` });
    return;
  }

  if (session.activeWitness) {
    const prev = session.activeWitness;
    session.transcript.push({
      id: randomUUID(),
      role: "system",
      speaker: "Court",
      content: `${prev.name} has been excused from the stand.`,
      timestamp: new Date().toISOString(),
      controlledBy: "system",
    });
  }

  session.activeWitness = {
    personId: person.id,
    name: person.name,
    role: person.role,
    context: person.context,
  };

  session.transcript.push({
    id: randomUUID(),
    role: "system",
    speaker: "Court",
    content: `${person.name} (${person.role}) has been called to the stand and sworn in.`,
    timestamp: new Date().toISOString(),
    controlledBy: "system",
  });

  await saveCase(session);
  res.json({ session });
});

router.post("/cases/:caseId/witness/dismiss", async (req, res) => {
  const { caseId } = req.params;
  const session = await loadCase(caseId);
  if (!session) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  if (session.activeWitness) {
    const name = session.activeWitness.name;
    session.transcript.push({
      id: randomUUID(),
      role: "system",
      speaker: "Court",
      content: `${name} has been dismissed from the stand. Thank you for your testimony.`,
      timestamp: new Date().toISOString(),
      controlledBy: "system",
    });
    session.activeWitness = null;
    await saveCase(session);
  }

  res.json({ session });
});

router.post("/cases/:caseId/witness/respond/stream", async (req, res) => {
  const { caseId } = req.params;
  const { question } = req.body as { question?: string };

  if (!question) {
    res.status(400).json({ error: "question is required" });
    return;
  }

  const session = await loadCase(caseId);
  if (!session) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  if (!session.activeWitness) {
    res.status(400).json({ error: "No witness is currently on the stand" });
    return;
  }

  setupSSE(res);
  sseEvent(res, "witness_start", { name: session.activeWitness.name });

  try {
    const { streamWitnessResponse } = await import("../lib/aiEngine.js");
    const entry = await streamWitnessResponse(session, question, (token) =>
      sseEvent(res, "token", { token })
    );
    sseEvent(res, "witness_entry", { entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ caseId, err: message }, "witness/respond/stream failed");
    sseError(res, message);
  }

  sseEvent(res, "done", {});
  res.end();
});

router.post("/cases/:caseId/persons/add", async (req, res) => {
  const { caseId } = req.params;
  const { name, role, context } = req.body as {
    name?: string;
    role?: string;
    context?: string;
  };

  if (!name || !role || !context) {
    res.status(400).json({ error: "name, role, and context are required" });
    return;
  }

  const session = await loadCase(caseId);
  if (!session) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  const exists = session.persons.some(
    (p) => p.name.toLowerCase() === name.toLowerCase()
  );
  if (!exists) {
    session.persons.push({ id: randomUUID(), name, role, context });
    await saveCase(session);
  }

  res.json({ persons: session.persons });
});

export default router;
