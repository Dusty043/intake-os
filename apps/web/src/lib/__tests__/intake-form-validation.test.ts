import { describe, expect, it } from "vitest";
import { validateIntakeForm, isIntakeFormDirty } from "../intake-form-validation";

const VALID_FORM = {
  title: "Test project",
  description: "This description is long enough to pass validation.",
  requester: "Jane",
  department: "",
};

describe("validateIntakeForm", () => {
  it("returns no errors for a fully valid form", () => {
    expect(validateIntakeForm(VALID_FORM)).toEqual({});
  });

  it("flags a description under the 20-character minimum", () => {
    const errors = validateIntakeForm({ ...VALID_FORM, description: "too short" });
    expect(errors.description).toMatch(/at least 20 characters/i);
  });

  it("flags an empty title", () => {
    const errors = validateIntakeForm({ ...VALID_FORM, title: "  " });
    expect(errors.title).toMatch(/required/i);
  });

  it("flags a title over the 200-character maximum", () => {
    const errors = validateIntakeForm({ ...VALID_FORM, title: "x".repeat(201) });
    expect(errors.title).toMatch(/200 characters or fewer/i);
  });

  it("flags an empty requester", () => {
    const errors = validateIntakeForm({ ...VALID_FORM, requester: "" });
    expect(errors.requester).toMatch(/required/i);
  });

  it("does not flag an empty department (optional field)", () => {
    const errors = validateIntakeForm({ ...VALID_FORM, department: "" });
    expect(errors.department).toBeUndefined();
  });

  it("flags a department over the 100-character maximum", () => {
    const errors = validateIntakeForm({ ...VALID_FORM, department: "x".repeat(101) });
    expect(errors.department).toMatch(/100 characters or fewer/i);
  });
});

describe("isIntakeFormDirty", () => {
  it("is false for an all-empty form", () => {
    expect(isIntakeFormDirty({ title: "", description: "", requester: "", department: "" })).toBe(false);
  });

  it("is true once any field has content", () => {
    expect(isIntakeFormDirty({ title: "x", description: "", requester: "", department: "" })).toBe(true);
  });
});
