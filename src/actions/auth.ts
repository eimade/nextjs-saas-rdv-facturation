"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { runAction, type ActionResult } from "@/actions/result";
import { acceptInvitation, signupCabinet } from "@/server/tenancy/tenancy-service";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

async function credentialsSignIn(email: string, password: string, redirectTo: string): Promise<ActionResult> {
  try {
    await signIn("credentials", { email, password, redirectTo });
    return { ok: true };
  } catch (error) {
    // En cas de succès, signIn lève une redirection Next.js qui doit être propagée.
    if (error instanceof AuthError) return { ok: false, error: "invalidCredentials" };
    throw error;
  }
}

export async function loginAction(locale: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return credentialsSignIn(str(fd, "email"), str(fd, "password"), `/${locale}/app`);
}

export async function signupAction(locale: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const input = {
    cabinetName: str(fd, "cabinetName"),
    slug: str(fd, "slug"),
    ownerName: str(fd, "ownerName"),
    email: str(fd, "email"),
    password: str(fd, "password"),
  };
  const result = await runAction(() => signupCabinet(input));
  if (!result.ok) return result;
  return credentialsSignIn(input.email, input.password, `/${locale}/app/services`);
}

export async function acceptInviteAction(
  locale: string,
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const input = { token: str(fd, "token"), name: str(fd, "name"), password: str(fd, "password") };
  const result = await runAction(() => acceptInvitation(input));
  if (!result.ok) return result;
  if (!result.data) return { ok: false, error: "unexpected" };
  return credentialsSignIn(result.data.email, input.password, `/${locale}/app`);
}

export async function logoutAction(locale: string): Promise<void> {
  await signOut({ redirectTo: `/${locale}` });
}
