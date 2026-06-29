/**
 * Simple.biz AI & Automation workspace context.
 * Injected into discovery agent system prompts to enable baseline assumptions
 * so the AI doesn't ask questions already answered by the org's known structure.
 */
export const SIMPLEBIZ_ORG_CONTEXT = `
ORGANIZATION: Simple.biz — AI & Automation Team

PROJECT TYPES (Monday.com Projects Portfolio board groups):
- Web App: React/Next.js web applications, client portals, internal apps with custom UI
- Chrome Extension: browser automation, web scraping helpers, productivity add-ons
- n8n Workflow: integrations, automations, data pipelines, scheduled triggers (no-code/low-code)
- Dashboard: analytics views, reporting dashboards, BI tools (often read-only, data-connected)
- CRM: customer relationship tooling, contact tracking, pipeline management
- SaaS: multi-tenant platforms, subscription products, externally-distributed software

WORK HIERARCHY (boards in Monday.com):
1. Projects Portfolio — one entry per initiative (title, type, status, tech stack, SP total, dates)
2. Roadmap & Epics — 3–6 epics per project, planned quarterly (Q1–Q4)
3. Sprint Tasks — tasks inside epics; sprint groups: "Current Sprint", "Next Sprint", "Backlog"
4. Microtasks & Ops — standalone one-off jobs, no epic, no sprint needed (< 1 day of work)

STORY POINTS — VALID VALUES ONLY: 1, 2, 3, 5, 8, 13
- Epics: typically 5–13 SP
- Tasks: typically 1–5 SP
- Never use other values (no 4, 6, 7, 10, etc.)

SPRINT STRUCTURE:
- Sprint length: 1–2 weeks
- New items default to "Backlog" unless explicitly scheduled
- "Current Sprint" = active work; "Next Sprint" = committed next cycle

TEAM DEFAULTS (use unless the user says otherwise):
- All work is for the internal Simple.biz AI & Automation team or direct client deliverables
- Affected users = internal team members (developers, integration specialists) unless stated otherwise
- Team size: small (1–3 developers)
- Preferred automation platform: n8n
- Preferred web stack: Next.js / React
- Deployment: managed cloud (Vercel for web, n8n cloud for automation)
- GitHub repos created ONLY for: Web App, Chrome Extension, SaaS projects
- n8n Workflows, Dashboards, and CRMs typically do NOT need a GitHub repo
`.trim();

/** Build an org context block to prepend to agent system prompts. */
export function orgContextBlock(orgContext: string | undefined): string {
  if (!orgContext) return "";
  return `\n\n## Workspace Context\n\n${orgContext}`;
}
