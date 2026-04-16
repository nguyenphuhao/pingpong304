import { cookies } from "next/headers";

export const SESSION_COOKIE = "pp_admin";
const SESSION_VALUE = "ok";
const ADMIN_PASSWORD = "123456";

export function verifyPassword(input: string) {
  return input === ADMIN_PASSWORD;
}

export async function isAdmin() {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value === SESSION_VALUE;
}

export async function createSession() {
  const store = await cookies();
  store.set(SESSION_COOKIE, SESSION_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new UnauthorizedError();
}
