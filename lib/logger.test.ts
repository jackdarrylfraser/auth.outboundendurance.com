import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getLogger } from "@/lib/logger";

describe("application logger", () => {
  it("reuses one logger instance per runtime", () => {
    assert.strictEqual(getLogger(), getLogger());
  });
});
