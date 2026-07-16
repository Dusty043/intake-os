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
