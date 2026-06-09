import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const aiDir = join(root, "docs", "ai");
const tasksDir = join(aiDir, "tasks");
const decisionsDir = join(aiDir, "decisions");
const rdDir = join(root, "docs", "rd");
const integrationsDir = join(root, "docs", "integrations");
const securityDir = join(root, "docs", "security");

function listMarkdownFiles(directory) {
  try {
    return readdirSync(directory)
      .filter((name) => name.endsWith(".md"))
      .sort()
      .map((name) => {
        const relative = directory.replace(`${root}/`, "");
        return `- \`${relative}/${name}\``;
      });
  } catch {
    return ["- None yet"];
  }
}

const generatedAt = new Date().toISOString();
const content = `# Memory Index

Generated at: ${generatedAt}

## Core Memory

- \`docs/ai/PROJECT_MEMORY.md\`
- \`docs/ai/KNOWN_CONSTRAINTS.md\`
- \`docs/ai/OPEN_QUESTIONS.md\`
- \`docs/ai/BUILD_LOG.md\`
- \`docs/ai/DECISIONS_SUMMARY.md\`
- \`docs/ai/REQUIREMENTS_TRACE.md\`

## Task Logs

${listMarkdownFiles(tasksDir).join("\n")}

## Decisions

${listMarkdownFiles(decisionsDir).join("\n")}

## R&D Docs

${listMarkdownFiles(rdDir).join("\n")}

## Integration Docs

${listMarkdownFiles(integrationsDir).join("\n")}

## Security Docs

${listMarkdownFiles(securityDir).join("\n")}

## Product Specs

- \`docs/product/product-overview.md\`
- \`docs/product/input-trigger-strategy.md\`
- \`docs/product/intake-analysis-schema.md\`
- \`docs/product/distribution-rules.md\`
- \`docs/product/workflow-state-machine.md\`
- \`docs/product/ai-orchestration.md\`
- \`docs/product/project-type-registry.md\`
- \`docs/product/permissions-and-ownership.md\`
- \`docs/product/failure-and-recovery.md\`
- \`docs/product/ai-cost-governance.md\`
- \`docs/product/repository-and-naming.md\`
- \`docs/product/post-distribution-lifecycle.md\`
- \`docs/product/requirements-trace.md\`
`;

statSync(aiDir);
writeFileSync(join(aiDir, "MEMORY_INDEX.md"), content);
console.log("Updated docs/ai/MEMORY_INDEX.md");
