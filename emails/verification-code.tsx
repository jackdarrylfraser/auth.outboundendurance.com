import { Body, Container, Head, Html, Preview, Text } from "@react-email/components";

type VerificationCodeEmailProps = {
  otp: string;
};

export function VerificationCodeEmail({ otp }: VerificationCodeEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Your Outbound Endurance verification code</Preview>
      <Body
        style={{
          backgroundColor: "#f6f9fc",
          fontFamily: "Arial, sans-serif",
          padding: "32px 0",
        }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "8px",
            margin: "0 auto",
            maxWidth: "480px",
            padding: "32px",
          }}
        >
          <Text>Your Outbound Endurance verification code is:</Text>
          <Text
            style={{
              fontSize: "32px",
              fontWeight: "bold",
              letterSpacing: "8px",
              textAlign: "center",
            }}
          >
            {otp}
          </Text>
          <Text>
            This code expires in 10 minutes. If you did not request it, you can
            ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
