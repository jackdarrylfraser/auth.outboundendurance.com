import Stripe from "stripe";
import { Vercel } from "@vercel/sdk";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { getStripeLivemode } from "../lib/billing/stripe/catalog-definition";
import { STRIPE_WEBHOOK_EVENTS } from "../lib/billing/stripe/webhook-policy";
import { env } from "../lib/env";

type Environment = "preview" | "production";
type ExistingVariable = {
  id: string;
  key: string;
  target: string[];
  gitBranch?: string;
};
type VercelCredentials = {
  token: string;
  projectId: string;
  teamId?: string;
};
type StripeWebhookEndpoint = Pick<
  Stripe.WebhookEndpoint,
  "id" | "url" | "livemode"
> & {
  secret?: string;
};
type StripeWebhookApi = {
  webhookEndpoints: {
    list(
      params: Stripe.WebhookEndpointListParams,
    ): AsyncIterable<StripeWebhookEndpoint>;
    del(id: string): Promise<unknown>;
    create(
      params: Stripe.WebhookEndpointCreateParams,
    ): Promise<StripeWebhookEndpoint>;
  };
};

const LOCAL_ONLY_ENV_KEYS = new Set([
  "VERCEL_TOKEN",
  "VERCEL_PROJECT_ID",
  "VERCEL_TEAM_ID",
]);

const GENERATED_ENV_KEYS = new Set(["STRIPE_WEBHOOK_SECRET"]);
const usage =
  "Usage: bun --env-file=.env.<preview|production> run scripts/vercel-env-upload.ts --environment <preview|production> [--check]";

export function compareEnvFiles(
  example: string,
  environmentFile: string,
): { missing: string[]; extra: string[]; empty: string[] } {
  const expected = parseEnv(example);
  const actual = parseEnv(environmentFile);
  const expectedKeys = Object.keys(expected);
  const actualKeys = Object.keys(actual);

  return {
    missing: expectedKeys.filter((key) => !Object.hasOwn(actual, key)),
    extra: actualKeys.filter((key) => !Object.hasOwn(expected, key)),
    empty: expectedKeys.filter(
      (key) =>
        !LOCAL_ONLY_ENV_KEYS.has(key) &&
        Object.hasOwn(actual, key) &&
        !(actual[key] ?? "").trim(),
    ),
  };
}

function getEnvironmentValues(source: object): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string" && !GENERATED_ENV_KEYS.has(key)) {
      values[key] = value;
    }
  }
  return values;
}

function getOptions(args: string[]): {
  environment?: Environment;
  checkOnly: boolean;
  help: boolean;
} {
  if (args.includes("--help")) {
    return { checkOnly: false, help: true };
  }

  const environmentIndex = args.indexOf("--environment");
  const environment = args[environmentIndex + 1];
  if (environment !== "preview" && environment !== "production") {
    throw new Error(usage);
  }

  const remaining = args.filter(
    (_arg, index) =>
      index !== environmentIndex && index !== environmentIndex + 1,
  );
  if (remaining.some((arg) => arg !== "--check")) {
    throw new Error(usage);
  }

  return {
    environment,
    checkOnly: remaining.includes("--check"),
    help: false,
  };
}

function getCredentials(
  source: Pick<
    typeof env,
    "VERCEL_TOKEN" | "VERCEL_PROJECT_ID" | "VERCEL_TEAM_ID"
  >,
): VercelCredentials {
  const token = source.VERCEL_TOKEN?.trim();
  const projectId = source.VERCEL_PROJECT_ID?.trim();
  const teamId = source.VERCEL_TEAM_ID?.trim();

  if (!token || !projectId) {
    throw new Error(
      "Set VERCEL_TOKEN and VERCEL_PROJECT_ID before syncing Vercel variables.",
    );
  }

  return {
    token,
    projectId,
    ...(teamId ? { teamId } : {}),
  };
}

export function getStripeWebhookUrl(baseUrl: string): string {
  const parsedBaseUrl = new URL(baseUrl);
  if (parsedBaseUrl.protocol !== "https:") {
    throw new Error(
      "BASE_URL must use HTTPS when provisioning Stripe webhooks.",
    );
  }

  return new URL("/api/stripe/webhook", parsedBaseUrl).toString();
}

export function assertStripeEnvironmentMode(
  environment: Environment,
  livemode: boolean,
): void {
  if ((environment === "production") !== livemode) {
    throw new Error(
      `The ${environment} environment requires a Stripe ${environment === "production" ? "live" : "test"} key.`,
    );
  }
}

