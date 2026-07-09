import { describe, expect, it, vi, afterEach } from "vitest";
import { startDiscovery, streamDiscoverySession } from "../discovery-client";
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

function sseBodyStream(frames: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
}

describe("streamDiscoverySession", () => {
  it("parses SSE frames and calls onEvent for each one, in order", async () => {
    const body = sseBodyStream([
      'event: stage-start\ndata: {"type":"stage-start","stage":"intent_extraction"}\n\n',
      'event: token\ndata: {"type":"token","stage":"intent_extraction","text":"chunk"}\n\n',
      'event: stage-end\ndata: {"type":"stage-end","stage":"intent_extraction"}\n\n',
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, body }),
    );

    const events: unknown[] = [];
    await streamDiscoverySession("DISC-1", actor, (e) => events.push(e));

    expect(events).toEqual([
      { type: "stage-start", stage: "intent_extraction" },
      { type: "token", stage: "intent_extraction", text: "chunk" },
      { type: "stage-end", stage: "intent_extraction" },
    ]);
  });

  it("skips a malformed frame instead of throwing, and keeps processing later frames", async () => {
    const body = sseBodyStream([
      "event: token\ndata: not-json\n\n",
      'event: stage-end\ndata: {"type":"stage-end","stage":"intent_extraction"}\n\n',
    ]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body }));

    const events: unknown[] = [];
    await streamDiscoverySession("DISC-1", actor, (e) => events.push(e));

    expect(events).toEqual([{ type: "stage-end", stage: "intent_extraction" }]);
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, body: null }));

    await expect(streamDiscoverySession("DISC-1", actor, () => {})).rejects.toThrow("404");
  });
});
