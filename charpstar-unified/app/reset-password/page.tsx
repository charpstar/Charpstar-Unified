"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Get the hash fragment from the URL
        const hashFragment = window.location.hash;
        if (hashFragment) {
          // Remove the # and parse the parameters
          const params = new URLSearchParams(hashFragment.substring(1));
          const type = params.get("type");
          const accessToken = params.get("access_token");

          if (type === "recovery" && accessToken) {
            // Set the session using the access token
            const { error } = await supabase.auth.getSession();
            if (error) {
              setError("Invalid or expired recovery link.");
              return;
            }
          }
        } else {
          // Check for query parameters
          const type = searchParams.get("type");
          const code = searchParams.get("code");

          if (type === "recovery" && code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) {
              setError("Invalid or expired recovery link.");
              return;
            }
          }
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
        setError("Failed to process recovery link.");
      } finally {
        setIsInitialized(true);
      }
    };

    initializeAuth();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError(
          "No active session. Please request a new password reset link."
        );
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      setMessage("Password updated successfully! Redirecting to login...");

      // Sign out the user after password reset
      await supabase.auth.signOut();

      setTimeout(() => {
        router.push("/auth");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while initializing
  if (!isInitialized) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center px-4">
        <div className="w-8 h-8 border-4 border-t-blue-600 border-blue-200 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600">Verifying recovery link...</p>
      </div>
    );
  }

  // Show error if no valid session is present
  if (error) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center px-4">
        <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
          <h1 className="text-2xl font-semibold text-red-600 mb-4">
            Invalid Recovery Link
          </h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push("/auth")}
            className={cn(
              "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full"
            )}
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center px-4">
      <div className="w-full max-w-md flex flex-col justify-center items-center space-y-6">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Reset Password
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your new password below.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="w-full">
          <div className="grid gap-4 w-full">
            {message && (
              <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded">
                {message}
              </div>
            )}
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="password">
                New Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                )}
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="confirmPassword">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                )}
                disabled={loading}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <button
              className={cn(
                "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full",
                loading && "opacity-50 cursor-not-allowed"
              )}
              disabled={loading}
              type="submit"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full flex-col items-center justify-center px-4">
          <div className="w-8 h-8 border-4 border-t-blue-600 border-blue-200 rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
