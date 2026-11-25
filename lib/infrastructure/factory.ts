import type { InfrastructureFactoryDependencies } from "@/lib/infrastructure/types";

export function createInfrastructure<
  Database,
  StripeClient,
  ResendClient,
  AppLogger,
>(
  dependencies: InfrastructureFactoryDependencies<
    Database,
    StripeClient,
    ResendClient,
    AppLogger
  >,
) {
  return {
    db: dependencies.createDb(),
    stripe: dependencies.createStripe(),
    resend: dependencies.createResend(),
    logger: dependencies.createLogger(),
  };
}
