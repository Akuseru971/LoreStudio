import { NextResponse } from "next/server";

type RouteError = {
  name?: string;
  code?: string;
  message?: string;
  cause?: unknown;
};

export function logRouteStart(routeName: string, request: Request) {
  const url = new URL(request.url);
  console.log("[ROUTE_START]", routeName, {
    method: request.method,
    path: url.pathname,
    at: Date.now(),
  });
}

export function logRouteSuccess(routeName: string) {
  console.log("[ROUTE_SUCCESS]", routeName, Date.now());
}

export function logRouteError(routeName: string, error: unknown) {
  console.error("[ROUTE_ERROR]", routeName, error);
}

export function isClientConnectionClosedError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  if (typeof error === "string") {
    return (
      error.includes("terminated") ||
      error.includes("other side closed") ||
      error.includes("failed to pipe")
    );
  }

  if (typeof error !== "object") {
    return false;
  }

  const routeError = error as RouteError;
  if (routeError.name === "AbortError") {
    return true;
  }

  if (routeError.code === "UND_ERR_SOCKET") {
    return true;
  }

  const message = String(routeError.message || "");
  if (
    message.includes("terminated") ||
    message.includes("other side closed") ||
    message.includes("failed to pipe")
  ) {
    return true;
  }

  if (routeError.cause) {
    return isClientConnectionClosedError(routeError.cause);
  }

  return false;
}

export function isRequestAborted(request: Request) {
  return request.signal.aborted;
}

export function logClientConnectionClosed(routeName: string) {
  console.warn("[CLIENT_CONNECTION_CLOSED]", routeName, Date.now());
}

/** Use when the client disconnected before a response could be sent. */
export function clientConnectionClosedResponse() {
  return new Response(null, { status: 499 });
}

export function respondToRouteError(
  routeName: string,
  error: unknown,
  fallbackMessage = "Internal server error",
) {
  if (isClientConnectionClosedError(error)) {
    logClientConnectionClosed(routeName);
    return clientConnectionClosedResponse();
  }

  logRouteError(routeName, error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
