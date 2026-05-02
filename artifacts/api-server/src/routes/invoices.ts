import { Router } from "express";
import { db } from "@workspace/db";
import { invoicesTable, invoiceItemsTable, customersTable, productsTable, transactionsTable, activityLogTable } from "@workspace/db";
import { eq, and, ilike, sql } from "drizzle-orm";
import { CreateInvoiceBody, UpdateInvoiceStatusBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

function formatInvoice(inv: typeof invoicesTable.$inferSelect) {
  return {
    ...inv,
    subtotal: parseFloat(inv.subtotal),
    gstAmount: parseFloat(inv.gstAmount),
    totalAmount: parseFloat(inv.totalAmount),
  };
}

router.get("/invoices", requireAuth, async (req: AuthRequest, res) => {
  const search = req.query.search as string | undefined;
  const status = req.query.status as string | undefined;
  const customerId = req.query.customerId ? parseInt(req.query.customerId as string) : undefined;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  let query = db.select().from(invoicesTable);
  const conditions = [];

  if (search) conditions.push(ilike(invoicesTable.invoiceNumber, `%${search}%`));
  if (status) conditions.push(eq(invoicesTable.status, status));
  if (customerId) conditions.push(eq(invoicesTable.customerId, customerId));

  const allInvoices = await db.select().from(invoicesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(sql`${invoicesTable.createdAt} DESC`);

  const total = allInvoices.length;
  const invoices = allInvoices.slice(offset, offset + limit).map(formatInvoice);

  const unpaid = allInvoices.filter(i => i.status === "unpaid" || i.status === "overdue");
  const paid = allInvoices.filter(i => i.status === "paid");
  const totalUnpaid = unpaid.reduce((s, i) => s + parseFloat(i.totalAmount), 0);
  const totalPaid = paid.reduce((s, i) => s + parseFloat(i.totalAmount), 0);

  res.json({ invoices, total, page, limit, totalUnpaid, totalPaid });
});

router.post("/invoices", requireAuth, async (req: AuthRequest, res) => {
  const result = CreateInvoiceBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation error", message: result.error.message });
    return;
  }
  const data = result.data;

  const [count] = await db.select({ count: sql<number>`count(*)` }).from(invoicesTable);
  const nextNum = (Number(count.count) + 1).toString().padStart(4, "0");
  const invoiceNumber = `INV-${nextNum}`;

  let subtotal = 0;
  let gstAmount = 0;
  const itemsData = data.items.map(item => {
    const itemTotal = item.quantity * item.unitPrice;
    const itemGst = itemTotal * (item.gstRate / 100);
    subtotal += itemTotal;
    gstAmount += itemGst;
    return {
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: String(item.unitPrice),
      gstRate: String(item.gstRate),
      gstAmount: String(itemGst),
      total: String(itemTotal + itemGst),
    };
  });
  const totalAmount = subtotal + gstAmount;

  let customerName = data.customerName || "";
  if (data.customerId) {
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, data.customerId)).limit(1);
    if (customer) customerName = customer.name;
  }

  const [invoice] = await db.insert(invoicesTable).values({
    invoiceNumber,
    customerId: data.customerId,
    customerName,
    status: "unpaid",
    subtotal: String(subtotal),
    gstAmount: String(gstAmount),
    totalAmount: String(totalAmount),
    dueDate: data.dueDate,
    notes: data.notes,
  }).returning();

  const items = await db.insert(invoiceItemsTable).values(
    itemsData.map(item => ({ ...item, invoiceId: invoice.id }))
  ).returning();

  for (const item of data.items) {
    if (item.productId) {
      await db.update(productsTable)
        .set({ stockQty: sql`${productsTable.stockQty} - ${item.quantity}`, updatedAt: new Date() })
        .where(and(eq(productsTable.id, item.productId), eq(productsTable.isDeleted, false)));
    }
  }

  await db.insert(transactionsTable).values({
    type: "income",
    category: "Invoice",
    description: `Invoice ${invoiceNumber} - ${customerName}`,
    amount: String(totalAmount),
    date: new Date().toISOString().split("T")[0],
    invoiceId: invoice.id,
  });

  await db.insert(activityLogTable).values({
    type: "invoice_created",
    title: "New invoice created",
    description: `Invoice ${invoiceNumber} for ${customerName}`,
    amount: String(totalAmount),
  });

  const formattedItems = items.map(item => ({
    ...item,
    unitPrice: parseFloat(item.unitPrice),
    gstRate: parseFloat(item.gstRate),
    gstAmount: parseFloat(item.gstAmount),
    total: parseFloat(item.total),
  }));

  res.status(201).json({ ...formatInvoice(invoice), items: formattedItems });
});

router.get("/invoices/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id)).limit(1);
  if (!invoice) {
    res.status(404).json({ error: "Not found", message: "Invoice not found" });
    return;
  }

  const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
  const formattedItems = items.map(item => ({
    ...item,
    unitPrice: parseFloat(item.unitPrice),
    gstRate: parseFloat(item.gstRate),
    gstAmount: parseFloat(item.gstAmount),
    total: parseFloat(item.total),
  }));

  res.json({ ...formatInvoice(invoice), items: formattedItems });
});

router.patch("/invoices/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const result = UpdateInvoiceStatusBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation error", message: result.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {
    status: result.data.status,
    updatedAt: new Date(),
  };
  if (result.data.status === "paid") {
    updateData.paidAt = new Date();
  }

  const [invoice] = await db.update(invoicesTable).set(updateData as Parameters<typeof db.update>[0])
    .where(eq(invoicesTable.id, id))
    .returning();

  if (!invoice) {
    res.status(404).json({ error: "Not found", message: "Invoice not found" });
    return;
  }

  if (result.data.status === "paid") {
    await db.insert(activityLogTable).values({
      type: "invoice_paid",
      title: "Invoice paid",
      description: `Invoice ${invoice.invoiceNumber} marked as paid`,
      amount: invoice.totalAmount,
    });
  }

  const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
  const formattedItems = items.map(item => ({
    ...item,
    unitPrice: parseFloat(item.unitPrice),
    gstRate: parseFloat(item.gstRate),
    gstAmount: parseFloat(item.gstAmount),
    total: parseFloat(item.total),
  }));

  res.json({ ...formatInvoice(invoice), items: formattedItems });
});

export default router;
