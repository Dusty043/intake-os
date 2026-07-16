// Duplicated from apps/api/src/common/validation-constants.ts — the frontend
// and backend are separate deployable packages with no shared import path
// today (see Task 2's parity test, which guards these values against drift).
export const MAX_INTAKE_TITLE_LENGTH = 200;
export const MIN_INTAKE_DESCRIPTION_LENGTH = 20;
export const MAX_INTAKE_DESCRIPTION_LENGTH = 5000;
export const MAX_REQUESTER_NAME_LENGTH = 100;
export const MAX_DEPARTMENT_NAME_LENGTH = 100;

export type IntakeFormValues = {
  title: string;
  description: string;
  requester: string;
  department?: string;
};

export type IntakeFormErrors = {
  title?: string;
  description?: string;
  requester?: string;
  department?: string;
};

export function validateIntakeForm(form: IntakeFormValues): IntakeFormErrors {
  const errors: IntakeFormErrors = {};

  if (!form.title.trim()) {
    errors.title = "Title is required.";
  } else if (form.title.length > MAX_INTAKE_TITLE_LENGTH) {
    errors.title = `Title must be ${MAX_INTAKE_TITLE_LENGTH} characters or fewer.`;
  }

  if (!form.description.trim()) {
    errors.description = "Description is required.";
  } else if (form.description.trim().length < MIN_INTAKE_DESCRIPTION_LENGTH) {
    errors.description = `Description must be at least ${MIN_INTAKE_DESCRIPTION_LENGTH} characters.`;
  } else if (form.description.length > MAX_INTAKE_DESCRIPTION_LENGTH) {
    errors.description = `Description must be ${MAX_INTAKE_DESCRIPTION_LENGTH} characters or fewer.`;
  }

  if (!form.requester.trim()) {
    errors.requester = "Requester is required.";
  } else if (form.requester.length > MAX_REQUESTER_NAME_LENGTH) {
    errors.requester = `Requester must be ${MAX_REQUESTER_NAME_LENGTH} characters or fewer.`;
  }

  if (form.department && form.department.length > MAX_DEPARTMENT_NAME_LENGTH) {
    errors.department = `Department must be ${MAX_DEPARTMENT_NAME_LENGTH} characters or fewer.`;
  }

  return errors;
}

export function isIntakeFormDirty(form: IntakeFormValues): boolean {
  return Boolean(form.title || form.description || form.requester || form.department);
}
