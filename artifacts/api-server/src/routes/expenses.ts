import { Router } from "express";
import { db } from "@workspace/db";
import { expensesTable, auditLogsTable } from "@workspace/db";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

function generateExpenseNumber() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `EXP-${y}${m}-${rand}`;
}

router.get("/expenses", requireAuth, async (req: AuthRequest, res) => {
  const { status, category, from, to } = req.query as Record<string, string | undefined>;

  const conditions = [
    eq(expensesTable.userId, req.userId!),
    eq(expensesTable.isDeleted, false),
  ];
  if (status) conditions.push(eq(expensesTable.status, status));
  if (category) conditions.push(eq(expensesTable.category, category));
  if (from) conditions.push(gte(expensesTable.expenseDate, from));
  if (to) conditions.push(lte(expensesTable.expenseDate, to));

  const expenses = await db
    .select()
    .from(expensesTable)
    .where(and(...conditions))
    .orderBy(desc(expensesTable.createdAt));

  res.json({ expenses });
});

router.get("/expenses/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const [expense] = await db
    .select()
    .from(expensesTable)
    .where(and(eq(expensesTable.id, id), eq(expensesTable.userId, req.userId!)))
    .limit(1);
  if (!expense || expense.isDeleted) {
    res.status(404).json({ error: "Not found", message: "Expense not found" });
    return;
  }
  res.json({ expense });
});

router.post("/expenses", requireAuth, async (req: AuthRequest, res) => {
  const {
    vendorId, vendorName, category, description, amount, gstAmount,
    totalAmount, gstRate, hsnCode, status, paymentMethod, referenceNumber,
    expenseDate, dueDate, notes, isRecurring, recurringPeriod,
  } = req.body;

  if (!expenseDate) {
    res.status(400).json({ error: "Validation error", message: "expenseDate is required" });
    return;
  }

  const amtNum = parseFloat(amount ?? "0");
  const gstNum = parseFloat(gstAmount ?? "0");
  const totalNum = parseFloat(totalAmount ?? String(amtNum + gstNum));

  const [expense] = await db
    .insert(expensesTable)
    .values({
      userId: req.userId!,
      vendorId: vendorId ?? null,
      vendorName: vendorName ?? null,
      expenseNumber: generateExpenseNumber(),
      category: category ?? "general",
      description,
      amount: String(amtNum),
      gstAmount: String(gstNum),
      totalAmount: String(totalNum),
      gstRate: gstRate ? String(gstRate) : "0",
      hsnCode,
      status: status ?? "pending",
      paymentMethod: paymentMethod ?? "bank_transfer",
      referenceNumber,
      expenseDate,
      dueDate,
      notes,
      isRecurring: isRecurring ?? false,
      recurringPeriod,
      approvalStatus: "not_required",
    })
    .returning();

  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "expense_created",
    entity: "expense",
    entityId: String(expense.id),
    description: `Expense created: ${expense.expenseNumber} — ₹${totalNum}`,
  });

  res.status(201).json({ expense });
});

router.put("/expenses/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const {
    vendorId, vendorName, category, description, amount, gstAmount,
    totalAmount, gstRate, hsnCode, status, paymentMethod, referenceNumber,
    expenseDate, dueDate, notes, isRecurring, recurringPeriod,
  } = req.body;

  const [expense] = await db
    .update(expensesTable)
    .set({
      vendorId, vendorName, category, description,
      amount: amount ? String(amount) : undefined,
      gstAmount: gstAmount ? String(gstAmount) : undefined,
      totalAmount: totalAmount ? String(totalAmount) : undefined,
      gstRate: gstRate ? String(gstRate) : undefined,
      hsnCode, status, paymentMethod, referenceNumber,
      expenseDate, dueDate, notes, isRecurring, recurringPeriod,
      updatedAt: new Date(),
    })
    .where(and(eq(expensesTable.id, id), eq(expensesTable.userId, req.userId!)))
    .returning();

  if (!expense) {
    res.status(404).json({ error: "Not found", message: "Expense not found" });
    return;
  }

  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "expense_updated",
    entity: "expense",
    entityId: String(id),
    description: `Expense updated: ${expense.expenseNumber}`,
  });

  res.json({ expense });
});

router.delete("/expenses/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  await db
    .update(expensesTable)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(and(eq(expensesTable.id, id), eq(expensesTable.userId, req.userId!)));

  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "expense_deleted",
    entity: "expense",
    entityId: String(id),
    description: `Expense deleted`,
  });

  res.json({ success: true });
});

export default router;
