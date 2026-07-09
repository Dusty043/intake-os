import { describe, expect, it, vi, afterEach } from "vitest";
import { startDiscovery } from "../discovery-client";
import type { UiActor } from "../types";

const actor: UiActor = { id: "u1", role: "request_creator", name: "Test User" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("startDiscovery", () => {
  it("sends only { message } — a userId field gets rejected by the API's whitelist validation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "s1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await startDiscovery("hello", actor);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ message: "hello" });
  });
});
