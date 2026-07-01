import { strict as assert } from "assert";
import { test, describe } from "node:test";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";

// Load compiled DTO classes and constants
const { CreateIntakeDto } = await import(
  "../dist/apps/api/src/modules/intake/dto/create-intake.dto.js"
);
const { RequestChangesDto } = await import(
  "../dist/apps/api/src/modules/intake/dto/request-changes.dto.js"
);
const { ApprovalDecisionDto } = await import(
  "../dist/apps/api/src/modules/intake/dto/approval-decision.dto.js"
);
const { RejectAnalysisDraftDto } = await import(
  "../dist/apps/api/src/modules/intake/dto/reject-analysis-draft.dto.js"
);
const { RegenerateAnalysisDraftDto } = await import(
  "../dist/apps/api/src/modules/intake/dto/regenerate-analysis-draft.dto.js"
);
const { CompleteDiscoveryDto } = await import(
  "../dist/apps/api/src/modules/intake/dto/complete-discovery.dto.js"
);
const { LifecycleTransitionDto } = await import(
  "../dist/apps/api/src/modules/intake/dto/lifecycle-transition.dto.js"
);
const { DiscoveryMessageDto } = await import(
  "../dist/apps/api/src/modules/discovery/dto/discovery-message.dto.js"
);
const { AnswerClarificationDto } = await import(
  "../dist/apps/api/src/modules/discovery/dto/answer-clarification.dto.js"
);
const { SelectDirectionDto } = await import(
  "../dist/apps/api/src/modules/discovery/dto/select-direction.dto.js"
);
const { UpdateDiscoverySettingsDto } = await import(
  "../dist/apps/api/src/modules/admin/dto/update-discovery-settings.dto.js"
);
const constants = await import(
  "../dist/apps/api/src/common/validation-constants.js"
);

const {
  MAX_INTAKE_TITLE_LENGTH,
  MIN_INTAKE_DESCRIPTION_LENGTH,
  MAX_INTAKE_DESCRIPTION_LENGTH,
  MAX_REQUESTER_NAME_LENGTH,
  MAX_DEPARTMENT_NAME_LENGTH,
  MAX_REASON_LENGTH,
  MAX_COMMENT_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_DISCOVERY_FIELD_LENGTH,
  MAX_EXTERNAL_ID_LENGTH,
  MAX_ORG_CONTEXT_LENGTH,
} = constants;

function str(n) {
  return "a".repeat(n);
}

async function errors(DtoClass, plain) {
  const instance = plainToInstance(DtoClass, plain);
  return validate(instance);
}

async function expectValid(DtoClass, plain) {
  const errs = await errors(DtoClass, plain);
  assert.equal(errs.length, 0, `Expected valid but got errors: ${JSON.stringify(errs.map(e => e.constraints))}`);
}

async function expectInvalid(DtoClass, plain, field) {
  const errs = await errors(DtoClass, plain);
  assert.ok(errs.length > 0, `Expected validation errors for ${field} but got none`);
  if (field) {
    const fieldErr = errs.find(e => e.property === field);
    assert.ok(fieldErr, `Expected error on field "${field}" but errors were on: ${errs.map(e => e.property).join(", ")}`);
  }
}

// ─── CreateIntakeDto ──────────────────────────────────────────────────────────

