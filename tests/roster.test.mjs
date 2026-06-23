import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scoreMembers } from "../dist/src/application/roster/roster-scorer.js";
import { RosterApiClient } from "../dist/src/application/roster/roster-api-client.js";

// ─── scoreMembers ────────────────────────────────────────────────────────────

describe("scoreMembers", () => {
  const members = [
    {
      id: "dev-1",
      name: "Alice",
      email: "alice@example.com",
      skills: ["Next.js", "NestJS", "Postgres"],
      projectTypes: ["internal_tool", "internal_dashboard"],
      seniority: "senior",
      availability: "available",
      currentLoad: 2,
      maxCapacity: 5,
    },
    {
      id: "dev-2",
      name: "Bob",
      email: "bob@example.com",
      skills: ["Python", "FastAPI"],
      projectTypes: ["api_service"],
      seniority: "mid",
      availability: "limited",
      currentLoad: 4,
      maxCapacity: 5,
    },
    {
      id: "dev-3",
      name: "Carol",
      email: "carol@example.com",
      skills: ["React", "Node.js"],
      projectTypes: ["client_portal"],
      seniority: "lead",
      availability: "unavailable",
      currentLoad: 5,
      maxCapacity: 5,
    },
  ];

  it("returns empty result for empty member list", () => {
    const result = scoreMembers([], "internal_tool", ["Next.js"]);
    assert.equal(result.recommended, null);
    assert.equal(result.backup, null);
    assert.equal(result.rosterConnected, true);
  });

  it("recommends best skill match", () => {
    const result = scoreMembers(members, "internal_tool", ["Next.js", "NestJS", "Postgres"]);
    assert.ok(result.recommended, "should have a recommendation");
    assert.equal(result.recommended.member.name, "Alice");
  });

  it("excludes unavailable members from recommendation", () => {
    const result = scoreMembers(members, "internal_tool", ["React"]);
    assert.ok(result.recommended);
    assert.notEqual(result.recommended.member.name, "Carol");
  });

  it("includes skill match details", () => {
    const result = scoreMembers(members, "internal_tool", ["next.js", "nestjs"]);
    assert.ok(result.recommended);
    assert.ok(result.recommended.matchedSkills.length > 0);
  });

  it("provides backup developer when enough eligible members", () => {
    const result = scoreMembers(members, "internal_tool", ["Next.js"]);
    assert.ok(result.backup, "should have backup developer");
    assert.notEqual(result.backup.member.id, result.recommended?.member.id);
  });

  it("populates scoring signals", () => {
    const result = scoreMembers(members, "internal_tool", ["Next.js"]);
    assert.ok(result.scoringSignals.length > 0);
  });

  it("adds capacity risk penalty when member is at full capacity", () => {
    const atCapacity = [{ ...members[1], currentLoad: 5, maxCapacity: 5, availability: "available" }];
    const result = scoreMembers(atCapacity, "api_service", ["Python"]);
    assert.ok(result.recommended);
    assert.ok(result.recommended.riskPenalties.some((r) => r.includes("capacity")));
  });
});

// ─── RosterApiClient ─────────────────────────────────────────────────────────

describe("RosterApiClient", () => {
  it("isConnected returns false when baseUrl is undefined", () => {
    const client = new RosterApiClient({ baseUrl: undefined, apiKey: undefined });
    assert.equal(client.isConnected, false);
  });

  it("isConnected returns true when baseUrl is set", () => {
    const client = new RosterApiClient({ baseUrl: "https://example.com/api/roster", apiKey: undefined });
    assert.equal(client.isConnected, true);
  });

  it("fetchRoster returns empty array when not connected", async () => {
    const client = new RosterApiClient({ baseUrl: undefined, apiKey: undefined });
    const result = await client.fetchRoster();
    assert.deepEqual(result, []);
  });
});
