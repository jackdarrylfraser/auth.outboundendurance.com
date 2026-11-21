import { spawn } from "node:child_process";

const cronPath = "/api/cron/sync-subscriptions";
const args = process.argv.slice(2);

function getCronEndpoint(baseUrl: string): string {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error("Provide a valid deployment URL.");
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "The deployment URL must be an HTTPS origin without a path or query.",
    );
  }

  return new URL(cronPath, url).toString();
}

async function triggerCron(endpoint: string): Promise<void> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "CRON_SECRET is missing from the selected Vercel environment.",
    );
  }

  console.info(`Calling ${endpoint}`);
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${secret}`,
      Accept: "application/json",
    },
    redirect: "manual",
    signal: AbortSignal.timeout(35_000),
  });
  const body = await response.text();

  console.info(`Response: HTTP ${response.status}`);
  if (body) {
    console.info(body);
  }

  if (!response.ok) {
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  if (args[0] === "--request") {
    const endpoint = args[1];
    if (!endpoint || args.length !== 2) {
      throw new Error("Internal request mode requires one endpoint URL.");
    }

    await triggerCron(endpoint);
    return;
  }

  const [environment, baseUrl, ...options] = args;
  if (
    (environment !== "production" && environment !== "preview") ||
    !baseUrl
  ) {
    throw new Error(
      "Usage: bun run stripe:subscriptions:reconcile -- <production|preview> <https://deployment-url> [--branch <git-branch>]",
    );
  }

  let branch: string | undefined;
  for (let index = 0; index < options.length; index += 1) {
    if (options[index] !== "--branch" || branch || !options[index + 1]) {
      throw new Error("Use at most one --branch <git-branch> option.");
    }

    branch = options[index + 1];
    index += 1;
  }

  if (branch && environment !== "preview") {
    throw new Error("--branch can only be used with the preview environment.");
  }

  const endpoint = getCronEndpoint(baseUrl);
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV ?? "development",
  };
  delete childEnv.CRON_SECRET;

  const child = spawn(
    "vercel",
    [
      "env",
      "run",
      `--environment=${environment}`,
      ...(branch ? ["--git-branch", branch] : []),
      "--",
      "bun",
      "run",
      "scripts/stripe-subscriptions-reconcile.ts",
      "--request",
      endpoint,
    ],
    {
    env: childEnv,
    stdio: "inherit",
    },
  );
  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 1));
  });
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}

await main();