export async function listStripeWebhooksAtUrl(
  stripe: StripeWebhookApi,
  url: string,
): Promise<StripeWebhookEndpoint[]> {
  const matchingEndpoints: StripeWebhookEndpoint[] = [];

  for await (const endpoint of stripe.webhookEndpoints.list({ limit: 100 })) {
    if (endpoint.url === url) {
      matchingEndpoints.push(endpoint);
    }
  }

  return matchingEndpoints;
}

export async function replaceStripeWebhook(
  stripe: StripeWebhookApi,
  environment: Environment,
  url: string,
  livemode: boolean,
): Promise<{ endpointId: string; secret: string; replacedCount: number }> {
  const existingEndpoints = await listStripeWebhooksAtUrl(stripe, url);
  if (existingEndpoints.some((endpoint) => endpoint.livemode !== livemode)) {
    throw new Error(
      "Stripe returned a webhook endpoint for the wrong mode; refusing to replace it.",
    );
  }

  for (const endpoint of existingEndpoints) {
    await stripe.webhookEndpoints.del(endpoint.id);
  }

  const endpoint = await stripe.webhookEndpoints.create({
    url,
    enabled_events: STRIPE_WEBHOOK_EVENTS,
    metadata: {
      environment,
    },
  });

  if (endpoint.url !== url || endpoint.livemode !== livemode) {
    await stripe.webhookEndpoints.del(endpoint.id);
    throw new Error(
      "Stripe created a webhook endpoint with unexpected settings.",
    );
  }

  if (!endpoint.secret) {
    await stripe.webhookEndpoints.del(endpoint.id);
    throw new Error(
      "Stripe did not return the new webhook signing secret; endpoint was removed.",
    );
  }

  return {
    endpointId: endpoint.id,
    secret: endpoint.secret,
    replacedCount: existingEndpoints.length,
  };
}

function getStatusCode(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }
}

async function callVercel<T>(
  operation: string,
  request: () => Promise<T>,
): Promise<T> {
  try {
    return await request();
  } catch (error) {
    const statusCode = getStatusCode(error);
    if (statusCode !== undefined) {
      throw new Error(`Vercel API ${operation} failed (HTTP ${statusCode}).`);
    }

    throw new Error(
      `Vercel SDK ${operation} failed: ${error instanceof Error ? error.message : "unknown error"}.`,
    );
  }
}

async function listExistingVariables(
  environment: Environment,
  credentials: VercelCredentials,
  client: Vercel,
): Promise<ExistingVariable[]> {
  const response = await callVercel("environment variable listing", () =>
    client.projects.filterProjectEnvs({
      idOrName: credentials.projectId,
      ...(credentials.teamId ? { teamId: credentials.teamId } : {}),
    }),
  );

  if (!("envs" in response) || !Array.isArray(response.envs)) {
    throw new Error("Vercel returned an invalid environment variable list.");
  }
  if (
    "hiddenProductionEnvCount" in response &&
    response.hiddenProductionEnvCount > 0
  ) {
    throw new Error(
      "Vercel hid production variables; refusing to sync an incomplete environment list.",
    );
  }
  if ("pagination" in response && response.pagination.next !== null) {
    throw new Error(
      "Vercel returned a paginated environment list; refusing to sync an incomplete list.",
    );
  }

  const variables = response.envs.flatMap((entry): ExistingVariable[] => {
    if (entry.system) {
      return [];
    }

    const targets = Array.isArray(entry.target)
      ? entry.target
      : typeof entry.target === "string"
        ? [entry.target]
        : null;
    if (
      typeof entry.id !== "string" ||
      typeof entry.key !== "string" ||
      !targets
    ) {
      throw new Error("Vercel returned an invalid environment variable list.");
    }

    return [
      {
        id: entry.id,
        key: entry.key,
        target: targets,
        ...(typeof entry.gitBranch === "string"
          ? { gitBranch: entry.gitBranch }
          : {}),
      },
    ];
  });

  return variables.filter((variable) => variable.target.includes(environment));
}

