import { Router, type IRouter, type Response } from "express";
import { loadCase, addTranscriptEntry, saveCase, type TranscriptEntry } from "../lib/memory.js";
import {
  streamAiStatement,
  streamAllAiStatements,
  streamNextAiResponse,
  generateAllAiStatements,
} from "../lib/aiEngine.js";

const router: IRouter = Router();

type Role = "judge" | "prosecutor" | "defense";

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

router.post("/cases/:caseId/speak/stream", async (req, res) => {
  const { caseId } = req.params;
  const { role, content, triggerAiResponse = true } = req.body as {
    role?: Role;
    content?: string;
    triggerAiResponse?: boolean;
  };

  if (!role || !content) {
    res.status(400).json({ error: "role and content are required" });
    return;
  }

  const validRoles: Role[] = ["judge", "prosecutor", "defense"];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: "role must be judge, prosecutor, or defense" });
    return;
  }

  const session = await loadCase(caseId);
  if (!session) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  if (session.roles[role] !== "user") {
    res.status(400).json({ error: `Role '${role}' is controlled by AI, not the user` });
    return;
  }

  setupSSE(res);

  const userEntry = addTranscriptEntry(session, role, content, "user");
  await saveCase(session);
  sseEvent(res, "user_entry", { entry: userEntry });

  if (triggerAiResponse) {
    await streamNextAiResponse(
      session,
      role,
      (aiRole) => sseEvent(res, "ai_start", { role: aiRole }),
      (aiRole, token) => sseEvent(res, "token", { role: aiRole, token }),
      (aiRole, entry) => sseEvent(res, "ai_entry", { role: aiRole, entry })
    );
  }

  sseEvent(res, "done", {});
  res.end();
});

router.post("/cases/:caseId/ai-turn/stream", async (req, res) => {
  const { caseId } = req.params;
  const { role, context } = req.body as { role?: Role; context?: string };

  if (!role) {
    res.status(400).json({ error: "role is required" });
    return;
  }

  const validRoles: Role[] = ["judge", "prosecutor", "defense"];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: "role must be judge, prosecutor, or defense" });
    return;
  }

  const session = await loadCase(caseId);
  if (!session) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  if (session.roles[role] !== "ai") {
    res.status(400).json({ error: `Role '${role}' is controlled by the user, not AI` });
    return;
  }

  setupSSE(res);
  sseEvent(res, "ai_start", { role });

  const entry = await streamAiStatement(
    session,
    role,
    (token) => sseEvent(res, "token", { role, token }),
    context
  );

  sseEvent(res, "ai_entry", { role, entry });
  sseEvent(res, "done", {});
  res.end();
});

router.post("/cases/:caseId/auto-proceed/stream", async (req, res) => {
  const { caseId } = req.params;

  const session = await loadCase(caseId);
  if (!session) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  setupSSE(res);

  await streamAllAiStatements(
    session,
    (role) => sseEvent(res, "ai_start", { role }),
    (role, token) => sseEvent(res, "token", { role, token }),
    (role, entry) => sseEvent(res, "ai_entry", { role, entry })
  );

  sseEvent(res, "done", {});
  res.end();
});

router.post("/cases/:caseId/speak", async (req, res) => {
  const { caseId } = req.params;
  const { role, content, triggerAiResponses = true } = req.body as {
    role?: Role;
    content?: string;
    triggerAiResponses?: boolean;
  };

  if (!role || !content) {
    res.status(400).json({ error: "role and content are required" });
    return;
  }

  const session = await loadCase(caseId);
  if (!session) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  if (session.roles[role] !== "user") {
    res.status(400).json({ error: `Role '${role}' is controlled by AI, not the user` });
    return;
  }

  const userEntry = addTranscriptEntry(session, role, content, "user");
  await saveCase(session);

  let aiResponses: TranscriptEntry[] = [];
  if (triggerAiResponses) {
    const validRoles: Role[] = ["judge", "prosecutor", "defense"];
    const nextRole = validRoles.find((r) => r !== role && session.roles[r] === "ai");
    if (nextRole) {
      const { generateAiStatement } = await import("../lib/aiEngine.js");
      const entry = await generateAiStatement(session, nextRole);
      aiResponses = [entry];
    }
  }

  res.json({ userEntry, aiResponses, updatedTranscript: session.transcript });
});

router.post("/cases/:caseId/ai-turn", async (req, res) => {
  const { caseId } = req.params;
  const { role, context } = req.body as { role?: Role; context?: string };

  if (!role) {
    res.status(400).json({ error: "role is required" });
    return;
  }

  const session = await loadCase(caseId);
  if (!session) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  if (session.roles[role] !== "ai") {
    res.status(400).json({ error: `Role '${role}' is controlled by the user, not AI` });
    return;
  }

  const { generateAiStatement } = await import("../lib/aiEngine.js");
  const entry = await generateAiStatement(session, role, context);
  res.json({ entry, updatedTranscript: session.transcript });
});

router.post("/cases/:caseId/auto-proceed", async (req, res) => {
  const { caseId } = req.params;
  const session = await loadCase(caseId);
  if (!session) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  const entries = await generateAllAiStatements(session);
  res.json({ entries, updatedTranscript: session.transcript });
});

export default router;
