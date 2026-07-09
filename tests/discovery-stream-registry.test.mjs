/**
 * DiscoveryStreamRegistry — session-scoped event bus bridging the
 * synchronous POST /discovery/:id/message pipeline to SSE subscribers.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DiscoveryStreamRegistry } from "../dist/src/index.js";

describe("DiscoveryStreamRegistry", () => {
  test("publish with no subscriber is a safe no-op", () => {
    const registry = new DiscoveryStreamRegistry();
    assert.doesNotThrow(() => {
      registry.publish("DISC-001", { type: "stage-start", stage: "frame_problem" });
    });
    assert.equal(registry.hasSubscribers("DISC-001"), false);
  });

  test("subscribed listener receives published events for its session", () => {
    const registry = new DiscoveryStreamRegistry();
    const received = [];
    registry.subscribe("DISC-001", (event) => received.push(event));

    registry.publish("DISC-001", { type: "stage-start", stage: "frame_problem" });
    registry.publish("DISC-001", { type: "token", stage: "frame_problem", text: "{\"problem" });
    registry.publish("DISC-001", { type: "stage-end", stage: "frame_problem" });

    assert.equal(received.length, 3);
    assert.equal(received[0].type, "stage-start");
    assert.equal(received[1].text, "{\"problem");
    assert.equal(received[2].type, "stage-end");
  });

  test("sessions are isolated — a listener never receives another session's events", () => {
    const registry = new DiscoveryStreamRegistry();
    const receivedForA = [];
    registry.subscribe("DISC-A", (event) => receivedForA.push(event));

    registry.publish("DISC-B", { type: "stage-start", stage: "frame_problem" });

    assert.equal(receivedForA.length, 0);
  });

  test("multiple listeners on the same session (two tabs) all receive events", () => {
    const registry = new DiscoveryStreamRegistry();
    const receivedByTab1 = [];
    const receivedByTab2 = [];
    registry.subscribe("DISC-001", (event) => receivedByTab1.push(event));
    registry.subscribe("DISC-001", (event) => receivedByTab2.push(event));

    registry.publish("DISC-001", { type: "stage-start", stage: "frame_problem" });

    assert.equal(receivedByTab1.length, 1);
    assert.equal(receivedByTab2.length, 1);
  });

  test("unsubscribe stops delivery to that listener only", () => {
    const registry = new DiscoveryStreamRegistry();
    const receivedByTab1 = [];
    const receivedByTab2 = [];
    const unsubscribeTab1 = registry.subscribe("DISC-001", (event) => receivedByTab1.push(event));
    registry.subscribe("DISC-001", (event) => receivedByTab2.push(event));

    unsubscribeTab1();
    registry.publish("DISC-001", { type: "stage-start", stage: "frame_problem" });

    assert.equal(receivedByTab1.length, 0);
    assert.equal(receivedByTab2.length, 1);
  });

  test("unsubscribing the last listener cleans up the session entry", () => {
    const registry = new DiscoveryStreamRegistry();
    const unsubscribe = registry.subscribe("DISC-001", () => {});
    assert.equal(registry.hasSubscribers("DISC-001"), true);

    unsubscribe();

    assert.equal(registry.hasSubscribers("DISC-001"), false);
  });

  test("error events are delivered like any other event", () => {
    const registry = new DiscoveryStreamRegistry();
    const received = [];
    registry.subscribe("DISC-001", (event) => received.push(event));

    registry.publish("DISC-001", { type: "error", stage: "compose_proposal", message: "OpenAI request failed" });

    assert.equal(received[0].type, "error");
    assert.equal(received[0].message, "OpenAI request failed");
  });
});
