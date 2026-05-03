import { Router } from "express";
import { db } from "@workspace/db";
import { companiesTable, companyMembersTable, auditLogsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/companies", requireAuth, async (req: AuthRequest, res) => {
  const memberships = await db
    .select({ companyId: companyMembersTable.companyId, role: companyMembersTable.role, isOwner: companyMembersTable.isOwner })
    .from(companyMembersTable)
    .where(eq(companyMembersTable.userId, req.userId!));

  const companyIds = memberships.map((m) => m.companyId);
  if (companyIds.length === 0) {
    res.json({ companies: [] });
    return;
  }

  const companies = await db
    .select()
    .from(companiesTable)
    .where(and(eq(companiesTable.isDeleted, false)))
    .orderBy(desc(companiesTable.createdAt));

  const userCompanies = companies
    .filter((c) => companyIds.includes(c.id))
    .map((c) => {
      const membership = memberships.find((m) => m.companyId === c.id);
      return { ...c, role: membership?.role, isOwner: membership?.isOwner };
    });

  res.json({ companies: userCompanies });
});

router.post("/companies", requireAuth, async (req: AuthRequest, res) => {
  const { name, legalName, gstin, pan, businessType, address, city, state, pincode, phone, email, website, currency, financialYearStart } = req.body;
  if (!name) {
    res.status(400).json({ error: "Validation error", message: "name is required" });
    return;
  }

  const [company] = await db
    .insert(companiesTable)
    .values({ name, legalName, gstin, pan, businessType, address, city, state, pincode, phone, email, website, currency: currency ?? "INR", financialYearStart: financialYearStart ?? "04" })
    .returning();

  await db.insert(companyMembersTable).values({
    companyId: company.id,
    userId: req.userId!,
    role: "owner",
    isOwner: true,
    inviteStatus: "accepted",
  });

  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "company_created",
    entity: "company",
    entityId: String(company.id),
    description: `Company created: ${name}`,
  });

  res.status(201).json({ company });
});

router.get("/companies/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const [membership] = await db.select().from(companyMembersTable)
    .where(and(eq(companyMembersTable.companyId, id), eq(companyMembersTable.userId, req.userId!)))
    .limit(1);

  if (!membership) {
    res.status(403).json({ error: "Forbidden", message: "You are not a member of this company" });
    return;
  }

  const [company] = await db.select().from(companiesTable)
    .where(and(eq(companiesTable.id, id), eq(companiesTable.isDeleted, false)))
    .limit(1);

  if (!company) { res.status(404).json({ error: "Not found", message: "Company not found" }); return; }
  res.json({ company: { ...company, role: membership.role, isOwner: membership.isOwner } });
});

router.delete("/companies/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const [membership] = await db.select().from(companyMembersTable)
    .where(and(eq(companyMembersTable.companyId, id), eq(companyMembersTable.userId, req.userId!), eq(companyMembersTable.isOwner, true)))
    .limit(1);

  if (!membership) {
    res.status(403).json({ error: "Forbidden", message: "Only the company owner can delete it" });
    return;
  }

  await db.update(companiesTable).set({ isDeleted: true, updatedAt: new Date() }).where(eq(companiesTable.id, id));

  await db.insert(auditLogsTable).values({
    userId: req.userId!,
    action: "company_deleted",
    entity: "company",
    entityId: String(id),
    description: "Company deleted",
  });

  res.json({ success: true, message: "Company deleted" });
});

router.put("/companies/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const { name, legalName, gstin, pan, businessType, address, city, state, pincode, phone, email, website, currency, financialYearStart } = req.body;

  const [membership] = await db
    .select()
    .from(companyMembersTable)
    .where(and(eq(companyMembersTable.companyId, id), eq(companyMembersTable.userId, req.userId!)))
    .limit(1);

  if (!membership || (!membership.isOwner && membership.role !== "admin")) {
    res.status(403).json({ error: "Forbidden", message: "You do not have permission to update this company" });
    return;
  }

  const [company] = await db
    .update(companiesTable)
    .set({ name, legalName, gstin, pan, businessType, address, city, state, pincode, phone, email, website, currency, financialYearStart, updatedAt: new Date() })
    .where(eq(companiesTable.id, id))
    .returning();

  res.json({ company });
});

router.get("/companies/:id/members", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const members = await db
    .select()
    .from(companyMembersTable)
    .where(eq(companyMembersTable.companyId, id))
    .orderBy(desc(companyMembersTable.createdAt));

  res.json({ members });
});

router.post("/companies/:id/members", requireAuth, async (req: AuthRequest, res) => {
  const companyId = parseInt(req.params.id as string);
  const { userId, role, inviteEmail } = req.body;

  const [membership] = await db
    .select()
    .from(companyMembersTable)
    .where(and(eq(companyMembersTable.companyId, companyId), eq(companyMembersTable.userId, req.userId!)))
    .limit(1);

  if (!membership || (!membership.isOwner && membership.role !== "admin")) {
    res.status(403).json({ error: "Forbidden", message: "Only owners and admins can invite members" });
    return;
  }

  const [member] = await db
    .insert(companyMembersTable)
    .values({
      companyId,
      userId: userId ?? req.userId!,
      role: role ?? "staff",
      isOwner: false,
      invitedByUserId: req.userId!,
      inviteEmail,
      inviteStatus: "pending",
    })
    .returning();

  res.status(201).json({ member });
});

router.patch("/companies/:id/members/:memberId/role", requireAuth, async (req: AuthRequest, res) => {
  const companyId = parseInt(req.params.id as string);
  const memberId = parseInt(req.params.memberId as string);
  const { role } = req.body;

  const validRoles = ["owner", "admin", "accountant", "staff", "viewer"];
  if (!role || !validRoles.includes(role)) {
    res.status(400).json({ error: "Validation error", message: `role must be one of: ${validRoles.join(", ")}` });
    return;
  }

  const [member] = await db
    .update(companyMembersTable)
    .set({ role, updatedAt: new Date() })
    .where(and(eq(companyMembersTable.id, memberId), eq(companyMembersTable.companyId, companyId)))
    .returning();

  if (!member) {
    res.status(404).json({ error: "Not found", message: "Member not found" });
    return;
  }

  res.json({ member });
});

export default router;
