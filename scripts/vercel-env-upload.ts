import { Vercel } from "@vercel/sdk";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
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

const LOCAL_ONLY_ENV_KEYS = new Set([
  "VERCEL_TOKEN",
  "VERCEL_PROJECT_ID",
  "VERCEL_TEAM_ID",
]);

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
    if (typeof value === "string") {
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

function getCredentials(env: {
  VERCEL_TOKEN?: string;
  VERCEL_PROJECT_ID?: string;
  VERCEL_TEAM_ID?: string;
}): VercelCredentials {
  const token = env.VERCEL_TOKEN?.trim();
  const projectId = env.VERCEL_PROJECT_ID?.trim();
  const teamId = env.VERCEL_TEAM_ID?.trim();

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
  const result = await syncEnvironment(
    options.environment,
    variables,
    credentials,
    options.checkOnly,
  );

  if (options.checkOnly) {
    console.info(
      `Validated ${file}: will replace ${result.existingCount} ${options.environment} variables with ${result.variableCount} file variables.`,
    );
    return;
  }

  console.info(
    `Synced ${result.variableCount} ${options.environment} variables.`,
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
