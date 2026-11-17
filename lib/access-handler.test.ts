import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAccessHandler } from "./access-handler";
import { PaidAccessRequiredError } from "./entitlement-policy";

describe("cross-app access endpoint", () => {
  it("returns an uncached entitlement result for the authenticated user", async () => {
    let checkedUserId: string | undefined;
    const handler = createAccessHandler({
      getSession: async () => ({ user: { id: "user-1" } }),
      requirePaidAccess: async (userId) => {
        checkedUserId = userId;
      },
    });

    const response = await handler();

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { entitled: true });
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(checkedUserId, "user-1");
  });

  it("returns an uncached unauthorized response without a session", async () => {
    const handler = createAccessHandler({
      getSession: async () => null,
      requirePaidAccess: async () => {
        assert.fail("Must not check access without a session");
      },
    });

    const response = await handler();

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Unauthorized" });
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  });

  it("returns an uncached forbidden response when the user has no entitlement", async () => {
    const handler = createAccessHandler({
      getSession: async () => ({ user: { id: "user-1" } }),
      requirePaidAccess: async () => {
        throw new PaidAccessRequiredError();
      },
    });

    const response = await handler();

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { entitled: false });
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  });

  it("fails closed and logs session or entitlement lookup errors", async () => {
    const errors: unknown[] = [];
    const databaseError = new Error("Database unavailable");
    const handler = createAccessHandler({
      getSession: async () => ({ user: { id: "user-1" } }),
      requirePaidAccess: async () => {
        throw databaseError;
      },
      logError: (_message, error) => errors.push(error),
    });

    const response = await handler();

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: "Unable to verify access.",
    });
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(errors, [databaseError]);
  });

  it("fails closed when session validation fails", async () => {
    const errors: unknown[] = [];
    const sessionError = new Error("Auth service unavailable");
    const handler = createAccessHandler({
      getSession: async () => {
        throw sessionError;
      },
      requirePaidAccess: async () => {
        assert.fail("Must not check access when session validation fails");
      },
      logError: (_message, error) => errors.push(error),
    });

    const response = await handler();

    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(errors, [sessionError]);
  });
});
