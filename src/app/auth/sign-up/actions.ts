"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";

export async function signUpWithEmail(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const { error } = await auth.signUp.email({
    email: formData.get("email") as string,
    name: formData.get("name") as string,
    password: formData.get("password") as string,
  });

  if (error) {
    return { error: error.message || "Failed to create account." };
  }

  redirect("/");
}
