import { describe, expect, it } from "vitest";
import { PROJECT_TYPES } from "../project-types";
import { projectTypes } from "../../../../../src/domain/types";

describe("PROJECT_TYPES parity", () => {
  it("the frontend dropdown's values match the canonical domain registry exactly", () => {
    const frontendValues = new Set(PROJECT_TYPES.map((pt) => pt.value));
    const domainValues = new Set(projectTypes);
    expect(frontendValues).toEqual(domainValues);
  });
});
