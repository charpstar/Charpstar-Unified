"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/feedback";
import { CheckCircle } from "lucide-react";

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
      const supabase = createClient();

      try {
        // Get the hash fragment from the URL (old format)
        const hashFragment = window.location.hash;

        console.log("🔐 Password Reset Debug:", {
          hash: hashFragment,
          search: window.location.search,
          code: searchParams.get("code"),
          type: searchParams.get("type"),
          fullUrl: window.location.href,
        });

        if (hashFragment) {
          // Remove the # and parse the parameters
          const params = new URLSearchParams(hashFragment.substring(1));
          const type = params.get("type");
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");

          console.log("📧 Hash-based recovery:", {
            type,
            hasAccessToken: !!accessToken,
          });

          if (type === "recovery" && accessToken) {
            // Set the session using the access token
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || "",
            });

            if (error) {
              console.error("❌ Error setting session:", error);
              setError(
                `Invalid or expired recovery link. Error: ${error.message}`
              );
              return;
            }

            console.log("✅ Session set successfully via hash");
          }
        } else {
          // Check for query parameters (new format - PKCE flow)
          const code = searchParams.get("code");
          const type = searchParams.get("type");

          console.log("📧 Query-based recovery:", {
            code: code?.substring(0, 10) + "...",
            type,
          });

          if (code) {
            // New Supabase password reset format - exchange code for session
            console.log("🔄 Attempting to exchange code for session...");
            console.log("📋 Code details:", {
              codeLength: code.length,
              codePreview: code.substring(0, 30) + "...",
              fullUrl: window.location.href,
            });

            try {
              const { data, error } =
                await supabase.auth.exchangeCodeForSession(code);

              if (error) {
                console.error("❌ Error exchanging code for session:", {
                  error,
                  message: error.message,
                  status: error.status,
                  name: error.name,
                  code: code.substring(0, 20) + "...",
                });

                // Provide specific error messages based on error type
                let userMessage = error.message;
                if (error.message.includes("code verifier")) {
                  userMessage =
                    "Invalid reset link. The email template may be misconfigured. Please contact support or request a new password reset link.";
                } else if (
                  error.message.toLowerCase().includes("expired") ||
                  error.message.includes("pkce")
                ) {
                  userMessage =
                    "This reset link has expired. Password reset links are only valid for a short time. Please request a new password reset.";
                } else if (
                  error.message.toLowerCase().includes("invalid") ||
                  error.message.includes("otp") ||
                  error.message.includes("already been used")
                ) {
                  userMessage =
                    "This reset link is invalid or has already been used. Each link can only be used once. Please request a new password reset.";
                } else if (error.message.toLowerCase().includes("not found")) {
                  userMessage =
                    "Reset link not found. It may have been used already or is invalid. Please request a new password reset.";
                }

                setError(userMessage);
                return;
              }

              console.log("✅ Code exchanged successfully:", {
                hasSession: !!data.session,
                userId: data.session?.user?.id,
                userEmail: data.session?.user?.email,
              });
            } catch (exchangeError) {
              console.error(
                "❌ Exception during code exchange:",
                exchangeError
              );
              setError(
                `Failed to process reset link: ${exchangeError instanceof Error ? exchangeError.message : "Unknown error"}. Please request a new password reset.`
              );
              return;
            }
          } else if (type === "recovery") {
            // Has type but no code - possibly legacy format issue
            console.warn(" Has type=recovery but no code parameter");
            setError(
              "Invalid recovery link format. Missing code parameter. Please request a new password reset link."
            );
            return;
          } else {
            console.error("❌ No code or hash found in URL");
            setError(
              "Invalid recovery link format. Please click the link from your email directly without modifying it."
            );
            return;
          }
        }

        // Check if we have a valid session after initialization
        const {
          data: { session },
        } = await supabase.auth.getSession();

        console.log("🔍 Session check:", { hasSession: !!session });

        if (!session) {
          setError(
            "No active session. Please request a new password reset link."
          );
        } else {
          console.log("✅ Valid session established");
        }
      } catch (err) {
        console.error("❌ Auth initialization error:", err);
        setError(
          `Failed to process recovery link: ${err instanceof Error ? err.message : "Unknown error"}`
        );
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
    const supabase = createClient();

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        console.error("No session found during password reset");
        setError(
          "No active session. Please request a new password reset link."
        );
        return;
      }

      console.log("🔄 Updating password for user:", session.user.id);

      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        console.error("❌ Password update error:", error);
        throw error;
      }

      console.log("✅ Password updated successfully");
      setMessage("Password updated successfully! Redirecting to login...");

      // Sign out the user after password reset
      await supabase.auth.signOut();

      setTimeout(() => {
        router.push("/auth");
      }, 2000);
    } catch (err: any) {
      console.error("❌ Password reset error:", err);
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
    const hasCode = !!searchParams.get("code");
    const hasType = !!searchParams.get("type");

    return (
      <div className="flex h-screen w-full flex-col items-center justify-center px-4 bg-muted">
        <div className="w-full max-w-md p-6 bg-white dark:bg-background rounded-lg shadow-md border">
          <h1 className="text-2xl font-semibold text-destructive mb-4">
            Invalid Recovery Link
          </h1>
          <p className="text-muted-foreground mb-4">{error}</p>

          {/* Troubleshooting steps */}
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
              Troubleshooting Steps:
            </p>
            <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
              <li>
                Make sure you&apos;re using the latest link from your email
              </li>
              <li>Reset links expire after a certain time period</li>
              <li>Only one reset link can be active at a time</li>
              <li>Check if the link was copied completely from your email</li>
              {!hasType && hasCode && (
                <li className="text-amber-700 dark:text-amber-400 font-medium">
                  Missing &apos;type=recovery&apos; parameter - the email
                  template may need updating
                </li>
              )}
            </ul>
          </div>

          {/* Debug information */}
          <details className="mt-4">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
              Show debug information
            </summary>
            <div className="mt-2 p-3 bg-muted rounded text-xs font-mono space-y-1">
              <p>
                <strong>URL:</strong> {window.location.href}
              </p>
              <p>
                <strong>Hash:</strong> {window.location.hash || "(none)"}
              </p>
              <p>
                <strong>Search:</strong> {window.location.search || "(none)"}
              </p>
              <p>
                <strong>Type param:</strong>{" "}
                {searchParams.get("type") || "(none)"}
              </p>
              <p>
                <strong>Code param:</strong>{" "}
                {searchParams.get("code")?.substring(0, 20) + "..." || "(none)"}
              </p>
            </div>
          </details>

          <div className="flex gap-2 mt-6">
            <button
              onClick={() => router.push("/auth")}
              className={cn(
                "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 flex-1"
              )}
            >
              Return to Login
            </button>
          </div>
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
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>{message}</AlertDescription>
              </Alert>
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
