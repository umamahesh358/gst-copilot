import { Router } from "express";
import { db } from "@workspace/db";
import { aiAgentRunsTable, aiAgentStepsTable, auditLogsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/agent-runs", requireAuth, async (req: AuthRequest, res) => {
  const runs = await db
    .select()
    .from(aiAgentRunsTable)
    .where(eq(aiAgentRunsTable.userId, req.userId!))
    .orderBy(desc(aiAgentRunsTable.createdAt))
    .limit(50);
  res.json({ runs });
});

router.post("/agent-runs", requireAuth, async (req: AuthRequest, res) => {
  const { title, goal } = req.body;
  if (!title || !goal) {
    res.status(400).json({ error: "Validation error", message: "title and goal are required" });
    return;
  }

  const steps = generateAgentPlan(goal);

  const [run] = await db.insert(aiAgentRunsTable).values({
    userId: req.userId!,
    title,
    goal,
    status: "planned",
    totalSteps: steps.length,
    completedSteps: 0,
    startedAt: new Date(),
  }).returning();

  const stepRows = await db.insert(aiAgentStepsTable).values(
    steps.map((s, i) => ({
      agentRunId: run.id,
      stepNumber: i + 1,
      stepType: s.type,
      description: s.description,
      status: "pending",
      requiresConfirmation: s.requiresConfirmation ? 1 : 0,
    }))
  ).returning();

  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "create",
    entity: "agent_run",
    entityId: String(run.id),
    description: `Started agent run: ${title}`,
  });

  res.status(201).json({ run, steps: stepRows });
});

router.get("/agent-runs/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  const [run] = await db.select().from(aiAgentRunsTable).where(
    and(eq(aiAgentRunsTable.id, id), eq(aiAgentRunsTable.userId, req.userId!))
  );
  if (!run) { res.status(404).json({ error: "Not found" }); return; }

  const steps = await db.select().from(aiAgentStepsTable)
    .where(eq(aiAgentStepsTable.agentRunId, id))
    .orderBy(aiAgentStepsTable.stepNumber);

  res.json({ run, steps });
});

router.post("/agent-runs/:id/execute", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  const [run] = await db.select().from(aiAgentRunsTable).where(
    and(eq(aiAgentRunsTable.id, id), eq(aiAgentRunsTable.userId, req.userId!))
  );
  if (!run) { res.status(404).json({ error: "Not found" }); return; }

  const steps = await db.select().from(aiAgentStepsTable)
    .where(and(eq(aiAgentStepsTable.agentRunId, id), eq(aiAgentStepsTable.status, "pending")))
    .orderBy(aiAgentStepsTable.stepNumber)
    .limit(1);

  if (!steps.length) {
    await db.update(aiAgentRunsTable).set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(aiAgentRunsTable.id, id));
    res.json({ message: "All steps completed", run: { ...run, status: "completed" } });
    return;
  }

  const step = steps[0];
  if (step.requiresConfirmation !== 0 && !req.body.confirmed) {
    res.json({ requiresConfirmation: true, step });
    return;
  }

  const result = simulateStepExecution(step);
  const [updatedStep] = await db.update(aiAgentStepsTable).set({
    status: "completed",
    output: result,
    executedAt: new Date(),
    confidenceScore: result.confidence,
  }).where(eq(aiAgentStepsTable.id, step.id)).returning();

  const completed = run.completedSteps + 1;
  const isDone = completed >= run.totalSteps;
  await db.update(aiAgentRunsTable).set({
    completedSteps: completed,
    status: isDone ? "completed" : "running",
    result: isDone ? "Agent run completed successfully." : undefined,
    completedAt: isDone ? new Date() : undefined,
    updatedAt: new Date(),
  }).where(eq(aiAgentRunsTable.id, id));

  res.json({ step: updatedStep, progress: { completed, total: run.totalSteps, done: isDone } });
});

router.post("/agent-runs/:id/cancel", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  await db.update(aiAgentRunsTable).set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(aiAgentRunsTable.id, id), eq(aiAgentRunsTable.userId, req.userId!)));
  await db.update(aiAgentStepsTable).set({ status: "cancelled" })
    .where(and(eq(aiAgentStepsTable.agentRunId, id), eq(aiAgentStepsTable.status, "pending")));
  res.json({ success: true });
});

router.delete("/agent-runs/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  await db.delete(aiAgentStepsTable).where(eq(aiAgentStepsTable.agentRunId, id));
  await db.delete(aiAgentRunsTable).where(
    and(eq(aiAgentRunsTable.id, id), eq(aiAgentRunsTable.userId, req.userId!))
  );
  res.json({ success: true });
});

function generateAgentPlan(goal: string) {
  const g = goal.toLowerCase();
  if (g.includes("reconcil") || g.includes("match")) {
    return [
      { type: "analyze", description: "Analyze unmatched transactions and open invoices", requiresConfirmation: false },
      { type: "suggest", description: "Generate reconciliation candidates with confidence scores", requiresConfirmation: false },
      { type: "review", description: "Present matches for review and approval", requiresConfirmation: true },
    ];
  }
  if (g.includes("invoice") || g.includes("draft")) {
    return [
      { type: "gather", description: "Gather customer details and pending items", requiresConfirmation: false },
      { type: "draft", description: "Draft invoice with line items and amounts", requiresConfirmation: false },
      { type: "confirm", description: "Confirm and create invoice", requiresConfirmation: true },
    ];
  }
  if (g.includes("overdue") || g.includes("follow") || g.includes("reminder")) {
    return [
      { type: "analyze", description: "Identify overdue invoices and customer contacts", requiresConfirmation: false },
      { type: "draft", description: "Draft follow-up tasks and reminder messages", requiresConfirmation: false },
      { type: "confirm", description: "Confirm task creation and schedule reminders", requiresConfirmation: true },
    ];
  }
  if (g.includes("expense") || g.includes("categori")) {
    return [
      { type: "analyze", description: "Review uncategorized expenses", requiresConfirmation: false },
      { type: "suggest", description: "Suggest categories based on description patterns", requiresConfirmation: false },
      { type: "apply", description: "Apply categorizations to selected expenses", requiresConfirmation: true },
    ];
  }
  return [
    { type: "analyze", description: "Analyze the request and gather relevant data", requiresConfirmation: false },
    { type: "plan", description: "Create execution plan with recommended actions", requiresConfirmation: false },
    { type: "execute", description: "Execute planned actions with confirmations", requiresConfirmation: true },
  ];
}

function simulateStepExecution(step: { stepType: string; description: string }) {
  return {
    summary: `Completed: ${step.description}`,
    confidence: 0.85 + Math.random() * 0.15,
    itemsProcessed: Math.floor(Math.random() * 20) + 1,
    timestamp: new Date().toISOString(),
  };
}

export default router;
