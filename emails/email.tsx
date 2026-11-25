import { VerificationCodeEmail } from "@/emails/verification-code";
import { infrastructure } from "@/lib/infrastructure/server";

export async function sendVerificationCode(email: string, otp: string) {
  const { error } = await infrastructure.resend.emails.send({
    from: infrastructure.env.RESEND_FROM_EMAIL,
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
