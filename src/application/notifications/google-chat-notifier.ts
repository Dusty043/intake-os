export type ChatEventType =
  | "clarification_required"
  | "intake_review"
  | "devops_review"
  | "provisioning_failed"
  | "provisioning_dead_lettered"
  | "distributed";

export interface ChatNotificationPayload {
  eventType: ChatEventType;
  intakeId: string;
  title: string;
  requester?: string;
  detail?: string;
}

const EVENT_LABELS: Record<ChatEventType, string> = {
  clarification_required: "Clarification Required",
  intake_review: "Intake Review — Gate 1 Needed",
  devops_review: "DevOps Review — Gate 2 Needed",
  provisioning_failed: "Provisioning Failed",
  provisioning_dead_lettered: "Provisioning Dead-Lettered — Manual Action Required",
  distributed: "Distributed",
};

const EVENT_ICONS: Record<ChatEventType, string> = {
  clarification_required: "⚠️",
  intake_review: "👀",
  devops_review: "🔧",
  provisioning_failed: "❌",
  provisioning_dead_lettered: "🚫",
  distributed: "✅",
};

function buildMessage(
  payload: ChatNotificationPayload,
  intakeBaseUrl: string | undefined,
): object {
  const label = EVENT_LABELS[payload.eventType];
  const icon = EVENT_ICONS[payload.eventType];

  const lines: string[] = [
    `${icon} *${label}*`,
    `*${payload.title}*`,
  ];

  if (payload.requester) {
    lines.push(`Requester: ${payload.requester}`);
  }
  if (payload.detail) {
    lines.push(payload.detail);
  }

  if (intakeBaseUrl) {
    lines.push(`<${intakeBaseUrl}/intakes/${payload.intakeId}|View in Intake OS>`);
  } else {
    lines.push(`Intake ID: ${payload.intakeId}`);
  }

  return { text: lines.join("\n") };
}

export class GoogleChatNotifier {
  private readonly webhookUrl: string | undefined;
  private readonly intakeBaseUrl: string | undefined;

  constructor(webhookUrl?: string, intakeBaseUrl?: string) {
    this.webhookUrl = webhookUrl;
    this.intakeBaseUrl = intakeBaseUrl;
  }

  get isEnabled(): boolean {
    return !!this.webhookUrl;
  }

  async notify(payload: ChatNotificationPayload): Promise<void> {
    if (!this.webhookUrl) return;

    const body = buildMessage(payload, this.intakeBaseUrl);

    try {
      const res = await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        console.warn(`[GoogleChatNotifier] Webhook returned ${res.status} ${res.statusText}`);
      }
    } catch (err) {
      console.warn(`[GoogleChatNotifier] Failed to send notification:`, err);
    }
  }
}
