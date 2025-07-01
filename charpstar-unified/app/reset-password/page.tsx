"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";

export default function ResetPasswordPage() {
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
        console.log("Initializing auth for password reset...");

        // Get the hash fragment from the URL
        const hashFragment = window.location.hash;
        console.log("Hash fragment:", hashFragment);

        if (hashFragment) {
          // Remove the # and parse the parameters
          const params = new URLSearchParams(hashFragment.substring(1));
          const type = params.get("type");
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");

          console.log(
            "Hash params - type:",
            type,
            "accessToken:",
            accessToken ? "present" : "missing"
          );

          if (type === "recovery" && accessToken) {
            // Set the session using the access token
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || "",
            });

            console.log("Session set result:", { data, error });

            if (error) {
              console.error("Error setting session:", error);
              setError("Invalid or expired recovery link.");
              return;
            }
          }
        } else {
          // Check for query parameters
          const type = searchParams.get("type");
          const code = searchParams.get("code");

          console.log(
            "Query params - type:",
            type,
            "code:",
            code ? "present" : "missing"
          );

          if (type === "recovery" && code) {
            const { data, error } =
              await supabase.auth.exchangeCodeForSession(code);
            console.log("Code exchange result:", { data, error });

            if (error) {
              console.error("Error exchanging code for session:", error);
              setError("Invalid or expired recovery link.");
              return;
            }
          }
        }

        // Check if we have a valid session after initialization
        const {
          data: { session },
        } = await supabase.auth.getSession();
        console.log("Final session check:", session ? "valid" : "invalid");

        if (!session) {
          setError(
            "No active session. Please request a new password reset link."
          );
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
      console.log("Submitting password reset form...");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      console.log("Current session:", session ? "valid" : "invalid");

      if (!session) {
        console.error("No session found during password reset");
        setError(
          "No active session. Please request a new password reset link."
        );
        return;
      }

      console.log("Updating user password...");
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        console.error("Password update error:", error);
        throw error;
      }

      console.log("Password updated successfully");
      setMessage("Password updated successfully! Redirecting to login...");

      // Sign out the user after password reset
      await supabase.auth.signOut();

      setTimeout(() => {
        router.push("/auth");
      }, 2000);
    } catch (err: any) {
      console.error("Password reset error:", err);
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

          {/* Debug information */}
          <div className="mt-4 p-3 bg-gray-100 rounded text-xs">
            <p>
              <strong>Debug Info:</strong>
            </p>
            <p>URL: {window.location.href}</p>
            <p>Hash: {window.location.hash}</p>
            <p>Search: {window.location.search}</p>
            <p>Type param: {searchParams.get("type")}</p>
            <p>Code param: {searchParams.get("code")}</p>
          </div>

          <button
            onClick={() => router.push("/auth")}
            className={cn(
              "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full mt-4"
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
