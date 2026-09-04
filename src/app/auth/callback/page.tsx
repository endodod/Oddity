import { redirect } from "next/navigation";

// By the time a request reaches this page, proxy.ts has already exchanged the OAuth
// verifier for a real session cookie — this page just bounces back to the app.
export default function AuthCallbackPage() {
  redirect("/");
}
