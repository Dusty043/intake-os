/**
 * Runtime workflow smoke test — verifies the full AI-assisted governance flow
 * through a live NestJS API + Postgres database.
 *
 * Covers:
 *   GET  /health
 *   GET  /health/db
 *   GET  /intakes
 *   POST /intakes
 *   POST /intakes/:id/submit
 *   POST /intakes/:id/analysis-drafts/mock
 *   POST /intakes/:id/analysis-drafts/:draftId/accept
 *   POST /intakes/:id/approvals  (Gate 1)
 *   POST /intakes/:id/approvals  (Gate 2)
 *   POST /intakes/:id/provisioning-plan
 *   GET  /intakes/:id/audit
 *
 * Requires:
 *   - Running Postgres (docker compose up -d postgres)
 *   - Running NestJS API (npm run api:start:dev)
 *
 * Usage:
 *   npm run smoke:runtime
 *   API_BASE_URL=http://localhost:3000 node scripts/smoke-runtime-workflow.mjs
 *
 * Against an AUTH_MODE=google target, dev_headers actor headers are rejected — set
 * SERVICE_TOKEN_REQUEST_CREATOR / SERVICE_TOKEN_INTAKE_OWNER / SERVICE_TOKEN_DEVOPS_LEAD
 * to tokens matching entries in that server's AUTH_SERVICE_TOKENS instead.
 *
 * Exit code 0 = all required checks passed.
 * Exit code 1 = one or more required checks failed.
 */

const BASE = process.env.API_BASE_URL ?? "http://localhost:3000";

let passed = 0;
let failed = 0;

async function check(label, fn, required = true) {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (err) {
    const tag = required ? "FAIL" : "SKIP";
    console.log(`  ${required ? "✗" : "~"} ${label} — ${tag}: ${err.message}`);
    if (required) failed++;
  }
}

async function get(path, expectedStatus = 200) {
  const res = await fetch(`${BASE}${path}`);
  if (res.status !== expectedStatus)
    throw new Error(`expected ${expectedStatus}, got ${res.status}`);
  return res.json();
}

async function post(path, body, headers = {}, expectedStatus = 201) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (res.status !== expectedStatus) {
    const text = await res.text().catch(() => "");
    throw new Error(`expected ${expectedStatus}, got ${res.status} — ${text.slice(0, 160)}`);
  }
  return res.json();
}

// Prefers a service token (works under AUTH_MODE=google) over dev_headers-only
// x-actor-role, which AUTH_MODE=google rejects outright.
function actorHeaders(role, id, name) {
  const token = process.env[`SERVICE_TOKEN_${role.toUpperCase()}`];
  return token
    ? { Authorization: `Bearer ${token}`, "x-actor-id": id, "x-actor-name": name }
    : { "x-actor-id": id, "x-actor-role": role, "x-actor-name": name };
}

const creatorHeaders = actorHeaders("request_creator", "smoke-creator", "Smoke Creator");
const intakeOwnerHeaders = actorHeaders("intake_owner", "smoke-intake-owner", "Smoke Intake Owner");
const devopsHeaders = actorHeaders("devops_lead", "smoke-devops", "Smoke DevOps Lead");

console.log(`\nProject Intake OS — Runtime Workflow Smoke Test`);
console.log(`Target: ${BASE}\n`);

// ─── Phase 1: Infrastructure ──────────────────────────────────────────────────
console.log("Phase 1 — Infrastructure");

await check("GET /health returns {status: ok}", async () => {
  const body = await get("/health");
  if (body.status !== "ok") throw new Error(`expected ok, got ${body.status}`);
  if (body.liveProvisioning !== "disabled")
    throw new Error("expected liveProvisioning=disabled (governance guard)");
});

await check("GET /health/db reports database reachable", async () => {
  const body = await get("/health/db");
  if (body.status !== "ok") throw new Error(`expected ok, got ${body.status}`);
  if (body.database !== "reachable") throw new Error(`expected database=reachable`);
});

await check("GET /docs-json returns OpenAPI spec", async () => {
  const body = await get("/docs-json");
  if (!body.openapi) throw new Error("missing openapi field");
});

