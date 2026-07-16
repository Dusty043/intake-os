import { describe, expect, it } from "vitest";
import * as frontend from "../intake-form-validation";
import * as backend from "../../../../api/src/common/validation-constants";

describe("intake validation constants parity", () => {
  it("frontend length limits match the backend's validation-constants.ts exactly", () => {
    expect(frontend.MAX_INTAKE_TITLE_LENGTH).toBe(backend.MAX_INTAKE_TITLE_LENGTH);
    expect(frontend.MIN_INTAKE_DESCRIPTION_LENGTH).toBe(backend.MIN_INTAKE_DESCRIPTION_LENGTH);
    expect(frontend.MAX_INTAKE_DESCRIPTION_LENGTH).toBe(backend.MAX_INTAKE_DESCRIPTION_LENGTH);
    expect(frontend.MAX_REQUESTER_NAME_LENGTH).toBe(backend.MAX_REQUESTER_NAME_LENGTH);
    expect(frontend.MAX_DEPARTMENT_NAME_LENGTH).toBe(backend.MAX_DEPARTMENT_NAME_LENGTH);
  });
});
