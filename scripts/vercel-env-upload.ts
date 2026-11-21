import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import { fileURLToPath } from "node:url";

type Environment = "preview" | "production";
type ExistingVariable = {
  key: string;
  target: string[];
  gitBranch?: string;
};

const usage =
  "Usage: bun run scripts/vercel-env-upload.ts --environment <preview|production> [--check]";

export function compareEnvFiles(
  example: string,
  environmentFile: string,
): { missing: string[]; extra: string[]; empty: string[] } {
  const expected = parse(example);
  const actual = parse(environmentFile);
  const expectedKeys = Object.keys(expected);
  const actualKeys = Object.keys(actual);

  return {
    missing: expectedKeys.filter((key) => !Object.hasOwn(actual, key)),
    extra: actualKeys.filter((key) => !Object.hasOwn(expected, key)),
    empty: expectedKeys.filter(
      (key) => Object.hasOwn(actual, key) && !actual[key].trim(),
    ),
  };
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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function listExistingVariables(environment: Environment): ExistingVariable[] {
  const result = spawnSync(
    "bunx",
    [
      "vercel",
      "env",
      "list",
      "--environment",
      environment,
      "--format=json",
    ],
    { encoding: "utf8" },
  );
  if (result.error || result.status !== 0) {
    throw new Error(`Could not list Vercel ${environment} variables.`);
  }

  let response: unknown;
  try {
    response = JSON.parse(result.stdout);
  } catch {
    throw new Error("Vercel returned an invalid environment variable list.");
  }
  if (
    typeof response !== "object" ||
    response === null ||
    !("envs" in response) ||
    !Array.isArray(response.envs)
  ) {
    throw new Error("Vercel returned an invalid environment variable list.");
  }

  return response.envs.map((entry): ExistingVariable => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("key" in entry) ||
      typeof entry.key !== "string" ||
      !("target" in entry) ||
      !isStringArray(entry.target)
    ) {
      throw new Error("Vercel returned an invalid environment variable list.");
    }

    return {
      key: entry.key,
      target: entry.target,
      ...("gitBranch" in entry && typeof entry.gitBranch === "string"
        ? { gitBranch: entry.gitBranch }
        : {}),
    };
  });
}

function runVercel(args: string[], value?: string): Promise<void> {
  const child = spawn("bunx", ["vercel", ...args], {
    stdio: ["pipe", "inherit", "inherit"],
  });
  child.stdin.end(value === undefined ? undefined : `${value}\n`);

  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error("Vercel CLI operation failed."));
      }
    });
  });
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
  if (mismatch.missing.length || mismatch.extra.length || mismatch.empty.length) {
    const details = [
      mismatch.missing.length && `missing: ${mismatch.missing.join(", ")}`,
      mismatch.extra.length && `extra: ${mismatch.extra.join(", ")}`,
      mismatch.empty.length && `empty: ${mismatch.empty.join(", ")}`,
    ].filter(Boolean);
    throw new Error(`${file} must exactly match .env.example (${details.join("; ")}).`);
  }

  const variables = parse(environmentFile);
  const existing = listExistingVariables(options.environment);
  const shared = existing.filter((variable) =>
    variable.target.some((target) => target !== options.environment),
  );
  if (shared.length) {
    throw new Error(
      `Cannot safely replace variables shared with other environments: ${shared.map(({ key }) => key).join(", ")}.`,
    );
  }

  if (options.checkOnly) {
    console.info(
      `Validated ${file}: will replace ${existing.length} ${options.environment} variables with ${Object.keys(variables).length} file variables.`,
    );
    return;
  }

  const branchVariables = existing.filter(({ gitBranch }) => gitBranch);
  const generalVariables = existing.filter(({ gitBranch }) => !gitBranch);
  for (const variable of [...branchVariables, ...generalVariables]) {
    await runVercel([
      "env",
      "remove",
      variable.key,
      "--environment",
      options.environment,
      ...(variable.gitBranch ? ["--git-branch", variable.gitBranch] : []),
      "--yes",
    ]);
  }

  for (const [name, value] of Object.entries(variables)) {
    await runVercel(
      [
        "env",
        "add",
        name,
        "--environment",
        options.environment,
        "--type",
        "secret",
        "--yes",
      ],
      value,
    );
  }

  console.info(
    `Synced ${Object.keys(variables).length} ${options.environment} variables.`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Vercel env sync failed.");
    process.exitCode = 1;
  });
}