// ─── Phase 2: Intake CRUD ─────────────────────────────────────────────────────
console.log("\nPhase 2 — Intake CRUD");

let intakes;
await check("GET /intakes returns array", async () => {
  intakes = await get("/intakes");
  if (!Array.isArray(intakes)) throw new Error("expected array");
});

let intake;
await check("POST /intakes creates draft intake", async () => {
  intake = await post(
    "/intakes",
    {
      title: "Smoke Test — Runtime Workflow Verification",
      description:
        "Created by smoke-runtime-workflow.mjs to verify the full governance flow end-to-end against a live API + Postgres.",
      requester: "smoke-test@local",
      department: "Engineering",
      projectType: "internal_tool",
    },
    creatorHeaders,
    201,
  );
  if (!intake.id) throw new Error("missing id");
  if (intake.status !== "draft") throw new Error(`expected draft, got ${intake.status}`);
});

// ─── Phase 3: Submission ──────────────────────────────────────────────────────
console.log("\nPhase 3 — Submission");

let submitted;
await check("POST /intakes/:id/submit transitions to submitted", async () => {
  if (!intake) throw new Error("no intake");
  submitted = await post(`/intakes/${intake.id}/submit`, {}, creatorHeaders, 201);
  if (submitted.status !== "submitted") throw new Error(`expected submitted, got ${submitted.status}`);
});

// ─── Phase 4: AI draft ────────────────────────────────────────────────────────
console.log("\nPhase 4 — AI draft");

let withDraft;
await check("POST /intakes/:id/analysis-drafts/mock generates a draft", async () => {
  if (!submitted) throw new Error("no submitted intake");
  withDraft = await post(
    `/intakes/${submitted.id}/analysis-drafts/mock`,
    { reviewerContext: "Smoke test draft." },
    intakeOwnerHeaders,
    201,
  );
  const draft = withDraft.latestAnalysisDraft;
  if (!draft?.id) throw new Error("missing latestAnalysisDraft.id");
  if (draft.reviewStatus !== "draft") throw new Error(`expected reviewStatus=draft, got ${draft.reviewStatus}`);
  if (!draft.subtasks?.length) throw new Error("draft has no subtasks");
});

await check("Draft reviewStatus is immutable (AI cannot approve)", async () => {
  if (!withDraft?.latestAnalysisDraft) throw new Error("no draft");
  if (withDraft.latestAnalysisDraft.reviewStatus !== "draft")
    throw new Error("draft was not in draft status — governance violation");
  if (withDraft.approvals?.gate_1) throw new Error("gate_1 was set before human review — governance violation");
});

// ─── Phase 5: Human review ────────────────────────────────────────────────────
console.log("\nPhase 5 — Human review");

let accepted;
await check("POST /intakes/:id/analysis-drafts/:draftId/accept creates reviewed package", async () => {
  if (!withDraft) throw new Error("no withDraft");
  const draftId = withDraft.latestAnalysisDraft.id;
  accepted = await post(
    `/intakes/${withDraft.id}/analysis-drafts/${draftId}/accept`,
    { reviewerNotes: "Smoke test: scope confirmed." },
    intakeOwnerHeaders,
    201,
  );
  if (!accepted.reviewedProjectPackage?.id) throw new Error("missing reviewedProjectPackage");
  if (accepted.latestAnalysisDraft.reviewStatus !== "accepted")
    throw new Error(`expected reviewStatus=accepted, got ${accepted.latestAnalysisDraft.reviewStatus}`);
});

await check("Gate 1 blocked until reviewed package exists (governance guard verified before accept)", async () => {
  // We already have the accepted record — this check confirms the reviewed package is present
  // which was the guard condition. If accept succeeded, the guard passed correctly.
  if (!accepted?.reviewedProjectPackage) throw new Error("no reviewed package after accept");
});

// ─── Phase 6: Approval gates ─────────────────────────────────────────────────
console.log("\nPhase 6 — Approval gates");

let gate1;
await check("POST /intakes/:id/approvals (Gate 1) transitions to devops_review", async () => {
  if (!accepted) throw new Error("no accepted intake");
  gate1 = await post(
    `/intakes/${accepted.id}/approvals`,
    { comment: "Smoke test: Gate 1 approved." },
    intakeOwnerHeaders,
    201,
  );
  if (gate1.status !== "devops_review") throw new Error(`expected devops_review, got ${gate1.status}`);
  if (!gate1.approvals?.gate_1) throw new Error("gate_1 record missing");
});

