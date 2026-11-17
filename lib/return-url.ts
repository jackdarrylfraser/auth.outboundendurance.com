export function getAllowedReturnUrl(
  returnTo: string | null | undefined,
  authUrl: string,
): string | null {
  if (!returnTo?.trim()) {
    return null;
  }

  const authBase = new URL(authUrl);
  const allowedOrigins = new Set([authBase.origin]);
  const isProductionAuthHost =
    authBase.protocol === "https:" &&
    authBase.hostname === "auth.outboundendurance.com";

  try {
    const destination = new URL(returnTo, new URL("/", authBase));
    const isAllowedProductionDomain =
      isProductionAuthHost &&
      destination.protocol === "https:" &&
      !destination.port &&
      (destination.hostname === "outboundendurance.com" ||
        destination.hostname.endsWith(".outboundendurance.com"));
    const isAllowedLocalDevelopmentOrigin =
      authBase.protocol === "http:" &&
      authBase.hostname === "localhost" &&
      destination.protocol === "http:" &&
      destination.hostname === "localhost";

    if (
      !["http:", "https:"].includes(destination.protocol) ||
      destination.username ||
      destination.password ||
      (!allowedOrigins.has(destination.origin) &&
        !isAllowedProductionDomain &&
        !isAllowedLocalDevelopmentOrigin)
    ) {
      return null;
    }

    return destination.href;
  } catch {
    return null;
  }
}
