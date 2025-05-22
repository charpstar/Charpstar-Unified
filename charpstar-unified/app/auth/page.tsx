"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { LoginForm } from "@/components/ui/login-form";

import Image from "next/image";
import { getUserWithMetadata } from "@/supabase/getUser";
export default function AuthPage() {
  const router = useRouter();
  const [formType, setFormType] = useState<"login" | "signup" | "reset">(
    "login"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [user, setUser] = useState<any>(null);

  // State for all forms
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [signupData, setSignupData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [resetData, setResetData] = useState({ email: "" });

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
      const { error } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });
      if (error) throw error;
      const userWithMeta = await getUserWithMetadata(supabase);
      setUser(userWithMeta);

      router.push("/dashboard");
    } catch (err: any) {
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
      // Sign up via API if needed, otherwise directly with Supabase
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
      const { error } = await supabase.auth.resetPasswordForEmail(
        resetData.email,
        {
          redirectTo: `${window.location.origin}/reset-password?type=recovery`,
        }
      );
      if (error) throw error;
      setResetSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10 rounded-lg">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Image
          src="/images/charpstarGrey.png"
          alt="logo"
          width={300}
          height={300}
          className="rounded-md self-center   "
        />

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
