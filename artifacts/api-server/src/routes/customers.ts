import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, invoicesTable, activityLogTable } from "@workspace/db";
import { eq, ilike, and, sql } from "drizzle-orm";
import { CreateCustomerBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/customers", requireAuth, async (req: AuthRequest, res) => {
  const search = req.query.search as string | undefined;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  const conditions = [eq(customersTable.userId, req.userId!)];
  if (search) {
    conditions.push(ilike(customersTable.name, `%${search}%`));
  }

  const total = await db.select({ count: sql<number>`count(*)` })
    .from(customersTable)
    .where(and(...conditions));

  const customers = await db.select().from(customersTable)
    .where(and(...conditions))
    .orderBy(customersTable.createdAt)
    .limit(limit)
    .offset(offset);

  const customerIds = customers.map(c => c.id);
  const invoiceSummaries = customerIds.length > 0
    ? await db.select({
        customerId: invoicesTable.customerId,
        totalInvoices: sql<number>`count(*)`,
        totalSpent: sql<number>`sum(${invoicesTable.totalAmount})`,
      })
        .from(invoicesTable)
        .where(sql`${invoicesTable.customerId} = ANY(${sql`ARRAY[${sql.join(customerIds.map(id => sql`${id}`), sql`, `)}]::integer[]`})`)
        .groupBy(invoicesTable.customerId)
    : [];

  const summaryMap = new Map(invoiceSummaries.map(s => [s.customerId, s]));

  const enriched = customers.map(c => ({
    ...c,
    totalInvoices: summaryMap.get(c.id)?.totalInvoices ?? 0,
    totalSpent: parseFloat(String(summaryMap.get(c.id)?.totalSpent ?? 0)),
  }));

  res.json({ customers: enriched, total: Number(total[0]?.count ?? 0), page, limit });
});

router.post("/customers", requireAuth, async (req: AuthRequest, res) => {
  const result = CreateCustomerBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation error", message: result.error.message });
    return;
  }

  const [customer] = await db.insert(customersTable).values({ ...result.data, userId: req.userId! }).returning();

  await db.insert(activityLogTable).values({
    userId: req.userId!,
    type: "customer_added",
    title: "New customer added",
    description: `Customer "${customer.name}" was added`,
  });

  res.status(201).json({ ...customer, totalInvoices: 0, totalSpent: 0 });
});

router.put("/customers/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID", message: "ID must be a number" }); return; }
  const { name, email, phone, gstNumber, address, city, state } = req.body;

  const [existing] = await db.select().from(customersTable).where(and(eq(customersTable.id, id), eq(customersTable.userId, req.userId!))).limit(1);
  if (!existing) { res.status(404).json({ error: "Not found", message: "Customer not found" }); return; }

  const [customer] = await db.update(customersTable).set({
    name: name ?? existing.name,
    email: email ?? existing.email,
    phone: phone ?? existing.phone,
    gstNumber: gstNumber ?? existing.gstNumber,
    address: address ?? existing.address,
    city: city ?? existing.city,
    state: state ?? existing.state,
    updatedAt: new Date(),
  }).where(and(eq(customersTable.id, id), eq(customersTable.userId, req.userId!))).returning();

  await db.insert(activityLogTable).values({
    userId: req.userId!,
    type: "customer_updated",
    title: "Customer updated",
    description: `Customer "${customer.name}" was updated`,
  });

  res.json({ ...customer, totalInvoices: 0, totalSpent: 0 });
});

router.delete("/customers/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID", message: "ID must be a number" }); return; }
  const [existing] = await db.select().from(customersTable).where(and(eq(customersTable.id, id), eq(customersTable.userId, req.userId!))).limit(1);
  if (!existing) { res.status(404).json({ error: "Not found", message: "Customer not found" }); return; }

  await db.delete(customersTable).where(and(eq(customersTable.id, id), eq(customersTable.userId, req.userId!)));

  await db.insert(activityLogTable).values({
    userId: req.userId!,
    type: "customer_deleted",
    title: "Customer deleted",
    description: `Customer "${existing.name}" was removed`,
  });

  res.json({ success: true, message: `Customer "${existing.name}" deleted` });
});

router.get("/customers/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID", message: "ID must be a number" }); return; }
  const [customer] = await db.select().from(customersTable)
    .where(and(eq(customersTable.id, id), eq(customersTable.userId, req.userId!)))
    .limit(1);

  if (!customer) {
    res.status(404).json({ error: "Not found", message: "Customer not found" });
    return;
  }

  const [summary] = await db.select({
    totalInvoices: sql<number>`count(*)`,
    totalSpent: sql<number>`sum(${invoicesTable.totalAmount})`,
  })
    .from(invoicesTable)
    .where(eq(invoicesTable.customerId, id));

  res.json({
    ...customer,
    totalInvoices: Number(summary?.totalInvoices ?? 0),
    totalSpent: parseFloat(String(summary?.totalSpent ?? 0)),
  });
});

export default router;
