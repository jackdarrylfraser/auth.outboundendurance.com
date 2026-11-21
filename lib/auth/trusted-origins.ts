const OUTBOUND_ENDURANCE_HOST = "outboundendurance.com";

export function getTrustedOrigins(baseURL: URL): string[] {
  const trustedOrigins = [baseURL.origin];
  const isOutboundEnduranceHost =
    baseURL.hostname === OUTBOUND_ENDURANCE_HOST ||
    baseURL.hostname.endsWith(`.${OUTBOUND_ENDURANCE_HOST}`);

  if (isOutboundEnduranceHost) {
    trustedOrigins.push(
      "https://*.outboundendurance.com",
      "https://outboundendurance.com",
    );
  } else if (baseURL.protocol === "http:" && baseURL.hostname === "localhost") {
    trustedOrigins.push("http://localhost:*");
  }

  return trustedOrigins;
}