describe("CreateIntakeDto — max length enforcement", () => {
  const validBase = {
    title: "A valid title",
    description: "A valid description of sufficient length.",
    requester: "Jane Smith",
    projectType: "internal_tool",
  };

  test("valid input passes", async () => {
    await expectValid(CreateIntakeDto, validBase);
  });

  test("title at exact max passes", async () => {
    await expectValid(CreateIntakeDto, { ...validBase, title: str(MAX_INTAKE_TITLE_LENGTH) });
  });

  test("title over max → rejected", async () => {
    await expectInvalid(CreateIntakeDto, { ...validBase, title: str(MAX_INTAKE_TITLE_LENGTH + 1) }, "title");
  });

  test("description at exact max passes", async () => {
    await expectValid(CreateIntakeDto, { ...validBase, description: str(MAX_INTAKE_DESCRIPTION_LENGTH) });
  });

  test("description over max → rejected", async () => {
    await expectInvalid(CreateIntakeDto, { ...validBase, description: str(MAX_INTAKE_DESCRIPTION_LENGTH + 1) }, "description");
  });

  test("description at exact min passes", async () => {
    await expectValid(CreateIntakeDto, { ...validBase, description: str(MIN_INTAKE_DESCRIPTION_LENGTH) });
  });

  test("description under min → rejected", async () => {
    await expectInvalid(CreateIntakeDto, { ...validBase, description: str(MIN_INTAKE_DESCRIPTION_LENGTH - 1) }, "description");
  });

  test("requester over max → rejected", async () => {
    await expectInvalid(CreateIntakeDto, { ...validBase, requester: str(MAX_REQUESTER_NAME_LENGTH + 1) }, "requester");
  });

  test("department over max → rejected", async () => {
    await expectInvalid(CreateIntakeDto, { ...validBase, department: str(MAX_DEPARTMENT_NAME_LENGTH + 1) }, "department");
  });

  test("empty title → rejected", async () => {
    await expectInvalid(CreateIntakeDto, { ...validBase, title: "" }, "title");
  });

  test("unknown field is whitelisted away (no error when whitelist strips it)", async () => {
    // With whitelist:true, unknown fields are stripped — validate() on the instance won't error
    const instance = plainToInstance(CreateIntakeDto, { ...validBase, unknownField: "bad" });
    const errs = await validate(instance, { whitelist: true, forbidNonWhitelisted: false });
    assert.equal(errs.length, 0);
    assert.equal((instance).unknownField, undefined);
  });

  test("forbidNonWhitelisted=true rejects unknown field", async () => {
    const instance = plainToInstance(CreateIntakeDto, { ...validBase, unknownField: "bad" });
    const errs = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
    assert.ok(errs.length > 0, "Expected error for unknown field");
    assert.ok(errs.some(e => e.property === "unknownField"));
  });
});

// ─── RequestChangesDto ────────────────────────────────────────────────────────

describe("RequestChangesDto — max length enforcement", () => {
  test("valid reason passes", async () => {
    await expectValid(RequestChangesDto, { reason: "Need more detail." });
  });

  test("reason at exact max passes", async () => {
    await expectValid(RequestChangesDto, { reason: str(MAX_REASON_LENGTH) });
  });

  test("reason over max → rejected", async () => {
    await expectInvalid(RequestChangesDto, { reason: str(MAX_REASON_LENGTH + 1) }, "reason");
  });

  test("empty reason → rejected", async () => {
    await expectInvalid(RequestChangesDto, { reason: "" }, "reason");
  });
});

// ─── ApprovalDecisionDto ──────────────────────────────────────────────────────

describe("ApprovalDecisionDto — max length enforcement", () => {
  test("no comment passes", async () => {
    await expectValid(ApprovalDecisionDto, {});
  });

  test("comment at exact max passes", async () => {
    await expectValid(ApprovalDecisionDto, { comment: str(MAX_COMMENT_LENGTH) });
  });

  test("comment over max → rejected", async () => {
    await expectInvalid(ApprovalDecisionDto, { comment: str(MAX_COMMENT_LENGTH + 1) }, "comment");
  });
});

// ─── RejectAnalysisDraftDto ───────────────────────────────────────────────────

describe("RejectAnalysisDraftDto — max length enforcement", () => {
  test("reason at exact max passes", async () => {
    await expectValid(RejectAnalysisDraftDto, { reason: str(MAX_REASON_LENGTH) });
  });

  test("reason over max → rejected", async () => {
    await expectInvalid(RejectAnalysisDraftDto, { reason: str(MAX_REASON_LENGTH + 1) }, "reason");
  });
});

// ─── RegenerateAnalysisDraftDto ───────────────────────────────────────────────

