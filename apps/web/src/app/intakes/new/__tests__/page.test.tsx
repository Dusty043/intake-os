import { describe, expect, it, vi } from "vitest";
import NewIntakePage from "../page";

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));

describe("NewIntakePage", () => {
  it("redirects the retired manual intake route to Discovery", () => {
    NewIntakePage();
    expect(redirect).toHaveBeenCalledWith("/discovery");
  });
});
