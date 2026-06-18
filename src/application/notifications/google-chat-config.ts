export interface GoogleChatConfig {
  webhookUrl: string | undefined;
  intakeBaseUrl: string | undefined;
}

export function loadGoogleChatConfig(): GoogleChatConfig {
  return {
    webhookUrl: process.env["GOOGLE_CHAT_WEBHOOK_URL"] || undefined,
    intakeBaseUrl: process.env["INTAKE_APP_URL"] || undefined,
  };
}
