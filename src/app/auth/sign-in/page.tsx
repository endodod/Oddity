"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInWithEmail } from "./actions";
import { GoogleSignInButton } from "../google-button";

export default function SignInPage() {
  const [state, formAction, isPending] = useActionState(signInWithEmail, null);

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-2xl font-bold mb-6">Sign in</h1>
      <GoogleSignInButton />
      <div className="my-4 flex items-center gap-3 text-xs opacity-50">
        <div className="h-px flex-1 bg-white/10" />
        or sign in with email
        <div className="h-px flex-1 bg-white/10" />
      </div>
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm opacity-70">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="rounded-md bg-white/5 px-3 py-2 outline outline-1 outline-white/10 focus:outline-white/30"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm opacity-70">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="rounded-md bg-white/5 px-3 py-2 outline outline-1 outline-white/10 focus:outline-white/30"
          />
        </div>
        {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="mt-2 rounded-md bg-indigo-500 px-3 py-2 font-semibold hover:bg-indigo-400 disabled:opacity-50"
        >
          {isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-sm opacity-70">
        Need an account?{" "}
        <Link href="/auth/sign-up" className="text-indigo-400 hover:underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
