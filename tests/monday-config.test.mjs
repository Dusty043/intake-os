import { strict as assert } from "assert";
import { describe, it, beforeEach, afterEach } from "node:test";
import { validateMondayConfig } from "../dist/src/index.js";

const VARS = [
  "MONDAY_API_TOKEN",
  "MONDAY_BOARD_ID",
  "MONDAY_GROUP_ID",
  "MONDAY_COLUMN_MAP_JSON",
  "MONDAY_API_VERSION",
];

describe("monday-config", () => {
  let original;

  beforeEach(() => {
    original = Object.fromEntries(VARS.map((key) => [key, process.env[key]]));
    process.env.MONDAY_API_TOKEN = "test-token";
    process.env.MONDAY_BOARD_ID = "123456";
    process.env.MONDAY_GROUP_ID = "new_group";
    process.env.MONDAY_COLUMN_MAP_JSON = JSON.stringify({ status_col_xyz: "projectType" });
    delete process.env.MONDAY_API_VERSION;
  });

  afterEach(() => {
    for (const key of VARS) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
  });

  it("parses a valid config", () => {
    const config = validateMondayConfig();
    assert.equal(config.apiToken, "test-token");
    assert.equal(config.boardId, "123456");
    assert.equal(config.groupId, "new_group");
    assert.deepEqual(config.columnMap, { status_col_xyz: "projectType" });
  });

  it("defaults apiVersion to 2026-04 when MONDAY_API_VERSION is unset", () => {
    const config = validateMondayConfig();
    assert.equal(config.apiVersion, "2026-04");
  });

  it("uses MONDAY_API_VERSION when set", () => {
    process.env.MONDAY_API_VERSION = "2026-07";
    const config = validateMondayConfig();
    assert.equal(config.apiVersion, "2026-07");
  });

  it("throws naming MONDAY_API_TOKEN when missing", () => {
    delete process.env.MONDAY_API_TOKEN;
    assert.throws(
      () => validateMondayConfig(),
      (err) => {
        assert.ok(err.message.includes("MONDAY_API_TOKEN"));
        return true;
      },
    );
  });

  it("throws naming MONDAY_BOARD_ID when missing", () => {
    delete process.env.MONDAY_BOARD_ID;
    assert.throws(
      () => validateMondayConfig(),
      (err) => {
        assert.ok(err.message.includes("MONDAY_BOARD_ID"));
        return true;
      },
    );
  });

  it("throws naming MONDAY_GROUP_ID when missing", () => {
    delete process.env.MONDAY_GROUP_ID;
    assert.throws(
      () => validateMondayConfig(),
      (err) => {
        assert.ok(err.message.includes("MONDAY_GROUP_ID"));
        return true;
      },
    );
  });

  it("throws naming MONDAY_COLUMN_MAP_JSON when missing", () => {
    delete process.env.MONDAY_COLUMN_MAP_JSON;
    assert.throws(
      () => validateMondayConfig(),
      (err) => {
        assert.ok(err.message.includes("MONDAY_COLUMN_MAP_JSON"));
        return true;
      },
    );
  });

  it("throws naming MONDAY_COLUMN_MAP_JSON when it is malformed JSON", () => {
    process.env.MONDAY_COLUMN_MAP_JSON = "{not json";
    assert.throws(
      () => validateMondayConfig(),
      (err) => {
        assert.ok(err.message.includes("MONDAY_COLUMN_MAP_JSON"));
        return true;
      },
    );
  });

  it("throws naming MONDAY_COLUMN_MAP_JSON when it is valid JSON but not an object", () => {
    process.env.MONDAY_COLUMN_MAP_JSON = "[1,2,3]";
    assert.throws(
      () => validateMondayConfig(),
      (err) => {
        assert.ok(err.message.includes("MONDAY_COLUMN_MAP_JSON"));
        return true;
      },
    );
  });
});
