import "server-only";

export function getInternalFulfillmentSecret() {
  return process.env.INTERNAL_FULFILLMENT_SECRET?.trim() || "";
}

export function isValidInternalFulfillmentRequest(request: Request) {
  const expectedSecret = getInternalFulfillmentSecret();
  const secret = request.headers.get("x-internal-fulfillment-secret")?.trim() || "";
  return Boolean(expectedSecret) && secret === expectedSecret;
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
