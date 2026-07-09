// First NestJS controller-level e2e test in this repo. Existing API-layer
// tests run via `node --test` against compiled `dist/` classes directly,
// bypassing the HTTP/auth layer entirely — that pattern can't verify the
// SSE route's ownership check or its wire-format framing. This establishes
// the reusable @nestjs/testing + supertest pattern for that job.
//
// Run: npm run api:build && node --test dist/apps/api/src/modules/discovery/discovery-stream.e2e-spec.js

import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { APP_GUARD, APP_FILTER } from "@nestjs/core";
import request from "supertest";
import { DiscoveryHttpController } from "./discovery.controller.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { SessionService } from "../auth/session.service.js";
import { ApplicationExceptionFilter } from "../../common/application-exception.filter.js";
import { IntakeWorkflowService } from "../../../../../src/application/intake-workflow-service.js";
import { DiscoveryStreamRegistry } from "../../../../../src/application/discovery/index.js";
import { NotFoundError } from "../../../../../src/application/errors.js";

// ─── Fake app-layer DiscoveryController — only getSession() is exercised by
// the ownership check this test targets; nothing else on the real interface
// is needed here. ────────────────────────────────────────────────────────────

const SEEDED_SESSIONS: Record<string, { id: string; userId: string }> = {
  "DISC-owned": { id: "DISC-owned", userId: "user-1" },
  "DISC-other": { id: "DISC-other", userId: "user-2" },
};

const fakeDiscoveryController = {
  getSession: async (id: string) => {
    const session = SEEDED_SESSIONS[id];
    if (!session) throw new NotFoundError("DiscoverySession", id);
    return session;
  },
};

async function waitForSubscriber(
  registry: DiscoveryStreamRegistry,
  sessionId: string,
  timeoutMs = 2000,
): Promise<void> {
  const start = Date.now();
  while (!registry.hasSubscribers(sessionId)) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for an SSE subscriber on ${sessionId}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

describe("DiscoveryHttpController — GET /discovery/:id/stream (SSE)", () => {
  let moduleRef: TestingModule;
  let app: INestApplication;

  before(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [DiscoveryHttpController],
      providers: [
        { provide: "DISCOVERY_CONTROLLER", useValue: fakeDiscoveryController },
        { provide: IntakeWorkflowService, useValue: {} },
        { provide: SessionService, useValue: {} },
        DiscoveryStreamRegistry,
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_FILTER, useClass: ApplicationExceptionFilter },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  after(async () => {
    await app.close();
  });

  test("rejects a session the actor does not own with a 404 (same as any other :id route)", async () => {
    const res = await request(app.getHttpServer())
      .get("/discovery/DISC-other/stream")
      .set("x-actor-id", "user-1")
      .set("x-actor-role", "request_creator");

    assert.equal(res.status, 404);
  });

  test("rejects a nonexistent session with the same 404 (can't distinguish 'not yours' from 'doesn't exist')", async () => {
    const res = await request(app.getHttpServer())
      .get("/discovery/DISC-nonexistent/stream")
      .set("x-actor-id", "user-1")
      .set("x-actor-role", "request_creator");

    assert.equal(res.status, 404);
  });

  test("delivers published events to the owning actor, framed as named SSE events", async () => {
    const registry = app.get(DiscoveryStreamRegistry);

    const rawBody = await new Promise<string>((resolve, reject) => {
      const req = request(app.getHttpServer())
        .get("/discovery/DISC-owned/stream")
        .set("x-actor-id", "user-1")
        .set("x-actor-role", "request_creator")
        .parse((res, callback) => {
          // superagent types this as its own Response, but the object handed
          // to a node parser at this point is the raw http.IncomingMessage —
          // it has stream methods (on/destroy) the type doesn't declare.
          const stream = res as unknown as NodeJS.ReadableStream & { destroy: () => void };
          let raw = "";
          stream.on("data", (chunk: Buffer) => {
            raw += chunk.toString("utf8");
            if (raw.includes("event: stage-end")) {
              stream.destroy();
              callback(null, raw);
            }
          });
          stream.on("error", () => {
            // Expected once we destroy() above — the connection never
            // completes normally because SSE streams don't end on their own.
          });
        });

      req.end((_err, res) => {
        if (res?.body) resolve(res.body as string);
      });

      waitForSubscriber(registry, "DISC-owned")
        .then(() => {
          registry.publish("DISC-owned", { type: "stage-start", stage: "frame_problem" });
          registry.publish("DISC-owned", { type: "token", stage: "frame_problem", text: "hello" });
          registry.publish("DISC-owned", { type: "stage-end", stage: "frame_problem" });
        })
        .catch(reject);
    });

    assert.match(rawBody, /event: stage-start/);
    assert.match(rawBody, /event: token/);
    assert.match(rawBody, /"text":"hello"/);
    assert.match(rawBody, /event: stage-end/);
  });
});