describe("RegenerateAnalysisDraftDto — max length enforcement", () => {
  test("guidance at exact max passes", async () => {
    await expectValid(RegenerateAnalysisDraftDto, { guidance: str(MAX_REASON_LENGTH) });
  });

  test("guidance over max → rejected", async () => {
    await expectInvalid(RegenerateAnalysisDraftDto, { guidance: str(MAX_REASON_LENGTH + 1) }, "guidance");
  });

  test("guidance under min (10 chars) → rejected", async () => {
    await expectInvalid(RegenerateAnalysisDraftDto, { guidance: "short" }, "guidance");
  });
});

// ─── CompleteDiscoveryDto ─────────────────────────────────────────────────────

describe("CompleteDiscoveryDto — max length enforcement", () => {
  test("minimal valid input passes", async () => {
    await expectValid(CompleteDiscoveryDto, { problemStatement: "We need a system." });
  });

  test("problemStatement over max → rejected", async () => {
    await expectInvalid(CompleteDiscoveryDto, { problemStatement: str(MAX_DISCOVERY_FIELD_LENGTH + 1) }, "problemStatement");
  });

  test("notes over max → rejected", async () => {
    await expectInvalid(CompleteDiscoveryDto, { problemStatement: "Valid", notes: str(MAX_NOTE_LENGTH + 1) }, "notes");
  });

  test("notes at exact max passes", async () => {
    await expectValid(CompleteDiscoveryDto, { problemStatement: "Valid", notes: str(MAX_NOTE_LENGTH) });
  });
});

// ─── LifecycleTransitionDto ───────────────────────────────────────────────────

describe("LifecycleTransitionDto — max length enforcement", () => {
  test("empty body passes", async () => {
    await expectValid(LifecycleTransitionDto, {});
  });

  test("note at exact max passes", async () => {
    await expectValid(LifecycleTransitionDto, { note: str(MAX_NOTE_LENGTH) });
  });

  test("note over max → rejected", async () => {
    await expectInvalid(LifecycleTransitionDto, { note: str(MAX_NOTE_LENGTH + 1) }, "note");
  });

  test("blockedReason over max → rejected", async () => {
    await expectInvalid(LifecycleTransitionDto, { blockedReason: str(MAX_REASON_LENGTH + 1) }, "blockedReason");
  });

  test("canceledReason over max → rejected", async () => {
    await expectInvalid(LifecycleTransitionDto, { canceledReason: str(MAX_REASON_LENGTH + 1) }, "canceledReason");
  });
});

// ─── DiscoveryMessageDto (TASK-0040) ───────────────────────────────────────────
// Shared by POST /discovery (start) and POST /discovery/:id/message (follow-up).

describe("DiscoveryMessageDto — validation", () => {
  test("valid message passes", async () => {
    await expectValid(DiscoveryMessageDto, { message: "We need a way to track project handoffs." });
  });

  test("message at exact max passes", async () => {
    await expectValid(DiscoveryMessageDto, { message: str(MAX_DISCOVERY_FIELD_LENGTH) });
  });

  test("message over max → rejected", async () => {
    await expectInvalid(DiscoveryMessageDto, { message: str(MAX_DISCOVERY_FIELD_LENGTH + 1) }, "message");
  });

  test("empty message → rejected", async () => {
    await expectInvalid(DiscoveryMessageDto, { message: "" }, "message");
  });

  test("missing message → rejected", async () => {
    await expectInvalid(DiscoveryMessageDto, {}, "message");
  });

  test("non-string message → rejected", async () => {
    await expectInvalid(DiscoveryMessageDto, { message: 12345 }, "message");
  });

  test("forbidNonWhitelisted rejects unknown field", async () => {
    const instance = plainToInstance(DiscoveryMessageDto, { message: "ok", extra: "nope" });
    const errs = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
    assert.ok(errs.some(e => e.property === "extra"));
  });
});

// ─── AnswerClarificationDto (TASK-0040) ────────────────────────────────────────

