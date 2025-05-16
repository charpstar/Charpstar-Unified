"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  // Password reset state
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
        return;
      }

      // Redirect to dashboard or home page on success
      router.push("/dashboard");
    } catch (err) {
      setError("An error occurred during sign in");
    } finally {
      setIsLoading(false);
    }
  }
  async function handlePasswordReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResetLoading(true);
    setResetMessage(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        console.error("Reset error:", error);
        throw error;
      }
      setResetMessage("Password reset email sent! Check your inbox.");
    } catch (err: any) {
      console.error("Reset catch error:", err);
      setResetMessage(err.message || "Failed to send reset email");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center px-4">
      <div className="w-full max-w-[1200px] flex flex-col justify-center items-center space-y-6">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Welcome to Charpstar
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your credentials to sign in to your account
          </p>
        </div>

        <div className="w-1/2">
          {showReset ? (
            <form onSubmit={handlePasswordReset} className="w-full">
              <div className="grid gap-4 w-full">
                {resetMessage && (
                  <div className="p-3 bg-primary/80 text-primary-foreground rounded">
                    {resetMessage}
                  </div>
                )}
                <div className="grid gap-2">
                  <label
                    className="text-sm font-medium leading-none"
                    htmlFor="resetEmail"
                  >
                    Enter your email to reset password
                  </label>
                  <input
                    id="resetEmail"
                    name="resetEmail"
                    type="email"
                    className={cn(
                      "flex h-10 w-full rounded-md border border-primary px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    )}
                    placeholder="name@example.com"
                    disabled={resetLoading}
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                  />
                </div>
                <button
                  className={cn(
                    "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full",
                    resetLoading && "opacity-50 cursor-not-allowed"
                  )}
                  disabled={resetLoading}
                  type="submit"
                >
                  {resetLoading ? "Sending..." : "Send Reset Email"}
                </button>
                <button
                  type="button"
                  className="text-sm text-gray-500 underline mt-2"
                  onClick={() => {
                    setShowReset(false);
                    setResetMessage(null);
                  }}
                >
                  Back to login
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={onSubmit} className="w-full">
              <div className="grid gap-4 w-full">
                {error && (
                  <div className="p-3 bg-primary/80 text-primary-foreground rounded">
                    {error}
                  </div>
                )}
                <div className="grid gap-2">
                  <label
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    htmlFor="email"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className={cn(
                      "flex h-10 w-full rounded-md border border-primary px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    )}
                    placeholder="name@example.com"
                    disabled={isLoading}
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <label
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    htmlFor="password"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    className={cn(
                      "flex h-10 w-full rounded-md border border-primary px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    )}
                    disabled={isLoading}
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                </div>
                <button
                  className={cn(
                    "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full",
                    isLoading && "opacity-50 cursor-not-allowed"
                  )}
                  disabled={isLoading}
                  type="submit"
                >
                  {isLoading && (
                    <svg
                      className="mr-2 h-4 w-4 animate-spin text-primary"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  )}
                  Sign In
                </button>
                <button
                  type="button"
                  className="text-sm text-gray-500 underline mt-2"
                  onClick={() => setShowReset(true)}
                >
                  Forgot password?
                </button>
                <div className="mt-4 text-center text-sm">
                  Don't have an account?{" "}
                  <Link
                    href="/signup"
                    className="text-primary underline hover:text-primary/90"
                  >
                    Sign up
                  </Link>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
