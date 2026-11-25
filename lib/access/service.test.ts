import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PaidAccessRequiredError } from "@/lib/access/entitlement-policy";
import { createAccessService } from "@/lib/access/service";

const cookie = {
  name: "better-auth.session_token",
  value: "session-token",
};

describe("access service", () => {
  it("reports unauthenticated requests without checking paid access", async () => {
    let paidAccessChecks = 0;
    const service = createAccessService({
      getSession: async () => null,
      async requirePaidAccess() {
        paidAccessChecks += 1;
      },
    });

    assert.deepEqual(
      await service.checkAccess({ cookie, access: "paid" }),
      { type: "unauthenticated", accessType: "paid" },
    );
    assert.equal(paidAccessChecks, 0);
  });

  it("checks only authentication when requested", async () => {
    let paidAccessChecks = 0;
    const service = createAccessService({
      getSession: async () => ({ user: { id: "123" } }),
      async requirePaidAccess() {
        paidAccessChecks += 1;
      },
    });

    assert.deepEqual(
      await service.checkAccess({ cookie, access: "authenticated" }),
      { type: "authenticated" },
    );
    assert.equal(paidAccessChecks, 0);
  });

  it("reports paid access when the entitlement check succeeds", async () => {
    const checkedUsers: string[] = [];
    const service = createAccessService({
      getSession: async () => ({ user: { id: "123" } }),
      async requirePaidAccess(userId) {
        checkedUsers.push(userId);
      },
    });

    assert.deepEqual(
      await service.checkAccess({ cookie, access: "paid" }),
      { type: "paid" },
    );
    assert.deepEqual(checkedUsers, ["123"]);
  });

  it("reports forbidden for users without paid entitlement", async () => {
    const service = createAccessService({
      getSession: async () => ({ user: { id: "123" } }),
      async requirePaidAccess() {
        throw new PaidAccessRequiredError();
      },
    });

    assert.deepEqual(
      await service.checkAccess({ cookie, access: "paid" }),
      { type: "forbidden" },
    );
  });

  it("propagates unexpected access-check failures", async () => {
    const error = new Error("Database unavailable");
    const service = createAccessService({
      getSession: async () => ({ user: { id: "123" } }),
      async requirePaidAccess() {
        throw error;
      },
    });

    await assert.rejects(
      service.checkAccess({ cookie, access: "paid" }),
      error,
    );
  });
});
