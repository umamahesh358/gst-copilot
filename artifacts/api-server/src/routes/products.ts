import { Router } from "express";
import { db } from "@workspace/db";
import { productsTable, activityLogTable } from "@workspace/db";
import { eq, and, ilike, sql } from "drizzle-orm";
import { CreateProductBody, UpdateProductBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/products", requireAuth, async (req: AuthRequest, res) => {
  const search = req.query.search as string | undefined;
  const lowStock = req.query.lowStock === "true";
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  let conditions = [eq(productsTable.isDeleted, false)];

  if (search) {
    conditions.push(ilike(productsTable.name, `%${search}%`));
  }

  const allProducts = await db.select().from(productsTable)
    .where(and(...conditions))
    .orderBy(productsTable.createdAt);

  const productsWithLowStock = allProducts.map(p => ({
    ...p,
    price: parseFloat(p.price),
    costPrice: parseFloat(p.costPrice || "0"),
    gstRate: parseFloat(p.gstRate),
    isLowStock: p.stockQty <= p.lowStockThreshold,
  }));

  const filtered = lowStock ? productsWithLowStock.filter(p => p.isLowStock) : productsWithLowStock;
  const total = filtered.length;
  const products = filtered.slice(offset, offset + limit);

  res.json({ products, total, page, limit });
});

router.post("/products", requireAuth, async (req: AuthRequest, res) => {
  const result = CreateProductBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation error", message: result.error.message });
    return;
  }

  const data = result.data;
  const [product] = await db.insert(productsTable).values({
    name: data.name,
    description: data.description,
    sku: data.sku,
    unit: data.unit || "pcs",
    hsnCode: data.hsnCode,
    price: String(data.price),
    costPrice: String(data.costPrice || 0),
    gstRate: String(data.gstRate),
    stockQty: data.stockQty,
    lowStockThreshold: data.lowStockThreshold || 5,
    category: data.category,
  }).returning();

  await db.insert(activityLogTable).values({
    type: "product_added",
    title: "New product added",
    description: `Product "${product.name}" was added to inventory`,
  });

  res.status(201).json({
    ...product,
    price: parseFloat(product.price),
    costPrice: parseFloat(product.costPrice || "0"),
    gstRate: parseFloat(product.gstRate),
    isLowStock: product.stockQty <= product.lowStockThreshold,
  });
});

router.get("/products/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const [product] = await db.select().from(productsTable)
    .where(and(eq(productsTable.id, id), eq(productsTable.isDeleted, false)))
    .limit(1);

  if (!product) {
    res.status(404).json({ error: "Not found", message: "Product not found" });
    return;
  }

  res.json({
    ...product,
    price: parseFloat(product.price),
    costPrice: parseFloat(product.costPrice || "0"),
    gstRate: parseFloat(product.gstRate),
    isLowStock: product.stockQty <= product.lowStockThreshold,
  });
});

router.put("/products/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const result = UpdateProductBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation error", message: result.error.message });
    return;
  }

  const data = result.data;
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.sku !== undefined) updateData.sku = data.sku;
  if (data.hsnCode !== undefined) updateData.hsnCode = data.hsnCode;
  if (data.unit !== undefined) updateData.unit = data.unit;
  if (data.price !== undefined) updateData.price = String(data.price);
  if (data.costPrice !== undefined) updateData.costPrice = String(data.costPrice);
  if (data.gstRate !== undefined) updateData.gstRate = String(data.gstRate);
  if (data.stockQty !== undefined) updateData.stockQty = data.stockQty;
  if (data.lowStockThreshold !== undefined) updateData.lowStockThreshold = data.lowStockThreshold;
  if (data.category !== undefined) updateData.category = data.category;

  const [product] = await db.update(productsTable)
    .set(updateData as any)
    .where(eq(productsTable.id, id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Not found", message: "Product not found" });
    return;
  }

  const isLowStock = product.stockQty <= product.lowStockThreshold;
  if (isLowStock) {
    await db.insert(activityLogTable).values({
      type: "product_low_stock",
      title: "Low stock alert",
      description: `Product "${product.name}" is running low (${product.stockQty} remaining)`,
    }).onConflictDoNothing();
  }

  res.json({
    ...product,
    price: parseFloat(product.price),
    costPrice: parseFloat(product.costPrice || "0"),
    gstRate: parseFloat(product.gstRate),
    isLowStock,
  });
});

router.delete("/products/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const [product] = await db.update(productsTable)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(productsTable.id, id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Not found", message: "Product not found" });
    return;
  }

  res.json({ message: `Product "${product.name}" deleted successfully` });
});

export default router;
