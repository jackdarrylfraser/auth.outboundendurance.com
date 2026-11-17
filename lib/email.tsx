import { VerificationCodeEmail } from "../emails/verification-code";
import { env } from "./env";
import { getResendClient } from "./resend";

export async function sendVerificationCode(email: string, otp: string) {
  const { error } = await getResendClient().emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: email,
    subject: "Your Outbound Endurance verification code",
    react: <VerificationCodeEmail otp={otp} />,
  });

  if (error) {
    throw new Error(
      `Resend failed to send a verification email: ${error.message}`,
    );
  }
}
