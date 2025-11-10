"use server";

import { fetchMutation } from "convex/nextjs";
import { api } from "@kianax/server/convex/_generated/api";
import { getToken } from "../lib/auth-server";

// Authenticated mutation via server function
export async function updatePassword({
  currentPassword,
  newPassword,
}: {
  currentPassword: string;
  newPassword: string;
}) {
  const token = await getToken();

  await fetchMutation(
    api.users.updateUserPassword,
    { currentPassword, newPassword },
    { token },
  );
}
