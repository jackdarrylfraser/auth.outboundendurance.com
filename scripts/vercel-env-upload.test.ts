import assert from "node:assert/strict";
import { HTTPClient, Vercel } from "@vercel/sdk";
import { describe, it } from "node:test";

for (const [key, value] of Object.entries({
  BETTER_AUTH_SECRET: "test-secret-value-that-is-at-least-thirty-two-characters",
  BETTER_AUTH_URL: "https://example.test",
  STRIPE_SECRET_KEY: "test-stripe-secret",
  STRIPE_WEBHOOK_SECRET: "test-stripe-webhook-secret",
  RESEND_API_KEY: "test-resend-key",
  RESEND_FROM_EMAIL: "test@example.test",
  TURSO_DATABASE_URL: "file:test.db",
})) {
  process.env[key] ??= value;
}

const { compareEnvFiles, syncEnvironment } =
  await import("./vercel-env-upload");

const credentials = {
  token: "test-token",
  projectId: "prj_test",
  teamId: "team_test",
};

type ApiCall = {
  url: URL;
  method: string;
  authorization: string | null;
  body?: string;
};

function createClient(
  respond: (call: ApiCall) => Response | Promise<Response>,
): { client: Vercel; calls: ApiCall[] } {
  const calls: ApiCall[] = [];
  const client = new Vercel({
    bearerToken: credentials.token,
    httpClient: new HTTPClient({
      fetcher: async (input, init) => {
        const request =
          input instanceof Request ? input : new Request(input, init);
        const call: ApiCall = {
          url: new URL(request.url),
          method: request.method,
          authorization: request.headers.get("Authorization"),
          ...(request.method === "POST"
            ? { body: await request.clone().text() }
            : {}),
        };
        calls.push(call);
        return respond(call);
      },
    }),
  });
  return { client, calls };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function environmentVariable(
  id: string,
  key: string,
  target: string[],
  gitBranch?: string,
) {
  return {
    id,
    key,
    target,
    type: "encrypted",
    value: "",
    securityIssues: [],
    ...(gitBranch ? { gitBranch } : {}),
  };
}

function environmentList(
  envs: ReturnType<typeof environmentVariable>[],
  next: number | null = null,
) {
  return {
    envs,
    pagination: { count: envs.length, next, prev: null },
  };
}

describe("Vercel env uploader", () => {
  it("accepts exactly the populated fields from the example", () => {
    assert.deepEqual(
      compareEnvFiles(
        "DATABASE_URL=\nAPI_KEY=\n",
        'DATABASE_URL="libsql://db.example"\nAPI_KEY="secret=value"\n',
      ),
      { missing: [], extra: [], empty: [] },
    );
  });

  it("reports missing, extra, and empty values", () => {
    assert.deepEqual(
      compareEnvFiles(
        "DATABASE_URL=\nAPI_KEY=\n",
        "DATABASE_URL=\nOTHER_KEY=unexpected\n",
      ),
      {
        missing: ["API_KEY"],
        extra: ["OTHER_KEY"],
        empty: ["DATABASE_URL"],
      },
    );
  });

  it("does not require or sync the optional team ID", () => {
    assert.deepEqual(
      compareEnvFiles(
        "DATABASE_URL=\nVERCEL_TOKEN=\nVERCEL_PROJECT_ID=\nVERCEL_TEAM_ID=\n",
        "DATABASE_URL=libsql://db.example\nVERCEL_TOKEN=token\nVERCEL_PROJECT_ID=prj_test\nVERCEL_TEAM_ID=\n",
      ),
      { missing: [], extra: [], empty: [] },
    );
  });

  it("checks the environment without making changes in check mode", async () => {
    const { client, calls } = createClient(() =>
      jsonResponse(
        environmentList([
          environmentVariable("env_preview", "KEY", ["preview"]),
          environmentVariable("env_prod", "PROD", ["production"]),
        ]),
      ),
    );

    assert.deepEqual(
      await syncEnvironment(
        "preview",
        { KEY: "value" },
        credentials,
        true,
        client,
      ),
      { existingCount: 1, variableCount: 1 },
    );
    assert.deepEqual(calls.map(({ method }) => method), ["GET"]);
    assert.equal(calls[0].url.searchParams.get("teamId"), "team_test");
    assert.equal(calls[0].authorization, "Bearer test-token");
  });

  it("deletes branch variables first and recreates encrypted target variables", async () => {
    const { client, calls } = createClient((call) => {
      if (call.method === "GET") {
        return jsonResponse(
          environmentList([
            environmentVariable(
              "env_branch",
              "OLD_BRANCH",
              ["preview"],
              "feature",
            ),
            environmentVariable("env_preview", "OLD", ["preview"]),
            environmentVariable("env_prod", "PROD", ["production"]),
          ]),
        );
      }
      if (call.method === "DELETE") {
        return jsonResponse([]);
      }
      return jsonResponse(
        {
          created: {
            key: "DATABASE_URL",
            value: "secret-value",
            type: "encrypted",
          },
          failed: [],
        },
        201,
      );
    });

    assert.deepEqual(
      await syncEnvironment(
        "preview",
        {
          DATABASE_URL: "secret-value",
          VERCEL_TOKEN: "must-not-upload",
          VERCEL_PROJECT_ID: "prj_test",
          VERCEL_TEAM_ID: "team_test",
        },
        credentials,
        false,
        client,
      ),
      { existingCount: 2, variableCount: 1 },
    );
    assert.deepEqual(calls.map(({ method }) => method), [
      "GET",
      "DELETE",
      "DELETE",
      "POST",
    ]);
    assert.ok(calls[1].url.pathname.endsWith("/env/env_branch"));
    assert.ok(calls[2].url.pathname.endsWith("/env/env_preview"));
    assert.deepEqual(JSON.parse(calls[3].body ?? ""), {
      key: "DATABASE_URL",
      value: "secret-value",
      type: "encrypted",
      target: ["preview"],
    });
  });

  it("refuses shared variables before making changes", async () => {
    const { client, calls } = createClient(() =>
      jsonResponse(
        environmentList([
          environmentVariable("env_shared", "SHARED_KEY", [
            "preview",
            "production",
          ]),
        ]),
      ),
    );

    await assert.rejects(
      syncEnvironment("preview", {}, credentials, false, client),
      /Cannot safely replace variables shared with other environments: SHARED_KEY/,
    );
    assert.deepEqual(calls.map(({ method }) => method), ["GET"]);
  });

  it("refuses to sync when Vercel hides production variables", async () => {
    const { client } = createClient(() =>
      jsonResponse({ envs: [], hiddenProductionEnvCount: 1 }),
    );

    await assert.rejects(
      syncEnvironment("production", {}, credentials, false, client),
      /Vercel hid production variables/,
    );
  });

  it("refuses a paginated list rather than syncing an incomplete set", async () => {
    const { client, calls } = createClient(() =>
      jsonResponse(
        environmentList(
          [environmentVariable("env_preview", "KEY", ["preview"])],
          1234,
        ),
      ),
    );

    await assert.rejects(
      syncEnvironment("preview", {}, credentials, false, client),
      /paginated environment list/,
    );
    assert.deepEqual(calls.map(({ method }) => method), ["GET"]);
  });

  it("reports API status without exposing the response body", async () => {
    const { client } = createClient(
      () =>
        new Response("sensitive API response", {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }),
    );

    await assert.rejects(
      syncEnvironment("preview", {}, credentials, true, client),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes("HTTP 403") &&
        !error.message.includes("sensitive API response"),
    );
  });
});
