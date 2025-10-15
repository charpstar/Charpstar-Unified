"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    const verifyLink = async () => {
      const supabase = createClient();

      try {
        // First check for hash-based tokens (ConfirmationURL format)
        const hashParams = new URLSearchParams(
          window.location.hash.substring(1)
        );
        const hashAccessToken = hashParams.get("access_token");
        const hashRefreshToken = hashParams.get("refresh_token");
        const hashType = hashParams.get("type");

        console.log("Recovery check:", {
          hasHash: !!window.location.hash,
          hashType,
          hasHashAccessToken: !!hashAccessToken,
          queryCode: searchParams.get("code"),
          queryType: searchParams.get("type"),
        });

        if (hashType === "recovery" && hashAccessToken) {
          // Hash-based recovery (from {{ .ConfirmationURL }})
          const { error } = await supabase.auth.setSession({
            access_token: hashAccessToken,
            refresh_token: hashRefreshToken || "",
          });

          if (error) {
            console.error("Session error:", error);
            setError(`Error: ${error.message}`);
          } else {
            console.log("Session established from hash");
          }
        } else {
          // Check for query param based token (from {{ .TokenHash }})
          const token = searchParams.get("code");
          const type = searchParams.get("type");

          if (token && type === "recovery") {
            const { error } = await supabase.auth.verifyOtp({
              token_hash: token,
              type: "recovery",
            });

            if (error) {
              console.error("OTP verification error:", error);
              setError(`Error: ${error.message}`);
            } else {
              console.log("Session established from OTP");
            }
          } else {
            // Check if there's already a valid session
            const {
              data: { session },
            } = await supabase.auth.getSession();

            if (!session) {
              setError("Invalid reset link. Please request a new one.");
            } else {
              console.log("Valid session found");
            }
          }
        }
      } catch (err) {
        console.error("Verify error:", err);
        setError(
          `Failed: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      } finally {
        setVerifying(false);
      }
    };

    verifyLink();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setSuccess(true);
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

  if (verifying) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-t-blue-600 border-blue-200 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-sm text-muted-foreground">
            Verifying link...
          </p>
        </div>
      </div>
    );
  }

  if (error && !success) {
    return (
      <div className="flex h-screen items-center justify-center px-4">
        <div className="w-full max-w-md p-6 bg-background rounded-lg border">
          <h1 className="text-xl font-semibold text-destructive mb-4">
            Reset Link Error
          </h1>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <button
            onClick={() => router.push("/auth")}
            className="w-full h-10 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-green-600 mb-2">
            Success!
          </h2>
          <p className="text-sm text-muted-foreground">
            Redirecting to login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Reset Password</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Enter your new password
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              New Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
              className="w-full h-10 px-3 rounded-md border border-input bg-background"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              required
              className="w-full h-10 px-3 rounded-md border border-input bg-background"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
