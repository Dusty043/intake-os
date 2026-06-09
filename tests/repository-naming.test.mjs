import assert from "node:assert/strict";
import test from "node:test";
import {
  generateDefaultLabels,
  generateRepositoryName,
  generateRepositoryReadme,
  slugify,
  validateRepositoryName,
} from "../dist/src/index.js";

test("slug generation creates lowercase hyphen-separated names", () => {
  assert.equal(slugify("  Project Intake OS!!! "), "project-intake-os");
  assert.equal(slugify("ACME / Client Portal"), "acme-client-portal");
  assert.equal(slugify("Repeated---Separators"), "repeated-separators");
});

test("repository names use team, project type segment, and project name", () => {
  const result = generateRepositoryName({
    teamPrefix: "Digital Solutions",
    projectType: "internal_tool",
    projectName: "Project Intake OS",
  });

  assert.equal(result.proposedRepoName, "ds-tool-project-intake-os");
  assert.equal(result.finalRepoName, "ds-tool-project-intake-os");
  assert.equal(result.validation.valid, true);
});

test("collisions block automatic provisioning", () => {
  const result = generateRepositoryName({
    teamPrefix: "ds",
    projectType: "internal_tool",
    projectName: "Project Intake OS",
    existingNames: ["ds-tool-project-intake-os"],
  });

  assert.equal(result.collisionDetected, true);
  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.includes("collision_detected"));
});

test("manual repository name override requires an audit reason", () => {
  assert.throws(() =>
    generateRepositoryName({
      teamPrefix: "ds",
      projectType: "internal_tool",
      projectName: "Project Intake OS",
      overrideName: "custom-repo-name",
    }),
  );

  const result = generateRepositoryName({
    teamPrefix: "ds",
    projectType: "internal_tool",
    projectName: "Project Intake OS",
    overrideName: "custom-repo-name",
    overrideReason: "DevOps requested shorter name.",
  });

  assert.equal(result.finalRepoName, "custom-repo-name");
  assert.equal(result.overrideReason, "DevOps requested shorter name.");
});

test("repository validation rejects malformed and secret-like names", () => {
  assert.equal(validateRepositoryName("Bad Name").valid, false);
  assert.equal(validateRepositoryName("project-secret-token").valid, false);
  assert.equal(validateRepositoryName("valid-repo-name").valid, true);
});

test("labels and generated README include required handoff details", () => {
  const labels = generateDefaultLabels("api_service");
  assert.ok(labels.includes("bug"));
  assert.ok(labels.includes("api"));
  assert.ok(labels.includes("security"));

  const readme = generateRepositoryReadme({
    projectName: "Project Intake OS",
    summary: "Internal project intake control plane.",
    approvedGoal: "Create traceable project intake and handoff.",
    inScope: ["Intake", "Approval", "Distribution package"],
    outOfScope: ["Deep bidirectional sync"],
    architectureOverview: ["Monolith", "Postgres later", "Background workers later"],
    intakeRecordUrl: "https://example.test/intake/REQ-1",
  });

  assert.ok(readme.includes("## Approved Goal"));
  assert.ok(readme.includes("Create traceable project intake and handoff."));
  assert.ok(readme.includes("## Architecture Overview"));
  assert.ok(readme.includes("Intake Record: https://example.test/intake/REQ-1"));
});
