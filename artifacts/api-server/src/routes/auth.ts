import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SignupBody, LoginBody, CompleteOnboardingBody } from "@workspace/api-zod";
import { generateToken, requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

router.post("/auth/signup", async (req, res) => {
  const result = SignupBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation error", message: result.error.message });
    return;
  }
  const { name, email, password, businessName } = result.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Conflict", message: "An account with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    name,
    email,
    passwordHash,
    businessName,
    plan: "free",
    onboardingComplete: false,
    aiPromptsUsed: 0,
    aiPromptsLimit: 3,
  }).returning();

  await db.insert(appSettingsTable).values({
    userId: user.id,
    businessName,
    theme: "dark",
    currency: "INR",
    currencySymbol: "₹",
    taxLabel: "GST",
    invoicePrefix: "INV",
  });

  const token = generateToken(user.id);
  res.status(201).json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      businessName: user.businessName,
      plan: user.plan,
      onboardingComplete: user.onboardingComplete,
      aiPromptsUsed: user.aiPromptsUsed,
      aiPromptsLimit: user.aiPromptsLimit,
      createdAt: user.createdAt,
    },
  });
});

router.post("/auth/login", async (req, res) => {
  const result = LoginBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation error", message: result.error.message });
    return;
  }
  const { email, password } = result.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid email or password" });
    return;
  }

  const token = generateToken(user.id);
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      businessName: user.businessName,
      plan: user.plan,
      onboardingComplete: user.onboardingComplete,
      aiPromptsUsed: user.aiPromptsUsed,
      aiPromptsLimit: user.aiPromptsLimit,
      createdAt: user.createdAt,
    },
  });
});

router.post("/auth/logout", (_req, res) => {
  res.json({ message: "Logged out successfully" });
});

router.put("/auth/profile", requireAuth, async (req: AuthRequest, res) => {
  const { name, businessName, businessType, gstNumber, address, phone } = req.body;
  if (!name && !businessName) {
    res.status(400).json({ error: "Validation error", message: "At least one field required" });
    return;
  }
  const updateFields: Record<string, unknown> = { updatedAt: new Date() };
  if (name) updateFields.name = name;
  if (businessName) updateFields.businessName = businessName;
  if (businessType !== undefined) updateFields.businessType = businessType;
  if (gstNumber !== undefined) updateFields.gstNumber = gstNumber;
  if (address !== undefined) updateFields.address = address;
  if (phone !== undefined) updateFields.phone = phone;

  const [user] = await db.update(usersTable)
    .set(updateFields as any)
    .where(eq(usersTable.id, req.userId!))
    .returning();

  if (!user) { res.status(404).json({ error: "Not found" }); return; }

  await db.update(appSettingsTable)
    .set({ businessName: user.businessName, updatedAt: new Date() })
    .where(eq(appSettingsTable.userId, req.userId!));

  res.json({
    id: user.id, name: user.name, email: user.email,
    businessName: user.businessName, plan: user.plan,
    onboardingComplete: user.onboardingComplete,
    businessType: user.businessType, gstNumber: user.gstNumber,
    address: user.address, phone: user.phone,
  });
});

router.get("/auth/me", requireAuth, async (req: AuthRequest, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Unauthorized", message: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    businessName: user.businessName,
    plan: user.plan,
    onboardingComplete: user.onboardingComplete,
    aiPromptsUsed: user.aiPromptsUsed,
    aiPromptsLimit: user.aiPromptsLimit,
    createdAt: user.createdAt,
  });
});

router.post("/auth/onboard", requireAuth, async (req: AuthRequest, res) => {
  const result = CompleteOnboardingBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation error", message: result.error.message });
    return;
  }
  const { businessName, businessType, gstNumber, address, phone } = result.data;

  const [user] = await db.update(usersTable)
    .set({
      businessName,
      businessType,
      gstNumber,
      address,
      phone,
      onboardingComplete: true,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, req.userId!))
    .returning();

  await db.update(appSettingsTable)
    .set({ businessName, gstNumber, address, phone, updatedAt: new Date() })
    .where(eq(appSettingsTable.userId, req.userId!));

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    businessName: user.businessName,
    plan: user.plan,
    onboardingComplete: user.onboardingComplete,
    aiPromptsUsed: user.aiPromptsUsed,
    aiPromptsLimit: user.aiPromptsLimit,
    createdAt: user.createdAt,
  });
});

export default router;
