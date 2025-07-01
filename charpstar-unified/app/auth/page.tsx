"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { LoginForm } from "@/components/ui/utilities";
import Image from "next/image";
import { useTheme } from "next-themes";

export default function AuthPage() {
  const router = useRouter();
  const [formType, setFormType] = useState<"login" | "signup" | "reset">(
    "login"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  // State for all forms
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [signupData, setSignupData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [resetData, setResetData] = useState({ email: "" });

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        router.push("/dashboard");
      }
    };
    checkAuth();
  }, [router]);

  // Handlers for input changes
  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoginData({ ...loginData, [e.target.name]: e.target.value });
  };

  const handleSignupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSignupData({ ...signupData, [e.target.name]: e.target.value });
  };

  const handleResetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setResetData({ ...resetData, [e.target.name]: e.target.value });
  };

  // Handler for login form submit
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      console.log("Attempting login for:", loginData.email);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });

      if (error) throw error;

      console.log("Login successful, session data:", data.session);
      console.log("User data:", data.user);

      // Check if session is stored
      const { data: sessionData } = await supabase.auth.getSession();
      console.log("Session after login:", sessionData.session);

      console.log("Redirecting to dashboard...");
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for signup form submit
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (signupData.password !== signupData.confirmPassword) {
      setError("Passwords don't match");
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email: signupData.email,
        password: signupData.password,
        options: { data: { name: signupData.name } },
      });
      if (error) throw error;
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for reset password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      console.log("Sending password reset email to:", resetData.email);

      // Use environment variable for production URL, fallback to window.location.origin
      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const redirectUrl = `${baseUrl}/reset-password`;

      console.log("Using redirect URL:", redirectUrl);

      const { error } = await supabase.auth.resetPasswordForEmail(
        resetData.email,
        {
          redirectTo: redirectUrl,
        }
      );

      if (error) {
        console.error("Password reset error:", error);
        throw error;
      }

      console.log("Password reset email sent successfully");
      setResetSent(true);
    } catch (err: any) {
      console.error("Password reset error:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const { theme, systemTheme } = useTheme();
  const currentTheme = theme === "system" ? systemTheme : theme;
  const isDark = currentTheme === "dark";

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-6 md:p-10 rounded-lg overflow-auto bg-muted">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="h-8 w-[200px] overflow-hidden rounded-md self-center">
          <Image
            src={
              isDark
                ? "/images/charpstarWhite.png"
                : "/images/charpstarGrey.png"
            }
            alt="logo"
            width={200}
            height={200}
            className="object-cover object-center w-full h-full"
          />
        </div>

        <LoginForm
          type={formType}
          values={
            formType === "login"
              ? loginData
              : formType === "signup"
                ? signupData
                : resetData
          }
          onChange={
            formType === "login"
              ? handleLoginChange
              : formType === "signup"
                ? handleSignupChange
                : handleResetChange
          }
          onSubmit={
            formType === "login"
              ? handleLogin
              : formType === "signup"
                ? handleSignup
                : handleResetPassword
          }
          isLoading={isLoading}
          error={error}
          onSwitchToReset={() => {
            setError(null);
            setFormType("reset");
            setResetSent(false);
          }}
          onSwitchToSignup={() => {
            setError(null);
            setFormType("signup");
          }}
          onSwitchToLogin={() => {
            setError(null);
            setFormType("login");
            setResetSent(false);
          }}
          resetSent={resetSent}
        />
      </div>
    </div>
  );
}
