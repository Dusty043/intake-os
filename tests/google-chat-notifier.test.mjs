import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

// Stub fetch for testing — must be set before module import
let lastFetchCall = null;
let fetchShouldFail = false;
let fetchStatusCode = 200;

global.fetch = async (url, options) => {
  lastFetchCall = { url, options };
  if (fetchShouldFail) throw new Error("Network error");
  return {
    ok: fetchStatusCode >= 200 && fetchStatusCode < 300,
    status: fetchStatusCode,
    statusText: fetchStatusCode === 200 ? "OK" : "Bad Request",
  };
};

const { GoogleChatNotifier } = await import("../dist/src/index.js");

describe("GoogleChatNotifier", () => {
  beforeEach(() => {
    lastFetchCall = null;
    fetchShouldFail = false;
    fetchStatusCode = 200;
  });

  describe("isEnabled", () => {
    it("returns false when no webhook URL is set", () => {
      const notifier = new GoogleChatNotifier();
      assert.equal(notifier.isEnabled, false);
    });

    it("returns true when webhook URL is set", () => {
      const notifier = new GoogleChatNotifier("https://chat.googleapis.com/v1/spaces/xxx/messages?key=yyy");
      assert.equal(notifier.isEnabled, true);
    });
  });

  describe("notify", () => {
    it("is a no-op when webhook URL is not set", async () => {
      const notifier = new GoogleChatNotifier();
      await notifier.notify({
        eventType: "intake_review",
        intakeId: "REQ-001",
        title: "Test intake",
      });
      assert.equal(lastFetchCall, null);
    });

    it("POSTs a JSON body to the webhook URL", async () => {
      const notifier = new GoogleChatNotifier("https://webhook.example.com/chat");
      await notifier.notify({
        eventType: "intake_review",
        intakeId: "REQ-001",
        title: "Client Portal Redesign",
        requester: "Alice",
      });

      assert.ok(lastFetchCall, "fetch should have been called");
      assert.equal(lastFetchCall.url, "https://webhook.example.com/chat");
      assert.equal(lastFetchCall.options.method, "POST");
      assert.equal(lastFetchCall.options.headers["Content-Type"], "application/json");

      const body = JSON.parse(lastFetchCall.options.body);
      assert.ok(body.text, "message should have a text field");
      assert.ok(body.text.includes("Client Portal Redesign"), "text should include intake title");
      assert.ok(body.text.includes("Alice"), "text should include requester");
      assert.ok(body.text.includes("Gate 1"), "text should describe the event");
    });

    it("includes a link when intakeBaseUrl is configured", async () => {
      const notifier = new GoogleChatNotifier(
        "https://webhook.example.com/chat",
        "https://100.75.210.83",
      );
      await notifier.notify({
        eventType: "provisioning_failed",
        intakeId: "REQ-ABC",
        title: "Inventory Dashboard",
      });

      const body = JSON.parse(lastFetchCall.options.body);
      assert.ok(body.text.includes("REQ-ABC"), "should include intake id in link");
      assert.ok(body.text.includes("100.75.210.83"), "should include base URL");
    });

    it("includes the intake ID when intakeBaseUrl is not set", async () => {
      const notifier = new GoogleChatNotifier("https://webhook.example.com/chat");
      await notifier.notify({
        eventType: "distributed",
        intakeId: "REQ-XYZ",
        title: "CRM Integration",
      });

      const body = JSON.parse(lastFetchCall.options.body);
      assert.ok(body.text.includes("REQ-XYZ"), "should include intake ID");
    });

    it("includes optional detail field in the message", async () => {
      const notifier = new GoogleChatNotifier("https://webhook.example.com/chat");
      await notifier.notify({
        eventType: "clarification_required",
        intakeId: "REQ-001",
        title: "New Feature",
        detail: "3 question(s) need answers before evaluation.",
      });

      const body = JSON.parse(lastFetchCall.options.body);
      assert.ok(body.text.includes("3 question(s)"), "should include detail");
    });

    it("strips Chat markup characters from user-derived title, requester, and detail", async () => {
      const notifier = new GoogleChatNotifier("https://webhook.example.com/chat");
      await notifier.notify({
        eventType: "intake_review",
        intakeId: "REQ-001",
        title: "<https://evil.example|Click *here*>",
        requester: "*Bold* _Attacker_ ~Name~",
        detail: "See <https://evil.example|this> for _details_",
      });

      const body = JSON.parse(lastFetchCall.options.body);
      assert.ok(!body.text.includes("<"), "message should not contain unescaped '<'");
      assert.ok(!body.text.includes("*Bold*"), "requester markup should be stripped, not preserved verbatim");
      assert.ok(body.text.includes("Bold"), "sanitized requester text content should still be present");
      assert.ok(body.text.includes("Attacker"), "sanitized requester text content should still be present");
      assert.ok(body.text.includes("details"), "sanitized detail text content should still be present");
    });

    it("does not throw when fetch fails — logs a warning and continues", async () => {
      fetchShouldFail = true;
      const notifier = new GoogleChatNotifier("https://webhook.example.com/chat");
      // should not throw
      await notifier.notify({
        eventType: "distributed",
        intakeId: "REQ-001",
        title: "Some intake",
      });
    });

    it("does not throw when webhook returns a non-200 status", async () => {
      fetchStatusCode = 400;
      const notifier = new GoogleChatNotifier("https://webhook.example.com/chat");
      await notifier.notify({
        eventType: "distributed",
        intakeId: "REQ-001",
        title: "Some intake",
      });
    });

    it("fires the correct event label for each event type", async () => {
      const events = [
        { eventType: "clarification_required", expectedLabel: "Clarification Required" },
        { eventType: "intake_review", expectedLabel: "Gate 1" },
        { eventType: "devops_review", expectedLabel: "Gate 2" },
        { eventType: "provisioning_failed", expectedLabel: "Provisioning Failed" },
        { eventType: "distributed", expectedLabel: "Distributed" },
      ];

      const notifier = new GoogleChatNotifier("https://webhook.example.com/chat");

      for (const { eventType, expectedLabel } of events) {
        lastFetchCall = null;
        await notifier.notify({ eventType, intakeId: "REQ-001", title: "Test" });
        const body = JSON.parse(lastFetchCall.options.body);
        assert.ok(
          body.text.includes(expectedLabel),
          `Event ${eventType} should include label "${expectedLabel}" in message. Got: ${body.text}`,
        );
      }
    });
  });
});