describe("AnswerClarificationDto — validation", () => {
  const valid = { questionId: "CLARIFY-1", answer: "Covers both internal and client requests." };

  test("valid input passes", async () => {
    await expectValid(AnswerClarificationDto, valid);
  });

  test("missing questionId → rejected", async () => {
    await expectInvalid(AnswerClarificationDto, { answer: valid.answer }, "questionId");
  });

  test("missing answer → rejected", async () => {
    await expectInvalid(AnswerClarificationDto, { questionId: valid.questionId }, "answer");
  });

  test("questionId over max → rejected", async () => {
    await expectInvalid(AnswerClarificationDto, { ...valid, questionId: str(MAX_EXTERNAL_ID_LENGTH + 1) }, "questionId");
  });

  test("answer over max → rejected", async () => {
    await expectInvalid(AnswerClarificationDto, { ...valid, answer: str(MAX_DISCOVERY_FIELD_LENGTH + 1) }, "answer");
  });
});

// ─── SelectDirectionDto (TASK-0040) ────────────────────────────────────────────

describe("SelectDirectionDto — validation", () => {
  test("valid input passes", async () => {
    await expectValid(SelectDirectionDto, { solutionId: "SOL-1" });
  });

  test("missing solutionId → rejected", async () => {
    await expectInvalid(SelectDirectionDto, {}, "solutionId");
  });

  test("solutionId over max → rejected", async () => {
    await expectInvalid(SelectDirectionDto, { solutionId: str(MAX_EXTERNAL_ID_LENGTH + 1) }, "solutionId");
  });
});

// ─── UpdateDiscoverySettingsDto (TASK-0040) ────────────────────────────────────

describe("UpdateDiscoverySettingsDto — validation", () => {
  test("empty body passes (both fields optional)", async () => {
    await expectValid(UpdateDiscoverySettingsDto, {});
  });

  test("confidenceThreshold in range passes", async () => {
    await expectValid(UpdateDiscoverySettingsDto, { confidenceThreshold: 0.7 });
  });

  test("confidenceThreshold below min → rejected", async () => {
    await expectInvalid(UpdateDiscoverySettingsDto, { confidenceThreshold: 0.05 }, "confidenceThreshold");
  });

  test("confidenceThreshold above max → rejected", async () => {
    await expectInvalid(UpdateDiscoverySettingsDto, { confidenceThreshold: 0.95 }, "confidenceThreshold");
  });

  test("orgContext at exact max passes", async () => {
    await expectValid(UpdateDiscoverySettingsDto, { orgContext: str(MAX_ORG_CONTEXT_LENGTH) });
  });

  test("orgContext over max → rejected", async () => {
    await expectInvalid(UpdateDiscoverySettingsDto, { orgContext: str(MAX_ORG_CONTEXT_LENGTH + 1) }, "orgContext");
  });
});

// ─── Constants sanity checks ──────────────────────────────────────────────────

describe("validation constants — sanity checks", () => {
  test("all constants are positive integers", () => {
    const vals = [
      MAX_INTAKE_TITLE_LENGTH,
      MIN_INTAKE_DESCRIPTION_LENGTH,
      MAX_INTAKE_DESCRIPTION_LENGTH,
      MAX_REQUESTER_NAME_LENGTH,
      MAX_DEPARTMENT_NAME_LENGTH,
      MAX_REASON_LENGTH,
      MAX_COMMENT_LENGTH,
      MAX_NOTE_LENGTH,
      MAX_DISCOVERY_FIELD_LENGTH,
    ];
    for (const v of vals) {
      assert.ok(Number.isInteger(v) && v > 0, `Expected positive integer, got ${v}`);
    }
  });

  test("description limit is larger than title limit", () => {
    assert.ok(MAX_INTAKE_DESCRIPTION_LENGTH > MAX_INTAKE_TITLE_LENGTH);
  });

  test("description max is larger than description min", () => {
    assert.ok(MAX_INTAKE_DESCRIPTION_LENGTH > MIN_INTAKE_DESCRIPTION_LENGTH);
  });

  test("comment limit is larger than note limit", () => {
    assert.ok(MAX_COMMENT_LENGTH > MAX_NOTE_LENGTH);
  });
});
