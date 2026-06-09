import assert from "node:assert/strict";
import test from "node:test";
import { createApiCompositionRoot, normalizeBitrix24IntakePayload } from "../dist/src/index.js";

const intakeOwner = { id: "user-intake", role: "intake_owner", displayName: "Intake Owner" };

test("Bitrix24 payloads normalize into canonical intake input", () => {
  const normalized = normalizeBitrix24IntakePayload({
    ID: "D-123",
    TITLE: "Client Portal Refresh",
    COMMENTS: "Need a controlled project intake.",
    CONTACT_NAME: "Operations",
    DEPARTMENT: "Client Success",
    PROJECT_TYPE: "client portal",
    URL: "https://bitrix24.example/crm/deal/details/123/",
  });

  assert.equal(normalized.title, "Client Portal Refresh");
  assert.equal(normalized.projectType, "client_portal");
  assert.equal(normalized.source.system, "bitrix24");
  assert.equal(normalized.source.externalId, "D-123");
});

test("API composition root can create an intake from Bitrix24 preview", async () => {
  const { intakeController } = createApiCompositionRoot();
  const created = await intakeController.createFromBitrix24(
    {
      ID: "TASK-456",
      TITLE: "Reporting Automation",
      DESCRIPTION: "Automate weekly reporting.",
      PROJECT_TYPE: "reporting",
    },
    intakeOwner,
  );

  assert.equal(created.source.system, "bitrix24");
  assert.equal(created.source.externalId, "TASK-456");
  assert.equal(created.projectType, "reporting_automation");
});