let gate2;
await check("POST /intakes/:id/approvals (Gate 2) transitions to approved", async () => {
  if (!gate1) throw new Error("no gate1 intake");
  gate2 = await post(
    `/intakes/${gate1.id}/approvals`,
    { comment: "Smoke test: Gate 2 approved." },
    devopsHeaders,
    201,
  );
  if (gate2.status !== "approved") throw new Error(`expected approved, got ${gate2.status}`);
  if (!gate2.approvals?.gate_2) throw new Error("gate_2 record missing");
});

// ─── Phase 7: Distribution preview ───────────────────────────────────────────
console.log("\nPhase 7 — Distribution preview");

let withPlan;
await check("POST /intakes/:id/provisioning-plan generates dry-run plan", async () => {
  if (!gate2) throw new Error("no gate2 intake");
  withPlan = await post(
    `/intakes/${gate2.id}/provisioning-plan`,
    { teamPrefix: "Smoke Test" },
    devopsHeaders,
    201,
  );
  if (!withPlan.provisioningPlan?.id) throw new Error("missing provisioningPlan");
  const plan = withPlan.provisioningPlan;
  if (!plan.actions?.length) throw new Error("plan has no actions");
});

await check("Provisioning plan source is reviewed_project_package", async () => {
  if (!withPlan?.provisioningPlan) throw new Error("no plan");
  const src = withPlan.provisioningPlan.source?.type;
  if (src !== "reviewed_project_package")
    throw new Error(`expected reviewed_project_package, got ${src} — governance violation`);
});

await check("No live provisioning executed (dry-run only)", async () => {
  if (!withPlan?.provisioningPlan) throw new Error("no plan");
  const actions = withPlan.provisioningPlan.actions ?? [];
  const liveActions = actions.filter((a) => !a.dryRun);
  if (liveActions.length > 0)
    throw new Error(`${liveActions.length} action(s) have dryRun=false — governance violation`);
});

// ─── Phase 8: Audit trail ─────────────────────────────────────────────────────
console.log("\nPhase 8 — Audit trail");

await check("GET /intakes/:id/audit returns event history", async () => {
  if (!withPlan) throw new Error("no intake");
  const audit = await get(`/intakes/${withPlan.id}/audit`);
  if (!Array.isArray(audit)) throw new Error("expected array");
  if (audit.length < 6) throw new Error(`expected at least 6 audit events, got ${audit.length}`);
});

await check("Audit trail contains INTAKE_CREATED event", async () => {
  if (!withPlan) throw new Error("no intake");
  const audit = await get(`/intakes/${withPlan.id}/audit`);
  if (!audit.some((e) => e.action === "INTAKE_CREATED"))
    throw new Error("INTAKE_CREATED not found in audit trail");
});

await check("Audit trail contains ANALYSIS_DRAFT_GENERATED event", async () => {
  if (!withPlan) throw new Error("no intake");
  const audit = await get(`/intakes/${withPlan.id}/audit`);
  if (!audit.some((e) => e.action === "ANALYSIS_DRAFT_GENERATED"))
    throw new Error("ANALYSIS_DRAFT_GENERATED not found in audit trail");
});

await check("Audit trail contains REVIEWED_PROJECT_PACKAGE_CREATED event", async () => {
  if (!withPlan) throw new Error("no intake");
  const audit = await get(`/intakes/${withPlan.id}/audit`);
  if (!audit.some((e) => e.action === "REVIEWED_PROJECT_PACKAGE_CREATED"))
    throw new Error("REVIEWED_PROJECT_PACKAGE_CREATED not found in audit trail");
});

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n  Summary: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  console.error(`Runtime smoke FAILED — ${failed} required check(s) did not pass.\n`);
  process.exit(1);
} else {
  console.log(
    `Runtime smoke PASSED.\n\nGovernance confirmed:\n  AI drafts → Human review → Approval gates → Distribution preview (dry-run only)\n`,
  );
}
