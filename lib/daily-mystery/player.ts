import { cookies } from "next/headers";
import { randomUUID } from "crypto";

export const MYSTERY_PLAYER_COOKIE = "mystery_player_id";

export async function getOrCreatePlayerId() {
  const cookieStore = await cookies();
  const existing = cookieStore.get(MYSTERY_PLAYER_COOKIE)?.value;
  if (existing) {
    return existing;
  }

  const playerId = randomUUID();
  cookieStore.set(MYSTERY_PLAYER_COOKIE, playerId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return playerId;
}

export async function readPlayerId() {
  const cookieStore = await cookies();
  return cookieStore.get(MYSTERY_PLAYER_COOKIE)?.value ?? null;
}
