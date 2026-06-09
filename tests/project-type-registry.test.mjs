import assert from "node:assert/strict";
import test from "node:test";
import {
  getProjectTypeDefinition,
  getRequiredEvaluationSections,
  isGithubRequirementResolved,
  resolveGithubRequirement,
  selectHighestGovernanceType,
} from "../dist/src/index.js";

test("canonical project type defaults match product registry", () => {
  assert.deepEqual(
    pickDefaults(getProjectTypeDefinition("n8n_automation")),
    { githubRequirement: "no", defaultEvaluationDepth: "light", defaultDistributionMode: "C" },
  );

  assert.deepEqual(
    pickDefaults(getProjectTypeDefinition("internal_tool")),
    { githubRequirement: "yes", defaultEvaluationDepth: "standard", defaultDistributionMode: "B" },
  );

  assert.deepEqual(
    pickDefaults(getProjectTypeDefinition("client_portal")),
    { githubRequirement: "yes", defaultEvaluationDepth: "full", defaultDistributionMode: "B" },
  );

  assert.deepEqual(
    pickDefaults(getProjectTypeDefinition("discovery_research")),
    { githubRequirement: "no", defaultEvaluationDepth: "light", defaultDistributionMode: "none" },
  );
});

test("higher governance burden wins across candidate project types", () => {
  const result = selectHighestGovernanceType(["internal_dashboard", "ai_workflow_tool"]);
  assert.equal(result.projectType, "ai_workflow_tool");
});

test("optional GitHub requirement must be resolved before provisioning", () => {
  assert.equal(resolveGithubRequirement("optional"), "optional");
  assert.equal(isGithubRequirementResolved(resolveGithubRequirement("optional")), false);
  assert.equal(resolveGithubRequirement("optional", true), "yes");
  assert.equal(resolveGithubRequirement("optional", false), "no");
});

test("evaluation depth exposes required review sections", () => {
  assert.ok(getRequiredEvaluationSections("light").includes("basic_work_breakdown"));
  assert.ok(getRequiredEvaluationSections("standard").includes("acceptance_criteria"));
  assert.ok(getRequiredEvaluationSections("full").includes("data_security_considerations"));
});

function pickDefaults(definition) {
  return {
    githubRequirement: definition.githubRequirement,
    defaultEvaluationDepth: definition.defaultEvaluationDepth,
    defaultDistributionMode: definition.defaultDistributionMode,
  };
}
