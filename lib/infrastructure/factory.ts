import type { InfrastructureFactoryDependencies } from "@/lib/infrastructure/types";

export function createInfrastructure<
  Database,
  StripeClient,
  ResendClient,
  AppLogger,
  VercelClient,
  Environment,
>(
  dependencies: InfrastructureFactoryDependencies<
    Database,
    StripeClient,
    ResendClient,
    AppLogger,
    VercelClient,
    Environment
  >,
) {
  return {
    env: dependencies.env,
    db: dependencies.createDb(),
    stripe: dependencies.createStripe(),
    resend: dependencies.createResend(),
    logger: dependencies.createLogger(),
    vercel: dependencies.createVercel(),
  };
}