export async function syncEnvironment(
  environment: Environment,
  variables: Record<string, string>,
  credentials: VercelCredentials,
  checkOnly: boolean,
  client = new Vercel({
    bearerToken: credentials.token,
    timeoutMs: 30_000,
  }),
): Promise<{ existingCount: number; variableCount: number }> {
  const uploadVariables = Object.fromEntries(
    Object.entries(variables).filter(([key]) => !LOCAL_ONLY_ENV_KEYS.has(key)),
  );
  const existing = await listExistingVariables(
    environment,
    credentials,
    client,
  );
  const shared = existing.filter((variable) =>
    variable.target.some((target) => target !== environment),
  );
  if (shared.length) {
    throw new Error(
      `Cannot safely replace variables shared with other environments: ${shared.map(({ key }) => key).join(", ")}.`,
    );
  }

  if (checkOnly) {
    return {
      existingCount: existing.length,
      variableCount: Object.keys(uploadVariables).length,
    };
  }

  const branchVariables = existing.filter(({ gitBranch }) => gitBranch);
  const generalVariables = existing.filter(({ gitBranch }) => !gitBranch);
  for (const variable of [...branchVariables, ...generalVariables]) {
    await callVercel("environment variable removal", () =>
      client.projects.removeProjectEnv({
        idOrName: credentials.projectId,
        id: variable.id,
        ...(credentials.teamId ? { teamId: credentials.teamId } : {}),
      }),
    );
  }

  for (const [key, value] of Object.entries(uploadVariables)) {
    await callVercel("environment variable creation", () =>
      client.projects.createProjectEnv({
        idOrName: credentials.projectId,
        ...(credentials.teamId ? { teamId: credentials.teamId } : {}),
        requestBody: {
          key,
          value,
          type: "encrypted",
          target: [environment],
        },
      }),
    );
  }

  return {
    existingCount: existing.length,
    variableCount: Object.keys(uploadVariables).length,
  };
}

async function main(): Promise<void> {
  const options = getOptions(process.argv.slice(2));
  if (options.help) {
    console.info(usage);
    return;
  }
  if (!options.environment) {
    throw new Error(usage);
  }

  const file = `.env.${options.environment}`;
  const [example, environmentFile] = await Promise.all([
    readFile(".env.example", "utf8"),
    readFile(file, "utf8"),
  ]);
  const mismatch = compareEnvFiles(example, environmentFile);
  if (
    mismatch.missing.length ||
    mismatch.extra.length ||
    mismatch.empty.length
  ) {
    const details = [
      mismatch.missing.length && `missing: ${mismatch.missing.join(", ")}`,
      mismatch.extra.length && `extra: ${mismatch.extra.join(", ")}`,
      mismatch.empty.length && `empty: ${mismatch.empty.join(", ")}`,
    ].filter(Boolean);
    throw new Error(
      `${file} must exactly match .env.example (${details.join("; ")}).`,
    );
  }

  const variables = getEnvironmentValues(env);
  const credentials = getCredentials(env);
  const webhookUrl = getStripeWebhookUrl(env.BASE_URL);
  const livemode = getStripeLivemode(env.STRIPE_SECRET_KEY);
  assertStripeEnvironmentMode(options.environment, livemode);
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);

  const [matchingEndpoints, preflight] = await Promise.all([
    listStripeWebhooksAtUrl(stripe, webhookUrl),
    syncEnvironment(options.environment, variables, credentials, true),
  ]);
  if (matchingEndpoints.some((endpoint) => endpoint.livemode !== livemode)) {
    throw new Error(
      "Stripe returned a webhook endpoint for the wrong mode; refusing to replace it.",
    );
  }

  if (options.checkOnly) {
    console.info(
      `Validated ${file}: will replace ${matchingEndpoints.length} Stripe webhook endpoint(s) at ${webhookUrl} and ${preflight.existingCount} ${options.environment} variables with ${preflight.variableCount + 1} encrypted variables.`,
    );
    return;
  }

  const webhook = await replaceStripeWebhook(
    stripe,
    options.environment,
    webhookUrl,
    livemode,
  );
  let result: { existingCount: number; variableCount: number };
  try {
    result = await syncEnvironment(
      options.environment,
      { ...variables, STRIPE_WEBHOOK_SECRET: webhook.secret },
      credentials,
      false,
    );
  } catch (error) {
    try {
      await stripe.webhookEndpoints.del(webhook.endpointId);
    } catch (cleanupError) {
      const syncMessage =
        error instanceof Error ? error.message : "unknown Vercel error";
      const cleanupMessage =
        cleanupError instanceof Error
          ? cleanupError.message
          : "unknown Stripe error";
      throw new Error(
        `Vercel env sync failed (${syncMessage}) and the new Stripe webhook endpoint could not be removed (${cleanupMessage}); inspect ${webhookUrl}.`,
      );
    }

    throw error;
  }

  console.info(
    `Synced ${result.variableCount} ${options.environment} variables and replaced ${webhook.replacedCount} Stripe webhook endpoint(s).`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Vercel env sync failed.",
    );
    process.exitCode = 1;
  });
}
