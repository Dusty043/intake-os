# Live-streaming Verification + UI/Intake QoL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify and merge the already-built Discovery live-streaming feature (Q-UX-1) against the deployed oreochiserver environment, then fix two UI bugs (intake description min-length validation, Discovery's localStorage-based intake link) bundled with three related QoL improvements (validation UX, streaming a11y, distribution toast, unsaved-changes guard).

**Architecture:** No new subsystems. All changes are targeted edits to existing Next.js pages/components in `apps/web/src/app` and `apps/web/src/lib`, plus one already-built NestJS SSE route being verified (not modified) on the deployed server. Two new small frontend-only modules (`project-types.ts`, `intake-form-validation.ts`) centralize values that were previously hardcoded inline, with parity tests guarding them against the backend's canonical constants.

**Tech Stack:** Next.js 15 (App Router) + React 19 on the frontend (`apps/web`), NestJS on the backend (`apps/api`), Vitest + React Testing Library for frontend tests, `node --test` for backend tests. Deployment via SSH to `oreochiserver` using the repo's `deploy/deploy-server.sh`.

## Global Constraints

- Server-side checks must enforce role/state/approval/provisioning rules — never rely on frontend visibility alone (CLAUDE.md Safety Rules). Task 1 verifies this holds for the SSE route; no task in this plan weakens it.
- Ask for human confirmation before modifying authentication or authorization (CLAUDE.md Safety Rules). Task 1 is verification-only; if verification reveals a real auth bug, STOP and confirm the fix approach with the user before editing `discovery.controller.ts` or any auth guard.
- Secrets must not be committed or logged (CLAUDE.md Forbidden Actions). No task in this plan touches `.env`/secrets, but Task 1's SSH/curl commands must not paste real API keys into commit messages or task logs.
- Git workflow for this batch: feature branch + PR per task (user's explicit choice for 2026-07-16, documented in `docs/ai/tasks/TASK-0066`) — not the direct-to-main pattern used in the prior session's bug-fix chain.
- Every task's commit message follows this repo's existing convention (`fix:`/`feat:`/`test:` prefix, imperative, one line + optional body) — see recent `git log` entries in `docs/ai/tasks/TASK-0065`.
- Frontend tests run via `cd apps/web && npm test` (Vitest); backend tests via `npm test` from the repo root (`node --test tests/*.test.mjs`, requires `npm run build:core` first per `package.json`).
- Follow this repo's own `docs/ai/tasks/TASK-00xx-*.md` logging convention (not the generic superpowers spec location) for each task's implementation record — CLAUDE.md's Logging Requirement takes precedence.

---

### Task 1: Verify Q-UX-1 Discovery live-streaming on oreochiserver

**Files:**
- None modified (verification only) unless a bug is found, in which case: `apps/api/src/modules/discovery/discovery.controller.ts` or `apps/web/src/components/discovery/DiscoveryChat.tsx` (minimal fix only, scoped at discovery time)
- Task log: `docs/ai/tasks/TASK-0067-verify-discovery-live-streaming.md` (new)

**Interfaces:**
- Consumes: existing `feat/discovery-live-streaming` branch (5 commits, TASK-0048–0052), already merged-ready code — no new interfaces from this plan.
- Produces: a merged `main` with live-streaming shipped, and Q-UX-1 closed in `docs/ai/OPEN_QUESTIONS.md`. Later tasks in this plan do not depend on this one's code (they touch different files) but this task is sequenced first per `docs/ai/tasks/TASK-0066`'s reasoning: land the already-built branch before other fixes cause drift against it.

- [ ] **Step 1: Confirm the branch and push it**

```bash
git -C /Users/oreo/code-work/project-intake-os/project-intake-os fetch origin
git -C /Users/oreo/code-work/project-intake-os/project-intake-os log --oneline origin/main..feat/discovery-live-streaming
git -C /Users/oreo/code-work/project-intake-os/project-intake-os push origin feat/discovery-live-streaming
```

Expected: the log shows the 5 TASK-0048–0052 commits ahead of `main`; push succeeds (branch already exists locally per prior session).

- [ ] **Step 2: Deploy the branch to oreochiserver**

```bash
ssh oreochiserver 'cd ~/intake-os && git fetch origin && git checkout feat/discovery-live-streaming && git pull && bash deploy/deploy-server.sh'
```

Expected: build completes, containers restart. If `git checkout` fails on local server-side changes, investigate before forcing — do not `git checkout -f` blindly (Safety Rules: don't discard state without checking first).

- [ ] **Step 3: Verify the deployed commit and health**

```bash
ssh oreochiserver 'cd ~/intake-os && git rev-parse --short HEAD && docker compose ps'
ssh oreochiserver 'cd ~/intake-os && bash deploy/healthcheck-server.sh'
```

Expected: HEAD matches the branch tip; healthcheck passes; no stray/unhealthy containers.

- [ ] **Step 4: Verify the SSE route's auth guard with curl**

Find an existing discovery session ID owned by a known dev-mode actor (or create one first via `POST /discovery`), then:

```bash
# Should stream events (owner request) — Ctrl-C after a few seconds
curl -N -H "x-actor-id: <owner-actor-id>" -H "x-actor-role: request_creator" -H "x-actor-name: Test" \
  https://<oreochiserver-host>/discovery/<session-id>/stream

# Should be rejected (mismatched owner, non-admin role) — expect 404 per requireOwnedSession's
# design (apps/api/src/modules/discovery/discovery.controller.ts:73-79), not a distinguishable 403
curl -i -H "x-actor-id: some-other-user" -H "x-actor-role: request_creator" -H "x-actor-name: Other" \
  https://<oreochiserver-host>/discovery/<session-id>/stream
```

Expected: first call streams `event: heartbeat`/`event: stage-start` frames; second call returns 404.

- [ ] **Step 5: Verify in-browser with a real (non-mock) Discovery turn**

Confirm the server's `.env.server` has `AI_PROVIDER=openai` (not `mock`) — if it's still `mock`, this step cannot exercise the real streaming path; flag that as a blocker rather than declaring success on a mock-provider run.

Open the deployed app in a browser, start a new Discovery session, send a message, and confirm the "Conversation" panel header shows live stage labels (e.g. "Understanding your request…") while the AI is processing, not just a static "AI is thinking…" placeholder.

- [ ] **Step 6: Merge and close out Q-UX-1**

```bash
git -C /Users/oreo/code-work/project-intake-os/project-intake-os checkout main
git -C /Users/oreo/code-work/project-intake-os/project-intake-os pull
gh pr create --repo Dusty043/project-intake-os --base main --head feat/discovery-live-streaming \
  --title "feat: Discovery live-streaming (TASK-0048-0052)" \
  --body "Verified against oreochiserver: SSE auth guard rejects non-owners (404), streams heartbeat/stage events for the owner, and the frontend renders live stage labels during a real OpenAI-backed Discovery turn. Closes Q-UX-1."
```

Wait for CI (if any) then merge. Update `docs/ai/OPEN_QUESTIONS.md` Q-UX-1 row status from "implemented, not yet shipped" to "shipped, verified 2026-07-16" and write `docs/ai/tasks/TASK-0067-verify-discovery-live-streaming.md` documenting the curl/browser verification evidence.

- [ ] **Step 7: Commit the doc updates**

```bash
git add docs/ai/OPEN_QUESTIONS.md docs/ai/tasks/TASK-0067-verify-discovery-live-streaming.md docs/ai/BUILD_LOG.md
git commit -m "docs: close Q-UX-1 after live-streaming verification on oreochiserver"
git push
```

---

### Task 2: Shared frontend constants module + drift-guard parity tests

**Files:**
- Create: `apps/web/src/lib/project-types.ts`
- Create: `apps/web/src/lib/intake-form-validation.ts`
- Test: `apps/web/src/lib/__tests__/project-types-parity.test.ts`
- Test: `apps/web/src/lib/__tests__/intake-form-validation.test.ts`
- Test: `apps/web/src/lib/__tests__/intake-form-validation-parity.test.ts`

**Interfaces:**
- Produces: `PROJECT_TYPES: ReadonlyArray<{value: string; label: string}>` from `project-types.ts`; `validateIntakeForm(form): IntakeFormErrors`, `isIntakeFormDirty(form): boolean`, and constants `MAX_INTAKE_TITLE_LENGTH`, `MIN_INTAKE_DESCRIPTION_LENGTH`, `MAX_INTAKE_DESCRIPTION_LENGTH`, `MAX_REQUESTER_NAME_LENGTH`, `MAX_DEPARTMENT_NAME_LENGTH` from `intake-form-validation.ts`. Task 3 and Task 4 both import from these exact names.

- [ ] **Step 1: Write the failing tests for the validator**

Create `apps/web/src/lib/__tests__/intake-form-validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateIntakeForm, isIntakeFormDirty } from "../intake-form-validation";

const VALID_FORM = {
  title: "Test project",
  description: "This description is long enough to pass validation.",
  requester: "Jane",
  department: "",
};

describe("validateIntakeForm", () => {
  it("returns no errors for a fully valid form", () => {
    expect(validateIntakeForm(VALID_FORM)).toEqual({});
  });

  it("flags a description under the 20-character minimum", () => {
    const errors = validateIntakeForm({ ...VALID_FORM, description: "too short" });
    expect(errors.description).toMatch(/at least 20 characters/i);
  });

  it("flags an empty title", () => {
    const errors = validateIntakeForm({ ...VALID_FORM, title: "  " });
    expect(errors.title).toMatch(/required/i);
  });

  it("flags a title over the 200-character maximum", () => {
    const errors = validateIntakeForm({ ...VALID_FORM, title: "x".repeat(201) });
    expect(errors.title).toMatch(/200 characters or fewer/i);
  });

  it("flags an empty requester", () => {
    const errors = validateIntakeForm({ ...VALID_FORM, requester: "" });
    expect(errors.requester).toMatch(/required/i);
  });

  it("does not flag an empty department (optional field)", () => {
    const errors = validateIntakeForm({ ...VALID_FORM, department: "" });
    expect(errors.department).toBeUndefined();
  });

  it("flags a department over the 100-character maximum", () => {
    const errors = validateIntakeForm({ ...VALID_FORM, department: "x".repeat(101) });
    expect(errors.department).toMatch(/100 characters or fewer/i);
  });
});

describe("isIntakeFormDirty", () => {
  it("is false for an all-empty form", () => {
    expect(isIntakeFormDirty({ title: "", description: "", requester: "", department: "" })).toBe(false);
  });

  it("is true once any field has content", () => {
    expect(isIntakeFormDirty({ title: "x", description: "", requester: "", department: "" })).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/web && npx vitest run src/lib/__tests__/intake-form-validation.test.ts
```

Expected: FAIL — `Cannot find module '../intake-form-validation'`.

- [ ] **Step 3: Implement `intake-form-validation.ts`**

Create `apps/web/src/lib/intake-form-validation.ts`:

```ts
// Duplicated from apps/api/src/common/validation-constants.ts — the frontend
// and backend are separate deployable packages with no shared import path
// today (see Task 2's parity test, which guards these values against drift).
export const MAX_INTAKE_TITLE_LENGTH = 200;
export const MIN_INTAKE_DESCRIPTION_LENGTH = 20;
export const MAX_INTAKE_DESCRIPTION_LENGTH = 5000;
export const MAX_REQUESTER_NAME_LENGTH = 100;
export const MAX_DEPARTMENT_NAME_LENGTH = 100;

export type IntakeFormValues = {
  title: string;
  description: string;
  requester: string;
  department?: string;
};

export type IntakeFormErrors = {
  title?: string;
  description?: string;
  requester?: string;
  department?: string;
};

export function validateIntakeForm(form: IntakeFormValues): IntakeFormErrors {
  const errors: IntakeFormErrors = {};

  if (!form.title.trim()) {
    errors.title = "Title is required.";
  } else if (form.title.length > MAX_INTAKE_TITLE_LENGTH) {
    errors.title = `Title must be ${MAX_INTAKE_TITLE_LENGTH} characters or fewer.`;
  }

  if (!form.description.trim()) {
    errors.description = "Description is required.";
  } else if (form.description.trim().length < MIN_INTAKE_DESCRIPTION_LENGTH) {
    errors.description = `Description must be at least ${MIN_INTAKE_DESCRIPTION_LENGTH} characters.`;
  } else if (form.description.length > MAX_INTAKE_DESCRIPTION_LENGTH) {
    errors.description = `Description must be ${MAX_INTAKE_DESCRIPTION_LENGTH} characters or fewer.`;
  }

  if (!form.requester.trim()) {
    errors.requester = "Requester is required.";
  } else if (form.requester.length > MAX_REQUESTER_NAME_LENGTH) {
    errors.requester = `Requester must be ${MAX_REQUESTER_NAME_LENGTH} characters or fewer.`;
  }

  if (form.department && form.department.length > MAX_DEPARTMENT_NAME_LENGTH) {
    errors.department = `Department must be ${MAX_DEPARTMENT_NAME_LENGTH} characters or fewer.`;
  }

  return errors;
}

export function isIntakeFormDirty(form: IntakeFormValues): boolean {
  return Boolean(form.title || form.description || form.requester || form.department);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd apps/web && npx vitest run src/lib/__tests__/intake-form-validation.test.ts
```

Expected: PASS, all 9 assertions green.

- [ ] **Step 5: Create the shared PROJECT_TYPES module**

Create `apps/web/src/lib/project-types.ts`:

```ts
// Duplicated (values only, not labels) from src/domain/types.ts's `projectTypes`
// — see Task 2's parity test, which guards this list against drift.
export const PROJECT_TYPES = [
  { value: "internal_tool",         label: "Internal Tool"        },
  { value: "internal_dashboard",    label: "Dashboard"            },
  { value: "api_service",           label: "API Service"          },
  { value: "client_portal",         label: "Client Portal"        },
  { value: "saas_platform",         label: "SaaS Platform"        },
  { value: "ai_workflow_tool",      label: "AI Workflow Tool"     },
  { value: "data_sync_integration", label: "Data Pipeline"        },
  { value: "n8n_automation",        label: "Automation Script"    },
  { value: "reporting_automation",  label: "Reporting Automation" },
  { value: "discovery_research",    label: "Discovery / Research" },
] as const;
```

- [ ] **Step 6: Write and run the parity tests**

Create `apps/web/src/lib/__tests__/project-types-parity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PROJECT_TYPES } from "../project-types";
import { projectTypes } from "../../../../../src/domain/types";

describe("PROJECT_TYPES parity", () => {
  it("the frontend dropdown's values match the canonical domain registry exactly", () => {
    const frontendValues = new Set(PROJECT_TYPES.map((pt) => pt.value));
    const domainValues = new Set(projectTypes);
    expect(frontendValues).toEqual(domainValues);
  });
});
```

Create `apps/web/src/lib/__tests__/intake-form-validation-parity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import * as frontend from "../intake-form-validation";
import * as backend from "../../../../api/src/common/validation-constants";

describe("intake validation constants parity", () => {
  it("frontend length limits match the backend's validation-constants.ts exactly", () => {
    expect(frontend.MAX_INTAKE_TITLE_LENGTH).toBe(backend.MAX_INTAKE_TITLE_LENGTH);
    expect(frontend.MIN_INTAKE_DESCRIPTION_LENGTH).toBe(backend.MIN_INTAKE_DESCRIPTION_LENGTH);
    expect(frontend.MAX_INTAKE_DESCRIPTION_LENGTH).toBe(backend.MAX_INTAKE_DESCRIPTION_LENGTH);
    expect(frontend.MAX_REQUESTER_NAME_LENGTH).toBe(backend.MAX_REQUESTER_NAME_LENGTH);
    expect(frontend.MAX_DEPARTMENT_NAME_LENGTH).toBe(backend.MAX_DEPARTMENT_NAME_LENGTH);
  });
});
```

```bash
cd apps/web && npx vitest run src/lib/__tests__/project-types-parity.test.ts src/lib/__tests__/intake-form-validation-parity.test.ts
```

Expected: both PASS (values currently match; these tests exist to catch future drift, not fix an existing mismatch).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/project-types.ts apps/web/src/lib/intake-form-validation.ts apps/web/src/lib/__tests__/project-types-parity.test.ts apps/web/src/lib/__tests__/intake-form-validation.test.ts apps/web/src/lib/__tests__/intake-form-validation-parity.test.ts
git commit -m "feat: add shared frontend project-type/validation constants with drift-guard parity tests"
```

---

### Task 3: Wire validation into the intake form UI, fix min-length bug, delete dead field

**Files:**
- Modify: `apps/web/src/app/intakes/new/page.tsx`
- Test: `apps/web/src/app/intakes/new/__tests__/page.test.tsx` (new)

**Interfaces:**
- Consumes: `PROJECT_TYPES` from `@/lib/project-types`; `validateIntakeForm`, `IntakeFormErrors`, `MAX_INTAKE_TITLE_LENGTH`, `MIN_INTAKE_DESCRIPTION_LENGTH`, `MAX_INTAKE_DESCRIPTION_LENGTH`, `MAX_REQUESTER_NAME_LENGTH`, `MAX_DEPARTMENT_NAME_LENGTH` from `@/lib/intake-form-validation` (Task 2).
- Produces: no new exports consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/app/intakes/new/__tests__/page.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import NewIntakePage from "../page";
import * as apiClient from "@/lib/api-client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/api-client", () => ({
  createIntake: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Project Title/), "Test project");
  await user.type(screen.getByLabelText(/Requester/), "Jane");
  await user.type(
    screen.getByLabelText(/Detailed Description/),
    "This description is long enough to pass validation.",
  );
}

describe("NewIntakePage validation", () => {
  it("shows an inline error and blocks submit when description is under the 20-char minimum", async () => {
    const user = userEvent.setup();
    render(<NewIntakePage />);

    await user.type(screen.getByLabelText(/Project Title/), "Test project");
    await user.type(screen.getByLabelText(/Requester/), "Jane");
    await user.type(screen.getByLabelText(/Detailed Description/), "too short");
    await user.click(screen.getByRole("button", { name: /Create Intake/ }));

    expect(await screen.findByText(/at least 20 characters/i)).toBeInTheDocument();
    expect(apiClient.createIntake).not.toHaveBeenCalled();
  });

  it("submits successfully once all fields meet the validation rules", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.createIntake).mockResolvedValue({ id: "intake-1" } as ReturnType<typeof apiClient.createIntake> extends Promise<infer T> ? T : never);
    render(<NewIntakePage />);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /Create Intake/ }));

    await waitFor(() => expect(apiClient.createIntake).toHaveBeenCalledTimes(1));
  });

  it("shows a live character counter for the title field", async () => {
    const user = userEvent.setup();
    render(<NewIntakePage />);
    await user.type(screen.getByLabelText(/Project Title/), "Test project");
    expect(screen.getByText("12/200")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/web && npx vitest run src/app/intakes/new/__tests__/page.test.tsx
```

Expected: FAIL — the min-length test fails because the current handler only checks non-emptiness, so `createIntake` gets called (or the counter/error text doesn't exist yet).

- [ ] **Step 3: Rewrite the form to use the shared validator, add counters, delete dead field**

Replace the full contents of `apps/web/src/app/intakes/new/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useActor } from "@/components/ActorProvider";
import { ErrorBanner } from "@/components/ErrorBanner";
import { createIntake } from "@/lib/api-client";
import type { CreateIntakeInput } from "@/lib/types";
import { PROJECT_TYPES } from "@/lib/project-types";
import {
  validateIntakeForm,
  MAX_INTAKE_TITLE_LENGTH,
  MIN_INTAKE_DESCRIPTION_LENGTH,
  MAX_INTAKE_DESCRIPTION_LENGTH,
  MAX_REQUESTER_NAME_LENGTH,
  MAX_DEPARTMENT_NAME_LENGTH,
  type IntakeFormErrors,
} from "@/lib/intake-form-validation";

export default function NewIntakePage() {
  const { actor } = useActor();
  const router = useRouter();

  const [form, setForm] = useState<CreateIntakeInput>({
    title: "",
    description: "",
    requester: "",
    department: "",
    projectType: "internal_tool",
  });
  const [errors, setErrors] = useState<IntakeFormErrors>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof CreateIntakeInput, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fieldErrors = validateIntakeForm(form);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setLoading(true);
    setError(null);
    try {
      const intake = await createIntake(form, actor);
      router.push(`/intakes/${intake.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create intake.");
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400 mb-5">
        <Link href="/intakes" className="hover:text-indigo-600">Intakes</Link>
        <span className="mx-2">/</span>
        <span className="text-brand-text font-medium">New Intake</span>
      </nav>

      {/* Workflow preview */}
      <div className="card p-4 mb-6 bg-surface-subtle border-indigo-100">
        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-2">
          Workflow
        </p>
        <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
          {["Submission", "AI Draft", "Human Review", "Gate 1", "Gate 2", "Distribution Preview"].map(
            (s, i, arr) => (
              <span key={s} className="flex items-center gap-2">
                <span className="bg-white border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full">
                  {s}
                </span>
                {i < arr.length - 1 && <span className="text-gray-300">→</span>}
              </span>
            ),
          )}
        </div>
      </div>

      <div className="card p-6">
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-brand-text">New Intake Request</h1>
          <p className="text-sm text-brand-muted mt-1">
            Use this form to initiate a new project intake. Include enough context for analysis and review.
          </p>
        </div>

        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        <form onSubmit={(e) => { void handleSubmit(e); }} className="mt-5 space-y-5">
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="title" className="form-label">Project Title *</label>
              <span className="text-xs text-gray-400">{form.title.length}/{MAX_INTAKE_TITLE_LENGTH}</span>
            </div>
            <input
              id="title"
              type="text"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className="form-input"
              placeholder="e.g. Client Billing Portal"
              maxLength={MAX_INTAKE_TITLE_LENGTH}
              required
              disabled={loading}
              aria-invalid={!!errors.title}
            />
            {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="projectType" className="form-label">Project Type</label>
              <select
                id="projectType"
                value={form.projectType}
                onChange={(e) => set("projectType", e.target.value)}
                className="form-input"
                disabled={loading}
              >
                {PROJECT_TYPES.map((pt) => (
                  <option key={pt.value} value={pt.value}>{pt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="requester" className="form-label">Requester *</label>
                <span className="text-xs text-gray-400">{form.requester.length}/{MAX_REQUESTER_NAME_LENGTH}</span>
              </div>
              <input
                id="requester"
                type="text"
                value={form.requester}
                onChange={(e) => set("requester", e.target.value)}
                className="form-input"
                placeholder="Team or person"
                maxLength={MAX_REQUESTER_NAME_LENGTH}
                required
                disabled={loading}
                aria-invalid={!!errors.requester}
              />
              {errors.requester && <p className="text-xs text-red-600 mt-1">{errors.requester}</p>}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="department" className="form-label">Department</label>
              <span className="text-xs text-gray-400">{(form.department ?? "").length}/{MAX_DEPARTMENT_NAME_LENGTH}</span>
            </div>
            <input
              id="department"
              type="text"
              value={form.department ?? ""}
              onChange={(e) => set("department", e.target.value)}
              className="form-input"
              placeholder="e.g. Finance"
              maxLength={MAX_DEPARTMENT_NAME_LENGTH}
              disabled={loading}
              aria-invalid={!!errors.department}
            />
            {errors.department && <p className="text-xs text-red-600 mt-1">{errors.department}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="description" className="form-label">Detailed Description *</label>
              <span className="text-xs text-gray-400">{form.description.length}/{MAX_INTAKE_DESCRIPTION_LENGTH}</span>
            </div>
            <textarea
              id="description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className="form-textarea h-32"
              placeholder="Describe the project goals, context, and requirements…"
              maxLength={MAX_INTAKE_DESCRIPTION_LENGTH}
              required
              disabled={loading}
              aria-invalid={!!errors.description}
            />
            <p className="text-xs text-gray-400 mt-1">Minimum {MIN_INTAKE_DESCRIPTION_LENGTH} characters.</p>
            {errors.description && <p className="text-xs text-red-600 mt-1">{errors.description}</p>}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Creating intake…" : "Create Intake"}
            </button>
            <Link href="/intakes" className="btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
```

Note what changed from the original: the hardcoded `PROJECT_TYPES` and unused `SOURCES` arrays are gone (now imported, and deleted respectively); the ad-hoc `if (!form.title.trim() || ...)` check is replaced by `validateIntakeForm`; every field gained a `maxLength` attr, a live counter, and an inline error.

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd apps/web && npx vitest run src/app/intakes/new/__tests__/page.test.tsx
```

Expected: PASS, all 3 tests green.

- [ ] **Step 5: Run the full frontend suite and typecheck to catch regressions**

```bash
cd apps/web && npm test && npm run typecheck
```

Expected: all pass, no type errors from the removed `PROJECT_TYPES`/`SOURCES` consts or new imports.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/intakes/new/page.tsx apps/web/src/app/intakes/new/__tests__/page.test.tsx
git commit -m "fix: intake form description validation matches the 20-char backend minimum, add counters, delete dead SOURCES field"
```

---

### Task 4: Fix Discovery's localStorage-based intake link (bug #2)

**Files:**
- Modify: `apps/web/src/lib/discovery-types.ts`
- Modify: `apps/web/src/app/discovery/page.tsx`
- Modify: `apps/web/src/app/discovery/[id]/page.tsx`
- Test: `apps/web/src/app/discovery/__tests__/page.test.tsx` (new)

**Interfaces:**
- Consumes: nothing from prior tasks in this plan.
- Produces: `DiscoverySession.linkedIntakeId?: string | null` — no later task in this plan consumes it further.

- [ ] **Step 1: Add the field to the frontend type**

In `apps/web/src/lib/discovery-types.ts`, modify the `DiscoverySession` type (currently lines 165-179):

```ts
export type DiscoverySession = {
  id: string;
  userId: string;
  status: DiscoveryStatus;
  messages: DiscoveryMessage[];
  timeline: DiscoveryTimelineEvent[];
  intent: DiscoveryIntent | null;
  problemFrame: DiscoveryProblemFrame | null;
  solutionOptions: SolutionOption[];
  clarificationQuestions: ClarificationQuestion[];
  selectedSolutionId: string | null;
  proposal: DiscoveryProposal | null;
  manifest: DiscoveryManifest | null;
  confidence: DiscoveryConfidence;
  linkedIntakeId?: string | null;
};
```

(Only the added `linkedIntakeId?: string | null;` line is new — everything else in the type is unchanged.)

- [ ] **Step 2: Write the failing test**

Create `apps/web/src/app/discovery/__tests__/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DiscoveryListPage from "../page";
import type { DiscoverySession } from "@/lib/discovery-types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const CONFIDENCE = {
  problemUnderstanding: 1,
  solutionFit: 1,
  scopeClarity: 1,
  technicalFeasibility: 1,
  stakeholderClarity: 1,
  downstreamMapping: 1,
};

function makeSession(overrides: Partial<DiscoverySession>): DiscoverySession {
  return {
    id: "sess-1",
    userId: "actor-1",
    status: "sent_to_evaluation",
    messages: [],
    timeline: [],
    intent: null,
    problemFrame: null,
    solutionOptions: [],
    clarificationQuestions: [],
    selectedSolutionId: null,
    proposal: null,
    manifest: null,
    confidence: CONFIDENCE,
    ...overrides,
  };
}

vi.mock("@/lib/discovery-client", () => ({
  listDiscoverySessions: vi.fn(),
  startDiscovery: vi.fn(),
  generateSolutions: vi.fn(),
}));

import * as discoveryClient from "@/lib/discovery-client";

describe("DiscoveryListPage", () => {
  it("shows the 'View intake →' link from session.linkedIntakeId, not localStorage", async () => {
    vi.mocked(discoveryClient.listDiscoverySessions).mockResolvedValue([
      makeSession({ linkedIntakeId: "intake-42" }),
    ]);
    // Deliberately do not touch localStorage — the old bug required this key to
    // be set for the link to appear; the fix must not depend on it.

    render(<DiscoveryListPage />);

    const link = await screen.findByRole("link", { name: /View intake/i });
    expect(link).toHaveAttribute("href", "/intakes/intake-42");
  });

  it("does not show the link when linkedIntakeId is absent", async () => {
    vi.mocked(discoveryClient.listDiscoverySessions).mockResolvedValue([
      makeSession({ linkedIntakeId: undefined }),
    ]);

    render(<DiscoveryListPage />);

    await screen.findByText(/sess-1/i);
    expect(screen.queryByRole("link", { name: /View intake/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd apps/web && npx vitest run src/app/discovery/__tests__/page.test.tsx
```

Expected: FAIL — the current code reads `localStorage`, which is empty in the test, so no link renders even in the first test case.

- [ ] **Step 4: Fix `discovery/page.tsx`**

In `apps/web/src/app/discovery/page.tsx`, delete the `getLinkedIntakeId` function (lines 41-47):

```ts
function getLinkedIntakeId(sessionId: string): string | null {
  try {
    return localStorage.getItem(`pit:discovery:intake:${sessionId}`);
  } catch {
    return null;
  }
}
```

And change the two lines that use it (around line 150-152):

```ts
                  const title = getSessionTitle(session);
                  const linkedIntakeId = session.status === "sent_to_evaluation"
                    ? getLinkedIntakeId(session.id)
                    : null;
```

to:

```ts
                  const title = getSessionTitle(session);
                  const linkedIntakeId = session.status === "sent_to_evaluation"
                    ? session.linkedIntakeId
                    : null;
```

- [ ] **Step 5: Fix `discovery/[id]/page.tsx`**

In `apps/web/src/app/discovery/[id]/page.tsx`:

Delete the `linkedIntakeId` state (line 45) and its localStorage-based assignment inside `load()` (lines 62-66):

```ts
  const [linkedIntakeId, setLinkedIntakeId] = useState<string | null>(null);
```
```ts
      if (data.status === "sent_to_evaluation") {
        try {
          setLinkedIntakeId(localStorage.getItem(`pit:discovery:intake:${id}`));
        } catch {}
      }
```

Delete the localStorage write inside `handleSendToEvaluation` (lines 191-193):

```ts
          try {
            localStorage.setItem(`pit:discovery:intake:${id}`, record.id);
          } catch {}
```

Change the JSX reference from the deleted `linkedIntakeId` state variable to `session.linkedIntakeId` (line 270):

```tsx
          {linkedIntakeId ? (
```
becomes
```tsx
          {session.linkedIntakeId ? (
```
(the rest of that ternary, lines 271-284, is unchanged — only the condition/state source changes).

- [ ] **Step 6: Run the test to verify it passes**

```bash
cd apps/web && npx vitest run src/app/discovery/__tests__/page.test.tsx
```

Expected: PASS, both cases green.

- [ ] **Step 7: Run the full frontend suite and typecheck**

```bash
cd apps/web && npm test && npm run typecheck
```

Expected: all pass — confirms no other file still references the deleted `getLinkedIntakeId`/`linkedIntakeId` state.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/discovery-types.ts apps/web/src/app/discovery/page.tsx "apps/web/src/app/discovery/[id]/page.tsx" apps/web/src/app/discovery/__tests__/page.test.tsx
git commit -m "fix: Discovery 'View intake' link reads server-persisted linkedIntakeId instead of localStorage"
```

---

### Task 5: Add aria-live region to Discovery's streaming stage indicator

**Files:**
- Modify: `apps/web/src/components/discovery/DiscoveryChat.tsx`
- Test: `apps/web/src/components/discovery/__tests__/DiscoveryChat.test.tsx` (new)

**Interfaces:**
- Consumes: nothing from prior tasks.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/discovery/__tests__/DiscoveryChat.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiscoveryChat } from "../DiscoveryChat";

const CONFIDENCE = {
  problemUnderstanding: 1,
  solutionFit: 1,
  scopeClarity: 1,
  technicalFeasibility: 1,
  stakeholderClarity: 1,
  downstreamMapping: 1,
};

const BASE_PROPS = {
  messages: [],
  clarificationQuestions: [],
  confidence: CONFIDENCE,
  proposal: null,
  manifest: null,
  discoveryStatus: "conversation_started" as const,
  onSendMessage: vi.fn(),
  onAnswerClarification: vi.fn(),
  onSkipClarifications: vi.fn(),
  onSendToEvaluation: vi.fn(),
};

describe("DiscoveryChat streaming status announcement", () => {
  it("renders the busy stage text inside a persistent aria-live region", () => {
    render(
      <DiscoveryChat
        {...BASE_PROPS}
        busy={true}
        activeStages={new Set(["intent_extraction"])}
      />,
    );
    const region = screen.getByText(/Understanding your request/i).closest('[aria-live]');
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("keeps the aria-live region mounted (not conditionally rendered) even when not busy", () => {
    const { container } = render(
      <DiscoveryChat {...BASE_PROPS} busy={false} activeStages={new Set()} />,
    );
    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/web && npx vitest run src/components/discovery/__tests__/DiscoveryChat.test.tsx
```

Expected: FAIL — no `aria-live` attribute exists yet in the component.

- [ ] **Step 3: Add the persistent aria-live region**

In `apps/web/src/components/discovery/DiscoveryChat.tsx`, replace the header block (currently lines 402-410):

```tsx
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
        <p className="section-label mb-0">Conversation</p>
        {busy && (
          <span className="text-xs text-indigo-600 font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            {progressText(activeStages)}
          </span>
        )}
      </div>
```

with:

```tsx
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
        <p className="section-label mb-0">Conversation</p>
        <span aria-live="polite" className="text-xs text-indigo-600 font-medium flex items-center gap-1.5 min-h-[1rem]">
          {busy && (
            <>
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
              {progressText(activeStages)}
            </>
          )}
        </span>
      </div>
```

The `aria-live` region must stay mounted across renders (moved to the outer `<span>`, which always renders) rather than being wrapped by the `{busy && (...)}` conditional — screen readers only announce changes to a live region already present in the DOM, not one that just mounted.

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd apps/web && npx vitest run src/components/discovery/__tests__/DiscoveryChat.test.tsx
```

Expected: PASS, both cases green.

- [ ] **Step 5: Run the full frontend suite**

```bash
cd apps/web && npm test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/discovery/DiscoveryChat.tsx apps/web/src/components/discovery/__tests__/DiscoveryChat.test.tsx
git commit -m "feat: announce Discovery streaming stage transitions via aria-live region"
```

---

### Task 6: Wire Execute Distribution success into a toast

**Files:**
- Modify: `apps/web/src/app/intakes/[id]/page.tsx`
- Test: `apps/web/src/app/intakes/[id]/__tests__/DistributionTab.test.tsx` (new)

**Interfaces:**
- Consumes: nothing from prior tasks.
- Produces: nothing consumed by later tasks. (`DistributionTab` gains a required `onSuccess` prop — its one call site in the same file is updated in this same task.)

- [ ] **Step 1: Export `DistributionTab` so it's independently testable**

In `apps/web/src/app/intakes/[id]/page.tsx`, change the function declaration (line 1029) from:

```tsx
function DistributionTab({
```
to:
```tsx
export function DistributionTab({
```

- [ ] **Step 2: Write the failing test**

Create `apps/web/src/app/intakes/[id]/__tests__/DistributionTab.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { DistributionTab } from "../page";
import * as apiClient from "@/lib/api-client";
import type { ProjectIntakeRecord, UiActor } from "@/lib/types";

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof apiClient>("@/lib/api-client");
  return {
    ...actual,
    executeDistribution: vi.fn(),
    getIntake: vi.fn(),
    listProvisioningRuns: vi.fn(),
  };
});

const actor: UiActor = { id: "u1", role: "request_creator", name: "Test User" };

const intake: ProjectIntakeRecord = {
  id: "intake-1",
  title: "Test intake",
  status: "approved",
  provisioningPlan: { id: "plan-1", status: "ready_for_provisioning" },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiClient.listProvisioningRuns).mockResolvedValue([]);
});

describe("DistributionTab", () => {
  it("calls onSuccess with a message once distribution executes successfully", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.executeDistribution).mockResolvedValue({
      id: "run-1",
      intakeId: "intake-1",
      planId: "plan-1",
      status: "executing",
      kind: "initial",
      triggeredById: "u1",
      triggeredByRole: "request_creator",
      startedAt: new Date(0).toISOString(),
      targets: [],
    });
    vi.mocked(apiClient.getIntake).mockResolvedValue({ ...intake, status: "provisioning" });

    const onSuccess = vi.fn();
    render(
      <DistributionTab
        intake={intake}
        actor={actor}
        onIntakeUpdate={vi.fn()}
        onSuccess={onSuccess}
      />,
    );

    await user.click(await screen.findByRole("button", { name: /Execute Distribution/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(expect.stringMatching(/executing/i)));
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd apps/web && npx vitest run "src/app/intakes/[id]/__tests__/DistributionTab.test.tsx"
```

Expected: FAIL — `onSuccess` is not a recognized prop yet (TypeScript error) and is never called.

- [ ] **Step 4: Add the `onSuccess` prop and wire it**

In `apps/web/src/app/intakes/[id]/page.tsx`, change the `DistributionTab` signature (lines 1029-1037):

```tsx
export function DistributionTab({
  intake,
  actor,
  onIntakeUpdate,
}: {
  intake: ProjectIntakeRecord;
  actor: UiActor;
  onIntakeUpdate: (updated: ProjectIntakeRecord) => void;
}) {
```
to:
```tsx
export function DistributionTab({
  intake,
  actor,
  onIntakeUpdate,
  onSuccess,
}: {
  intake: ProjectIntakeRecord;
  actor: UiActor;
  onIntakeUpdate: (updated: ProjectIntakeRecord) => void;
  onSuccess: (message: string) => void;
}) {
```

Change `doExecute` (lines 1072-1081) from:

```tsx
  async function doExecute() {
    setBusy("execute"); setErr(null);
    try {
      const run = await executeDistribution(intake.id, actor);
      setRuns((prev) => [run, ...(prev ?? [])]);
      const updated = await import("@/lib/api-client").then(m => m.getIntake(intake.id, actor));
      onIntakeUpdate(updated);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }
```
to:
```tsx
  async function doExecute() {
    setBusy("execute"); setErr(null);
    try {
      const run = await executeDistribution(intake.id, actor);
      setRuns((prev) => [run, ...(prev ?? [])]);
      const updated = await import("@/lib/api-client").then(m => m.getIntake(intake.id, actor));
      onIntakeUpdate(updated);
      onSuccess("Distribution executing. Track progress below.");
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }
```

Update the call site (lines 1610-1618):

```tsx
      {activeTab === "Distribution" && (
        <DistributionTab
          intake={intake}
          actor={actor}
          onIntakeUpdate={(updated) => {
            setIntake(updated);
            void getAuditTrail(intake.id, actor).then(setAudit);
          }}
        />
      )}
```
to:
```tsx
      {activeTab === "Distribution" && (
        <DistributionTab
          intake={intake}
          actor={actor}
          onIntakeUpdate={(updated) => {
            setIntake(updated);
            void getAuditTrail(intake.id, actor).then(setAudit);
          }}
          onSuccess={(msg) => setSuccessMsg(msg)}
        />
      )}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd apps/web && npx vitest run "src/app/intakes/[id]/__tests__/DistributionTab.test.tsx"
```

Expected: PASS.

- [ ] **Step 6: Run the full frontend suite and typecheck**

```bash
cd apps/web && npm test && npm run typecheck
```

Expected: all pass — confirms the exported `DistributionTab` and its new required prop don't break the existing call site (already updated in Step 4).

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/intakes/[id]/page.tsx" "apps/web/src/app/intakes/[id]/__tests__/DistributionTab.test.tsx"
git commit -m "fix: show a success toast when distribution execution starts"
```

---

### Task 7: Unsaved-changes guard on the intake form

**Files:**
- Modify: `apps/web/src/lib/intake-form-validation.ts` (already has `isIntakeFormDirty`, from Task 2 — no change needed)
- Modify: `apps/web/src/app/intakes/new/page.tsx`
- Test: `apps/web/src/app/intakes/new/__tests__/page.test.tsx` (extend, from Task 3)

**Interfaces:**
- Consumes: `isIntakeFormDirty` from `@/lib/intake-form-validation` (Task 2).
- Produces: nothing consumed by later tasks (this is the last task in the plan).

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/app/intakes/new/__tests__/page.test.tsx` (append to the existing test file):

```tsx
describe("NewIntakePage unsaved-changes guard", () => {
  it("warns via beforeunload once the form has content", async () => {
    const user = userEvent.setup();
    render(<NewIntakePage />);

    const event = new Event("beforeunload", { cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");

    // Before typing anything, the guard should not fire.
    window.dispatchEvent(event);
    expect(preventDefaultSpy).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/Project Title/), "Test project");

    const event2 = new Event("beforeunload", { cancelable: true });
    const preventDefaultSpy2 = vi.spyOn(event2, "preventDefault");
    window.dispatchEvent(event2);
    expect(preventDefaultSpy2).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/web && npx vitest run src/app/intakes/new/__tests__/page.test.tsx
```

Expected: FAIL — no `beforeunload` listener exists yet, so `preventDefault` is never called in the second assertion.

- [ ] **Step 3: Add the guard**

In `apps/web/src/app/intakes/new/page.tsx`, change the React import (line 5) from:

```tsx
import { useState } from "react";
```
to:
```tsx
import { useEffect, useState } from "react";
```

Add the import for `isIntakeFormDirty` to the existing `@/lib/intake-form-validation` import block:

```tsx
import {
  validateIntakeForm,
  isIntakeFormDirty,
  MAX_INTAKE_TITLE_LENGTH,
  MIN_INTAKE_DESCRIPTION_LENGTH,
  MAX_INTAKE_DESCRIPTION_LENGTH,
  MAX_REQUESTER_NAME_LENGTH,
  MAX_DEPARTMENT_NAME_LENGTH,
  type IntakeFormErrors,
} from "@/lib/intake-form-validation";
```

Add the effect immediately after the `set` function definition:

```tsx
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!isIntakeFormDirty(form)) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [form]);
```

Scope note: this covers tab close/refresh/typing a new URL only. It does not intercept in-app `<Link>` navigation (e.g. clicking "Cancel") — Next's App Router has no stable route-change-start event to hook for that, and building one is out of scope for this QoL pass.

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd apps/web && npx vitest run src/app/intakes/new/__tests__/page.test.tsx
```

Expected: PASS, all tests in the file green (validation tests from Task 3 plus this new one).

- [ ] **Step 5: Run the full frontend suite and typecheck**

```bash
cd apps/web && npm test && npm run typecheck
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/intakes/new/page.tsx apps/web/src/app/intakes/new/__tests__/page.test.tsx
git commit -m "feat: warn before leaving the intake form with unsaved changes"
```

---

## Post-plan bookkeeping (per CLAUDE.md Logging Requirement)

After Tasks 2-7 are implemented and pushed, per the chosen git workflow (feature branch + PR):

```bash
git push -u origin <branch-name>
gh pr create --repo Dusty043/project-intake-os --base main \
  --title "fix+feat: intake form validation, Discovery linkedIntakeId, streaming a11y, distribution toast" \
  --body "Closes the two bugs and three QoL items scoped in docs/ai/tasks/TASK-0066. See that file for the full plan and docs/superpowers/plans/2026-07-16-live-streaming-verification-and-ui-qol.md for task-by-task detail."
```

Then update, per CLAUDE.md:
- `docs/ai/BUILD_LOG.md` — one entry per task (or one combined entry referencing all task logs).
- `docs/ai/MEMORY_INDEX.md` — add TASK-0066 through whatever TASK-0067+ numbers get assigned during execution.
- `docs/ai/tasks/TASK-0066-*.md` — fill in the `Changes`/`Commands Run`/`Test Results` sections that were left as "planning only" placeholders, once implementation is done.
- `docs/product/requirements-trace.md` — only if any of these changes affect a traced product requirement (unlikely for pure UI/validation QoL, but check).

## Self-Review

**1. Spec coverage:** All four `docs/ai/tasks/TASK-0066` items are covered — item 1 (Q-UX-1 verification) → Task 1; item 2 (bug #1 + validation UX) → Tasks 2-3; item 3 (bug #2 + a11y + toast) → Tasks 4-6; item 4 (draft-save/dead-field) → Task 7 (dead-field deletion folded into Task 3 since it's the same file/pass, as the spec itself proposed).

**2. Placeholder scan:** No TBD/TODO markers. The one spot that reads like a placeholder — Task 1 Step 4's `<owner-actor-id>`/`<oreochiserver-host>` — is deliberately a runtime value only available at execution time (an actual session ID doesn't exist until Task 1 Step 1 runs), not an unresolved design decision.

**3. Type consistency:** `IntakeFormErrors`, `IntakeFormValues`, `validateIntakeForm`, `isIntakeFormDirty` are defined once in Task 2 and referenced with identical names/signatures in Tasks 3 and 7. `PROJECT_TYPES` defined once in Task 2, consumed once in Task 3. `DistributionTab`'s new `onSuccess: (message: string) => void` prop matches its call site's `onSuccess={(msg) => setSuccessMsg(msg)}` in Task 6 (both single-`string`-argument, `void`-returning).
