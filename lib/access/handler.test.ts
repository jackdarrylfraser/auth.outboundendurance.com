import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAccessHandler } from "@/lib/access/handler";
import { PaidAccessRequiredError } from "@/lib/access/entitlement-policy";

describe("cross-app access endpoint", () => {
  it("validates the submitted cookie and returns an uncached entitlement result", async () => {
    let checkedUserId: string | undefined;
    let checkedCookie: { name: string; value: string } | undefined;
    const handler = createAccessHandler({
      getSession: async (cookie) => {
        checkedCookie = cookie;
        return { user: { id: "user-1" } };
      },
      requirePaidAccess: async (userId) => {
        checkedUserId = userId;
      },
    });

    const response = await handler(
      new Request("https://auth.outboundendurance.com/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cookie: {
            name: "__Secure-better-auth.session_token",
            value: "signed-session-cookie",
          },
        }),
      }),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      accessType: "paid",
      hasAccess: true,
    });
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(checkedCookie, {
      name: "__Secure-better-auth.session_token",
      value: "signed-session-cookie",
    });
    assert.equal(checkedUserId, "user-1");
  });

  it("checks authentication without requiring paid access when requested", async () => {
    let checkedCookie: { name: string; value: string } | undefined;
    const handler = createAccessHandler({
      getSession: async (cookie) => {
        checkedCookie = cookie;
        return { user: { id: "user-1" } };
      },
      requirePaidAccess: async () => {
        assert.fail("Must not check paid access for an authentication-only request");
      },
    });

    const response = await handler(
      new Request("https://auth.outboundendurance.com/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access: "authenticated",
          cookie: {
            name: "better-auth.session_token",
            value: "signed-session-cookie",
          },
        }),
      }),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      accessType: "authenticated",
      hasAccess: true,
    });
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(checkedCookie, {
      name: "better-auth.session_token",
      value: "signed-session-cookie",
    });
  });

  it("rejects a request without a cookie", async () => {
    const handler = createAccessHandler({
      getSession: async () => {
        assert.fail("Must not validate a session without a token");
      },
      requirePaidAccess: async () => {
        assert.fail("Must not check access without a session");
      },
    });

    const response = await handler(
      new Request("https://auth.outboundendurance.com/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "A session cookie is required.",
    });
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  });

  it("rejects an invalid session cookie", async () => {
    const handler = createAccessHandler({
      getSession: async () => {
        assert.fail("Must not validate an invalid token");
      },
      requirePaidAccess: async () => {
        assert.fail("Must not check access without a session");
      },
    });

    const response = await handler(
      new Request("https://auth.outboundendurance.com/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cookie: {
            name: "not-a-session-cookie",
            value: "signed-session-cookie",
          },
        }),
      }),
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "A session cookie is required.",
    });
  });

  it("returns an uncached unauthorized response for an invalid cookie", async () => {
    const handler = createAccessHandler({
      getSession: async () => null,
      requirePaidAccess: async () => {
        assert.fail("Must not check access without a session");
      },
    });

    const response = await handler(
      new Request("https://auth.outboundendurance.com/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cookie: {
            name: "better-auth.session_token",
            value: "invalid-cookie",
          },
        }),
      }),
    );

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      accessType: "paid",
      hasAccess: false,
    });
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  });

  it("returns the requested access type with hasAccess false for an invalid authentication check", async () => {
    const handler = createAccessHandler({
      getSession: async () => null,
      requirePaidAccess: async () => {
        assert.fail("Must not check paid access without a session");
      },
    });

    const response = await handler(
      new Request("https://auth.outboundendurance.com/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access: "authenticated",
          cookie: {
            name: "better-auth.session_token",
            value: "invalid-cookie",
          },
        }),
      }),
    );

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      accessType: "authenticated",
      hasAccess: false,
    });
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  });

  it("returns an uncached forbidden response when the user has no entitlement", async () => {
    const handler = createAccessHandler({
      getSession: async () => ({ user: { id: "user-1" } }),
      requirePaidAccess: async () => {
        throw new PaidAccessRequiredError();
      },
    });

    const response = await handler(
      new Request("https://auth.outboundendurance.com/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cookie: {
            name: "better-auth.session_token",
            value: "signed-session-cookie",
          },
        }),
      }),
    );

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      accessType: "paid",
      hasAccess: false,
    });
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

    const response = await handler(
      new Request("https://auth.outboundendurance.com/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cookie: {
            name: "better-auth.session_token",
            value: "signed-session-cookie",
          },
        }),
      }),
    );

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

    const response = await handler(
      new Request("https://auth.outboundendurance.com/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cookie: {
            name: "better-auth.session_token",
            value: "signed-session-cookie",
          },
        }),
      }),
    );

    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(errors, [sessionError]);
  });

  it("rethrows Next.js prerender interruptions", async () => {
    const prerenderInterrupt = Object.assign(
      new Error("Prerender interrupted"),
      { digest: "HANGING_PROMISE_REJECTION" },
    );
    const handler = createAccessHandler({
      getSession: async () => {
        throw prerenderInterrupt;
      },
      requirePaidAccess: async () => {
        assert.fail("Must not check access when session validation fails");
      },
      logError: () => {
        assert.fail("Must not log framework prerender interruptions");
      },
    });

    await assert.rejects(
      () =>
        handler(
          new Request("https://auth.outboundendurance.com/api/access", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              cookie: {
                name: "better-auth.session_token",
                value: "signed-session-cookie",
              },
            }),
          }),
        ),
      (error) => {
        assert.equal(error, prerenderInterrupt);
        return true;
      },
    );
  });
});
