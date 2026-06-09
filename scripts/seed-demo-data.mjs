/**
 * Seed demo data into the local Postgres database.
 *
 * Requires:
 *   - .env with DATABASE_URL (cp .env.example .env)
 *   - Postgres running (docker compose up -d postgres)
 *   - Migrations applied (npm run prisma:migrate)
 *   - API built (npm run api:build)
 *
 * Usage:
 *   npm run seed:demo
 *   node --env-file=.env scripts/seed-demo-data.mjs
 *
 * Idempotency: deletes all records where requester = DEMO_MARKER, then recreates.
 * Only demo records are touched — real records are never deleted.
 */

import { PrismaClient } from "@prisma/client";
import { IntakeWorkflowService } from "../dist/src/index.js";

const DEMO_MARKER = "demo.requester@local";

// ─── Inline Prisma-backed store ───────────────────────────────────────────────
// Mirrors PrismaProjectIntakeStore without NestJS decorators so the seed script
// can run standalone without bootstrapping the full NestJS container.

class SeedPrismaStore {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async listIntakes() {
    const rows = await this.prisma.projectIntake.findMany({
      orderBy: { createdAt: "desc" },
      select: { recordSnapshot: true },
    });
    return rows.map((r) => JSON.parse(JSON.stringify(r.recordSnapshot)));
  }

  async getIntake(id) {
    const row = await this.prisma.projectIntake.findUnique({
      where: { id },
      select: { recordSnapshot: true },
    });
    return row ? JSON.parse(JSON.stringify(row.recordSnapshot)) : null;
  }

  async saveIntake(record) {
    const snap = JSON.parse(JSON.stringify(record));
    const saved = await this.prisma.projectIntake.upsert({
      where: { id: record.id },
      create: {
        id: record.id,
        title: record.title,
        description: record.description,
        requester: record.requester,
        department: record.department ?? null,
        projectType: record.projectType,
        status: record.status,
        sourceSystem: record.source.system,
        sourceExternalId: record.source.externalId ?? null,
        sourceExternalUrl: record.source.externalUrl ?? null,
        sourceRawPayload: record.source.rawPayload
          ? JSON.parse(JSON.stringify(record.source.rawPayload))
          : undefined,
        analysisDrafts: record.analysisDrafts
          ? JSON.parse(JSON.stringify(record.analysisDrafts))
          : undefined,
        latestAnalysisDraft: record.latestAnalysisDraft
          ? JSON.parse(JSON.stringify(record.latestAnalysisDraft))
          : undefined,
        recordSnapshot: snap,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt ?? record.createdAt),
        createdById: record.createdBy.id,
        createdByRole: record.createdBy.role,
        createdByName: record.createdBy.displayName ?? null,
      },
      update: {
        title: record.title,
        description: record.description,
        requester: record.requester,
        department: record.department ?? null,
        projectType: record.projectType,
        status: record.status,
        sourceSystem: record.source.system,
        analysisDrafts: record.analysisDrafts
          ? JSON.parse(JSON.stringify(record.analysisDrafts))
          : undefined,
        latestAnalysisDraft: record.latestAnalysisDraft
          ? JSON.parse(JSON.stringify(record.latestAnalysisDraft))
          : undefined,
        recordSnapshot: snap,
        updatedAt: new Date(record.updatedAt ?? new Date().toISOString()),
      },
      select: { recordSnapshot: true },
    });
    return JSON.parse(JSON.stringify(saved.recordSnapshot));
  }

  async listAuditEvents(intakeId) {
    const rows = await this.prisma.auditEvent.findMany({
      where: { intakeId },
      orderBy: [{ timestamp: "asc" }, { id: "asc" }],
    });
    return rows.map((r) => ({
      requestId: r.intakeId,
      actorId: r.actorId,
      actorRole: r.actorRole,
      action: r.action,
      ...(r.fromState ? { fromState: r.fromState } : {}),
      ...(r.toState ? { toState: r.toState } : {}),
      timestamp: r.timestamp.toISOString(),
      ...(r.reason ? { reason: r.reason } : {}),
      ...(r.metadata ? { metadata: JSON.parse(JSON.stringify(r.metadata)) } : {}),
    }));
  }

  async appendAuditEvent(event) {
    const row = await this.prisma.auditEvent.create({
      data: {
        intakeId: event.requestId,
        actorId: event.actorId,
        actorRole: event.actorRole,
        action: event.action,
        fromState: event.fromState ?? null,
        toState: event.toState ?? null,
        reason: event.reason ?? null,
        metadata: event.metadata ? JSON.parse(JSON.stringify(event.metadata)) : undefined,
        timestamp: new Date(event.timestamp),
      },
    });
    return {
      requestId: row.intakeId,
      actorId: row.actorId,
      actorRole: row.actorRole,
      action: row.action,
      ...(row.fromState ? { fromState: row.fromState } : {}),
      ...(row.toState ? { toState: row.toState } : {}),
      timestamp: row.timestamp.toISOString(),
      ...(row.reason ? { reason: row.reason } : {}),
      ...(row.metadata ? { metadata: JSON.parse(JSON.stringify(row.metadata)) } : {}),
    };
  }
}

