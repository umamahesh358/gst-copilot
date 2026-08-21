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

  const conditions = [eq(invoicesTable.userId, req.userId!)];

  if (search) conditions.push(ilike(invoicesTable.invoiceNumber, `%${search}%`));
  if (status) conditions.push(eq(invoicesTable.status, status));
  if (customerId) conditions.push(eq(invoicesTable.customerId, customerId));

  const allInvoices = await db.select().from(invoicesTable)
    .where(and(...conditions))
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

  // Server-side GSTIN format validation (15-char Indian GSTIN)
  const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (data.sellerGstin && !GSTIN_REGEX.test(data.sellerGstin.trim().toUpperCase())) {
    res.status(400).json({ error: "Validation error", message: "Invalid seller GSTIN format (must be 15-char e.g. 22AAAAA0000A1Z5)" });
    return;
  }
  if (data.buyerGstin && !GSTIN_REGEX.test(data.buyerGstin.trim().toUpperCase())) {
    res.status(400).json({ error: "Validation error", message: "Invalid buyer GSTIN format (must be 15-char e.g. 22AAAAA0000A1Z5)" });
    return;
  }

  // E4: Guard against empty items array (Drizzle crashes on insert of 0 rows)
  if (!data.items || data.items.length === 0) {
    res.status(400).json({ error: "Validation error", message: "Invoice must have at least one item" });
    return;
  }

  // BUG-04 fix: Use MAX(id) + 1 inside a single query to avoid race conditions
  const [maxResult] = await db.select({ maxId: sql<number>`COALESCE(MAX(id), 0)` }).from(invoicesTable);
  const nextNum = (Number(maxResult.maxId) + 1).toString().padStart(4, "0");
  const invoiceNumber = `INV-${nextNum}`;

  let subtotal = 0;
  let gstAmount = 0;
  const itemsData = data.items.map(item => {
    const itemTotal = item.quantity * item.unitPrice;
    const itemGst = Math.round(itemTotal * (item.gstRate / 100) * 100) / 100;
    subtotal += itemTotal;
    gstAmount += itemGst;
    return {
      productId: item.productId,
      productName: item.productName,
      hsnCode: item.hsnCode || null,
      quantity: item.quantity,
      unitPrice: String(item.unitPrice),
      gstRate: String(item.gstRate),
      gstAmount: String(itemGst),
      total: String(Math.round((itemTotal + itemGst) * 100) / 100),
    };
  });
  const totalAmount = Math.round((subtotal + gstAmount) * 100) / 100;

  // D1 fix: Validate stock BEFORE creating invoice to prevent orphaned records
  const invoiceType = data.type || "sale";
  if (invoiceType !== "purchase") {
    for (const item of data.items) {
      if (item.productId) {
        const [product] = await db.select().from(productsTable)
          .where(and(eq(productsTable.id, item.productId), eq(productsTable.isDeleted, false)));
        if (product && product.stockQty < item.quantity) {
          res.status(400).json({ error: "Insufficient stock", message: `${product.name} has only ${product.stockQty} units (requested ${item.quantity})` });
          return;
        }
      }
    }
  }

  let customerName = data.customerName || "";
  if (data.customerId) {
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, data.customerId)).limit(1);
    if (customer) customerName = customer.name;
  }

  const finalInvoiceNumber = data.invoiceNumber || invoiceNumber;

  const [invoice] = await db.insert(invoicesTable).values({
    userId: req.userId!,
    invoiceNumber: finalInvoiceNumber,
    customerId: data.customerId,
    customerName,
    type: data.type || "sale",
    buyerGstin: data.buyerGstin || null,
    buyerAddress: data.buyerAddress || null,
    sellerName: data.sellerName || null,
    sellerGstin: data.sellerGstin || null,
    sellerAddress: data.sellerAddress || null,
    status: "pending",
    subtotal: String(subtotal),
    gstAmount: String(gstAmount),
    totalAmount: String(totalAmount),
    dueDate: data.dueDate ? data.dueDate.toISOString().split("T")[0] : null,
    notes: data.notes,
  }).returning();

  const items = await db.insert(invoiceItemsTable).values(
    itemsData.map(item => ({ ...item, invoiceId: invoice.id }))
  ).returning();

  // Now safely update stock (validation already passed above)
  for (const item of data.items) {
    if (item.productId) {
      if (invoiceType === "purchase") {
        await db.update(productsTable)
          .set({ stockQty: sql`${productsTable.stockQty} + ${item.quantity}`, updatedAt: new Date() })
          .where(and(eq(productsTable.id, item.productId), eq(productsTable.isDeleted, false)));
      } else {
        await db.update(productsTable)
          .set({ stockQty: sql`${productsTable.stockQty} - ${item.quantity}`, updatedAt: new Date() })
          .where(and(eq(productsTable.id, item.productId), eq(productsTable.isDeleted, false)));
      }
    }
  }

  await db.insert(transactionsTable).values({
    userId: req.userId!,
    type: invoiceType === "purchase" ? "expense" : "income",
    category: "Invoice",
    description: `Invoice ${finalInvoiceNumber} - ${customerName}`,
    amount: String(totalAmount),
    date: new Date().toISOString().split("T")[0],
    invoiceId: invoice.id,
  });

  await db.insert(activityLogTable).values({
    userId: req.userId!,
    type: "invoice_created",
    title: "New invoice created",
    description: `Invoice ${finalInvoiceNumber} for ${customerName}`,
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
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID", message: "Invoice ID must be a number" }); return; }
  const [invoice] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.id, id), eq(invoicesTable.userId, req.userId!))).limit(1);
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
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID", message: "Invoice ID must be a number" }); return; }
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

  const [invoice] = await db.update(invoicesTable).set(updateData as any)
    .where(and(eq(invoicesTable.id, id), eq(invoicesTable.userId, req.userId!)))
    .returning();

  if (!invoice) {
    res.status(404).json({ error: "Not found", message: "Invoice not found" });
    return;
  }

  if (result.data.status === "paid") {
    await db.insert(activityLogTable).values({
      userId: req.userId!,
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

// P1-1: Soft-delete invoice (cancel) — reverses stock and voids transaction
router.delete("/invoices/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID", message: "Invoice ID must be a number" }); return; }

  const [invoice] = await db.select().from(invoicesTable)
    .where(and(eq(invoicesTable.id, id), eq(invoicesTable.userId, req.userId!)))
    .limit(1);

  if (!invoice) {
    res.status(404).json({ error: "Not found", message: "Invoice not found" });
    return;
  }

  if (invoice.status === "paid") {
    res.status(400).json({ error: "Cannot delete", message: "Paid invoices cannot be deleted. Create a credit note instead." });
    return;
  }

  if (invoice.status === "cancelled") {
    res.status(400).json({ error: "Already cancelled", message: "This invoice is already cancelled." });
    return;
  }

  // Reverse stock adjustments
  const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
  for (const item of items) {
    if (item.productId) {
      if (invoice.type === "purchase") {
        // Reverse purchase: decrease stock
        await db.update(productsTable)
          .set({ stockQty: sql`GREATEST(0, ${productsTable.stockQty} - ${item.quantity})`, updatedAt: new Date() })
          .where(and(eq(productsTable.id, item.productId), eq(productsTable.isDeleted, false)));
      } else {
        // Reverse sale: restore stock
        await db.update(productsTable)
          .set({ stockQty: sql`${productsTable.stockQty} + ${item.quantity}`, updatedAt: new Date() })
          .where(and(eq(productsTable.id, item.productId), eq(productsTable.isDeleted, false)));
      }
    }
  }

  // Void the associated transaction
  await db.delete(transactionsTable)
    .where(and(eq(transactionsTable.invoiceId, id), eq(transactionsTable.userId, req.userId!)));

  // Soft-delete the invoice
  const [cancelled] = await db.update(invoicesTable)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(invoicesTable.id, id))
    .returning();

  await db.insert(activityLogTable).values({
    userId: req.userId!,
    type: "invoice_cancelled",
    title: "Invoice cancelled",
    description: `Invoice ${invoice.invoiceNumber} cancelled and stock reversed`,
    amount: invoice.totalAmount,
  });

  res.json({ ...formatInvoice(cancelled), message: "Invoice cancelled and stock reversed" });
});

export default router;
