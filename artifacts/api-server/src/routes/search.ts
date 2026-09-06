import { Router } from "express";
import { db } from "@workspace/db";
import {
  invoicesTable,
  customersTable,
  productsTable,
  vendorsTable,
} from "@workspace/db";
import { eq, ilike, and, or } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/search", requireAuth, async (req: AuthRequest, res) => {
  const q = (req.query.q as string | undefined)?.trim();

  if (!q || q.length < 2) {
    res.json({ invoices: [], customers: [], products: [], vendors: [] });
    return;
  }

  const pattern = `%${q}%`;
  const uid = req.userId!;

  const [invoices, customers, products, vendors] = await Promise.all([
    db
      .select({
        id: invoicesTable.id,
        invoiceNumber: invoicesTable.invoiceNumber,
        customerName: invoicesTable.customerName,
        status: invoicesTable.status,
        totalAmount: invoicesTable.totalAmount,
      })
      .from(invoicesTable)
      .where(
        and(
          eq(invoicesTable.userId, uid),
          or(
            ilike(invoicesTable.invoiceNumber, pattern),
            ilike(invoicesTable.customerName, pattern)
          )
        )
      )
      .limit(5),

    db
      .select({
        id: customersTable.id,
        name: customersTable.name,
        email: customersTable.email,
        phone: customersTable.phone,
      })
      .from(customersTable)
      .where(
        and(
          eq(customersTable.userId, uid),
          or(
            ilike(customersTable.name, pattern),
            ilike(customersTable.email, pattern),
            ilike(customersTable.phone, pattern)
          )
        )
      )
      .limit(5),

    db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        sku: productsTable.sku,
        category: productsTable.category,
        stockQty: productsTable.stockQty,
      })
      .from(productsTable)
      .where(
        and(
          eq(productsTable.userId, uid),
          eq(productsTable.isDeleted, false),
          or(
            ilike(productsTable.name, pattern),
            ilike(productsTable.sku, pattern),
            ilike(productsTable.category, pattern)
          )
        )
      )
      .limit(5),

    db
      .select({
        id: vendorsTable.id,
        name: vendorsTable.name,
        email: vendorsTable.email,
        contactPerson: vendorsTable.contactPerson,
      })
      .from(vendorsTable)
      .where(
        and(
          eq(vendorsTable.userId, uid),
          or(
            ilike(vendorsTable.name, pattern),
            ilike(vendorsTable.email, pattern),
            ilike(vendorsTable.contactPerson, pattern)
          )
        )
      )
      .limit(5),
  ]);

  res.json({ invoices, customers, products, vendors });
});

export default router;