// ─── Actors ───────────────────────────────────────────────────────────────────

const creator = { id: "seed-creator", role: "request_creator", displayName: "Demo Requester" };
const intakeOwner = { id: "seed-intake-owner", role: "intake_owner", displayName: "Demo Intake Owner" };
const devopsLead = { id: "seed-devops-lead", role: "devops_lead", displayName: "Demo DevOps Lead" };

// ─── Main ─────────────────────────────────────────────────────────────────────

const prisma = new PrismaClient();

try {
  const maskedUrl = (process.env.DATABASE_URL ?? "(not set)").replace(/:[^:@]+@/, ":***@");
  console.log("\nProject Intake OS — Demo Data Seed");
  console.log(`Database: ${maskedUrl}\n`);

  // Clear existing demo records
  const existing = await prisma.projectIntake.findMany({
    where: { requester: DEMO_MARKER },
    select: { id: true },
  });
  if (existing.length > 0) {
    await prisma.projectIntake.deleteMany({ where: { requester: DEMO_MARKER } });
    console.log(`Removed ${existing.length} existing demo record(s).\n`);
  }

  // Create service with Prisma-backed store
  let idSeq = 0;
  const store = new SeedPrismaStore(prisma);
  const service = new IntakeWorkflowService({
    store,
    clock: () => new Date().toISOString(),
    idFactory: (prefix) => `${prefix}-seed-${String(++idSeq).padStart(3, "0")}`,
  });

  const results = [];

  // ── 1. Draft intake ────────────────────────────────────────────────────────
  {
    const r = await service.createIntake(
      {
        title: "Payment Failure Notification Fix",
        description:
          "Investigate and fix payment failure notifications that are not being sent to customers when a recurring payment fails. Affects approximately 120 customers per month. Requires updating the billing service event handler and the email notification template.",
        requester: DEMO_MARKER,
        department: "Engineering",
        projectType: "api_service",
      },
      creator,
    );
    results.push(r);
    console.log(`  ✓ [1] ${r.title.padEnd(46)} → ${r.status}`);
  }

  // ── 2. Submitted intake ────────────────────────────────────────────────────
  {
    const draft = await service.createIntake(
      {
        title: "Marketing Dashboard Request",
        description:
          "Build an internal dashboard for the marketing team showing campaign performance, lead sources, and conversion rates. The dashboard should connect to HubSpot and GA4 exports and be updated nightly.",
        requester: DEMO_MARKER,
        department: "Marketing",
        projectType: "internal_dashboard",
      },
      creator,
    );
    const r = await service.submitIntake(draft.id, creator);
    results.push(r);
    console.log(`  ✓ [2] ${r.title.padEnd(46)} → ${r.status}`);
  }

  // ── 3. AI draft available (intake_review, no reviewed package) ─────────────
  {
    const draft = await service.createIntake(
      {
        title: "Customer Portal Enhancement",
        description:
          "Upgrade the customer portal to support multiple delivery addresses, order history export as PDF, and a new self-service returns wizard. Must be mobile-friendly and pass a WCAG 2.1 AA accessibility audit before launch.",
        requester: DEMO_MARKER,
        department: "Product",
        projectType: "client_portal",
      },
      creator,
    );
    const submitted = await service.submitIntake(draft.id, creator);
    const r = await service.generateMockAnalysisDraft(
      submitted.id,
      { reviewerContext: "Focus on frontend scope, accessibility requirements, and integration with the existing order management API." },
      intakeOwner,
    );
    results.push(r);
    console.log(`  ✓ [3] ${r.title.padEnd(46)} → ${r.status} (AI draft generated, awaiting review)`);
  }

  // ── 4. Reviewed package ready (intake_review, before Gate 1) ──────────────
  {
    const draft = await service.createIntake(
      {
        title: "Internal SSO Management Tool",
        description:
          "Build an admin panel for managing SSO configurations across internal tools. Admins need to enable and disable providers, configure attribute mappings, and view a login audit log. The tool must support at least Google Workspace and Okta.",
        requester: DEMO_MARKER,
        department: "IT Operations",
        projectType: "internal_tool",
      },
      creator,
    );
    const submitted = await service.submitIntake(draft.id, creator);
    const withDraft = await service.generateMockAnalysisDraft(
      submitted.id,
      { reviewerContext: "Focus on security posture, IAM integration scope, and compliance requirements." },
      intakeOwner,
    );
    const r = await service.acceptAnalysisDraft(
      {
        intakeId: withDraft.id,
        draftId: withDraft.latestAnalysisDraft.id,
        reviewerNotes:
          "Scope is well-defined. Estimates are reasonable for an IAM management tool. Tech stack and infrastructure confirmed. Proceeding to Gate 1.",
      },
      intakeOwner,
    );
    results.push(r);
    console.log(`  ✓ [4] ${r.title.padEnd(46)} → ${r.status} (reviewed package ready, Gate 1 available)`);
  }

  // ── 5. Gate 1 approved, awaiting Gate 2 (devops_review) ───────────────────
  {
    const draft = await service.createIntake(
      {
        title: "Data Pipeline Migration",
        description:
          "Migrate legacy ETL jobs from the on-prem SQL Server to a cloud-native pipeline using Apache Airflow on AWS MWAA. Covers 14 batch jobs, scheduling configuration, CloudWatch monitoring alerts, and a tested rollback plan.",
        requester: DEMO_MARKER,
        department: "Data Engineering",
        projectType: "data_sync_integration",
      },
      creator,
    );
    const submitted = await service.submitIntake(draft.id, creator);
    const withDraft = await service.generateMockAnalysisDraft(
      submitted.id,
      { reviewerContext: "Focus on data migration risk, infrastructure requirements, and rollback strategy." },
      intakeOwner,
    );
    const accepted = await service.acceptAnalysisDraft(
      {
        intakeId: withDraft.id,
        draftId: withDraft.latestAnalysisDraft.id,
        reviewerNotes:
          "Migration scope confirmed. AWS infrastructure requirements are documented. Rollback plan included. Ready for DevOps infrastructure review.",
      },
      intakeOwner,
    );
    const r = await service.recordApproval(
      accepted.id,
      { comment: "Reviewed scope and data migration risk analysis. AWS resource list is reasonable. Ready for DevOps sign-off." },
      intakeOwner,
    );
    results.push(r);
    console.log(`  ✓ [5] ${r.title.padEnd(46)} → ${r.status} (Gate 1 approved, Gate 2 pending)`);
  }

  // ── 6. Fully approved + distribution preview ready ─────────────────────────
  {
    const draft = await service.createIntake(
      {
        title: "Project Intake OS UI Buildout",
        description:
          "Build the web-based review UI for the Project Intake OS governance system. Covers the browser-operable workflow: intake list, intake detail, AI draft review, approval gates, and distribution preview. Tech stack: Next.js 15 App Router, TypeScript, Tailwind CSS v3.",
        requester: DEMO_MARKER,
        department: "Digital Solutions",
        projectType: "internal_tool",
      },
      creator,
    );
    const submitted = await service.submitIntake(draft.id, creator);
    const withDraft = await service.generateMockAnalysisDraft(
      submitted.id,
      { reviewerContext: "Focus on frontend architecture, governance UX, and developer ergonomics for the review workflow." },
      intakeOwner,
    );
    const accepted = await service.acceptAnalysisDraft(
      {
        intakeId: withDraft.id,
        draftId: withDraft.latestAnalysisDraft.id,
        reviewerNotes:
          "Next.js App Router + Tailwind CSS confirmed. Scope matches TASK-0010 spec. Estimates validated against prior similar builds. Approved for full development.",
      },
      intakeOwner,
    );
    const gate1 = await service.recordApproval(
      accepted.id,
      { comment: "Product scope confirmed. UI design validated against the governance workflow spec. Infrastructure footprint is minimal." },
      intakeOwner,
    );
    const gate2 = await service.recordApproval(
      gate1.id,
      { comment: "No new AWS resources required. Vercel or self-hosted Node target. Approved for provisioning." },
      devopsLead,
    );
    const r = await service.generateProvisioningPlan(
      gate2.id,
      { teamPrefix: "Digital Solutions" },
      devopsLead,
    );
    results.push(r);
    const src = r.provisioningPlan?.source?.type ?? "unknown";
    console.log(`  ✓ [6] ${r.title.padEnd(46)} → ${r.status} (approved, distribution preview: ${src})`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\nSeeded demo data:");
  for (const r of results) {
    const plan = r.provisioningPlan ? ` | plan: ${r.provisioningPlan.source?.type}` : "";
    console.log(`  ${r.id.padEnd(30)} ${r.status}${plan}`);
  }

  console.log(`\nSeed complete — ${results.length} demo records written to Postgres.`);
  console.log(`\nOpen http://localhost:3001/intakes to browse the seeded records.\n`);
} catch (err) {
  console.error("\nSeed failed:", err.message ?? err);
  const msg = String(err.message ?? "");
  if (
    msg.includes("ECONNREFUSED") ||
    msg.includes("connection") ||
    msg.includes("database") ||
    msg.includes("P1001") ||
    msg.includes("P1003")
  ) {
    console.error("\nTips:");
    console.error("  1. Ensure Postgres is running: docker compose up -d postgres");
    console.error("  2. Ensure .env exists:        cp .env.example .env");
    console.error("  3. Ensure migrations applied: npm run prisma:migrate");
    console.error("  4. Ensure API is built:       npm run api:build\n");
  }
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
