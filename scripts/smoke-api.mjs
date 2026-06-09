/**
 * API smoke test — requires a running NestJS API.
 *
 * Usage:
 *   npm run smoke:api
 *   API_BASE_URL=http://localhost:3000 node scripts/smoke-api.mjs
 *
 * Checks:
 *   1. GET /health
 *   2. GET /docs-json (Swagger OpenAPI JSON)
 *   3. GET /intakes
 *   4. POST /intakes (create)
 *   5. POST /intakes/:id/submit
 *   6. POST /intakes/:id/analysis-drafts/mock
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
  if (res.status !== expectedStatus) {
    throw new Error(`expected ${expectedStatus}, got ${res.status}`);
  }
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
    throw new Error(`expected ${expectedStatus}, got ${res.status} — ${text.slice(0, 120)}`);
  }
  return res.json();
}

const actorHeaders = {
  "x-actor-id": "smoke-test-user",
  "x-actor-role": "intake_owner",
  "x-actor-name": "Smoke Test",
};

console.log(`\nProject Intake OS — API Smoke Test`);
console.log(`Target: ${BASE}\n`);

// 1. Liveness
await check("GET /health returns ok", async () => {
  const body = await get("/health");
  if (body.status !== "ok") throw new Error(`expected status=ok, got ${body.status}`);
});

// 2. Swagger
await check("GET /docs-json returns OpenAPI spec", async () => {
  const body = await get("/docs-json");
  if (!body.openapi) throw new Error("missing openapi field");
});

// 3. List intakes
let intakes;
await check("GET /intakes returns array", async () => {
  intakes = await get("/intakes");
  if (!Array.isArray(intakes)) throw new Error("expected array");
});

// 4. Create intake
let intake;
await check("POST /intakes creates a new intake", async () => {
  intake = await post(
    "/intakes",
    {
      title: "Smoke Test Intake",
      description: "Created by smoke-api.mjs to verify the API is functional.",
      requester: "CI/CD",
      department: "Engineering",
      projectType: "internal_tool",
    },
    actorHeaders,
    201,
  );
  if (!intake.id) throw new Error("missing id on created intake");
});

// 5. Submit intake
let submitted;
if (intake) {
  await check("POST /intakes/:id/submit transitions to submitted", async () => {
    submitted = await post(`/intakes/${intake.id}/submit`, {}, actorHeaders, 201);
    if (submitted.status !== "submitted") throw new Error(`expected submitted, got ${submitted.status}`);
  });
}

// 6. Generate mock analysis draft (optional — governance feature)
if (submitted) {
  await check(
    "POST /intakes/:id/analysis-drafts/mock generates a draft",
    async () => {
      const withDraft = await post(`/intakes/${submitted.id}/analysis-drafts/mock`, {}, actorHeaders, 201);
      if (!withDraft.latestAnalysisDraft?.id) throw new Error("missing latestAnalysisDraft.id");
      if (withDraft.latestAnalysisDraft.reviewStatus !== "draft") {
        throw new Error(`expected reviewStatus=draft, got ${withDraft.latestAnalysisDraft.reviewStatus}`);
      }
    },
    false, // optional — skip if fails (e.g. intake not in right state)
  );
}

// 7. DB health (optional — skip if DB not ready)
await check(
  "GET /health/db reports database reachable",
  async () => {
    const body = await get("/health/db");
    if (body.status !== "ok") throw new Error(`expected status=ok, got ${body.status}`);
    if (body.database !== "reachable") throw new Error(`expected database=reachable, got ${body.database}`);
  },
  false, // optional
);

console.log(`\n  Summary: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  console.error(`Smoke test FAILED — ${failed} required check(s) did not pass.\n`);
  process.exit(1);
} else {
  console.log(`Smoke test PASSED.\n`);
}
