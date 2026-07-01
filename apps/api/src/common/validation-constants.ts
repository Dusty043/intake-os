export const MAX_INTAKE_TITLE_LENGTH = 200;
export const MIN_INTAKE_DESCRIPTION_LENGTH = 20;
export const MAX_INTAKE_DESCRIPTION_LENGTH = 5000;
export const MAX_REQUESTER_NAME_LENGTH = 100;
export const MAX_DEPARTMENT_NAME_LENGTH = 100;
export const MAX_REASON_LENGTH = 1000;
export const MAX_COMMENT_LENGTH = 2000;
export const MAX_NOTE_LENGTH = 500;
export const MAX_DISCOVERY_FIELD_LENGTH = 2000;
export const MAX_EXTERNAL_ID_LENGTH = 255;
export const MAX_URL_LENGTH = 2048;

export const MAX_EMAIL_SUBJECT_LENGTH = 500;
export const MAX_EMAIL_BODY_LENGTH = 50_000;
export const MAX_EMAIL_FROM_LENGTH = 255;

export const MAX_CHAT_MESSAGE_LENGTH = 10_000;

// Org context is injected into every discovery agent's system prompt, so it's bounded
// but deliberately more generous than a single structured field.
export const MAX_ORG_CONTEXT_LENGTH = 4_000;
