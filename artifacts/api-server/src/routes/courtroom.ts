import { Router, type IRouter } from "express";
import { loadCase, addTranscriptEntry, saveCase } from "../lib/memory.js";
import {
  generateAiStatement,
  generateAiResponsesAfterUserSpoke,
  generateAllAiStatements,
} from "../lib/aiEngine.js";

const router: IRouter = Router();

router.post("/cases/:caseId/speak", async (req, res) => {
  const { caseId } = req.params;
  const {
    role,
    content,
    triggerAiResponses = true,
  } = req.body as {
    role?: "judge" | "prosecutor" | "defense";
    content?: string;
    triggerAiResponses?: boolean;
  };

  if (!role || !content) {
    res.status(400).json({ error: "role and content are required" });
    return;
  }

  const validRoles = ["judge", "prosecutor", "defense"];
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
    res.status(400).json({
      error: `Role '${role}' is controlled by AI, not the user`,
    });
    return;
  }

  const userEntry = addTranscriptEntry(session, role, content, "user");
  await saveCase(session);

  let aiResponses = [];
  if (triggerAiResponses) {
    aiResponses = await generateAiResponsesAfterUserSpoke(session, role);
  }

  res.json({
    userEntry,
    aiResponses,
    updatedTranscript: session.transcript,
  });
});

router.post("/cases/:caseId/ai-turn", async (req, res) => {
  const { caseId } = req.params;
  const { role, context } = req.body as {
    role?: "judge" | "prosecutor" | "defense";
    context?: string;
  };

  if (!role) {
    res.status(400).json({ error: "role is required" });
    return;
  }

  const validRoles = ["judge", "prosecutor", "defense"];
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
    res.status(400).json({
      error: `Role '${role}' is controlled by the user, not AI`,
    });
    return;
  }

  const entry = await generateAiStatement(session, role, context);

  res.json({
    entry,
    updatedTranscript: session.transcript,
  });
});

router.post("/cases/:caseId/auto-proceed", async (req, res) => {
  const { caseId } = req.params;

  const session = await loadCase(caseId);
  if (!session) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  const entries = await generateAllAiStatements(session);

  res.json({
    entries,
    updatedTranscript: session.transcript,
  });
});

export default router;
