import { Resend } from "resend";
import { env } from "./env";

let resendClient: Resend | undefined;

export function getResendClient(): Resend {
  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }

  return resendClient;
}
