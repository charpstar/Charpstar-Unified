// components/ui/login-form.tsx

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";

type LoginFormProps = {
  type: "login" | "signup" | "reset";
  values: any;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading?: boolean;
  error?: string | null;
  onSwitchToReset?: () => void;
  onSwitchToSignup?: () => void;
  onSwitchToLogin?: () => void;
  resetSent?: boolean;
  className?: string;
};

export function LoginForm(props: LoginFormProps) {
  const {
    type,
    values,
    onChange,
    onSubmit,
    isLoading,
    error,
    onSwitchToReset,
    onSwitchToSignup,
    onSwitchToLogin,
    resetSent,
    className,
    ...rest
  } = props;

  return (
    <div className={cn("flex flex-col gap-6", className)} {...rest}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-bold text-primary ">
            {type === "login"
              ? "Welcome back"
              : type === "signup"
                ? "Create your account"
                : "Reset Password"}
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            {type === "login" || type === "signup"
              ? "Login with your email and password"
              : "Enter your email to reset your password"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Show errors */}
          {error && (
            <div className="mb-6 rounded bg-destructive/20 p-2 text-destructive text-center text-sm">
              {error}
            </div>
          )}
          {/* Show reset sent message */}
          {type === "reset" && resetSent && (
            <div className="mb-6 rounded bg-primary/10 p-2 text-primary text-center text-sm">
              Reset instructions sent! Please check your email.
            </div>
          )}
          <form onSubmit={onSubmit}>
            <div className="grid gap-6">
              <div className="grid gap-6">
                {type === "signup" && (
                  <div className="grid gap-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      value={values.name}
                      onChange={onChange}
                      required
                    />
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="m@example.com"
                    value={values.email}
                    onChange={onChange}
                    required
                  />
                </div>
                {(type === "login" || type === "signup") && (
                  <div className="grid gap-2">
                    <div className="flex items-center">
                      <Label htmlFor="password">Password</Label>
                      {type === "login" && (
                        <button
                          type="button"
                          onClick={onSwitchToReset}
                          className="ml-auto text-sm underline-offset-4 hover:underline"
                        >
                          Forgot your password?
                        </button>
                      )}
                    </div>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      value={values.password}
                      onChange={onChange}
                      required
                    />
                  </div>
                )}
                {type === "signup" && (
                  <div className="grid gap-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      value={values.confirmPassword}
                      onChange={onChange}
                      required
                    />
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading
                    ? type === "login"
                      ? "Logging in..."
                      : type === "signup"
                        ? "Signing up..."
                        : "Sending..."
                    : type === "login"
                      ? "Login"
                      : type === "signup"
                        ? "Sign up"
                        : "Send Reset Email"}
                </Button>
              </div>
              <div className="text-center text-sm">
                {type === "login" ? (
                  <>
                    Don&apos;t have an account?{" "}
                    <button
                      type="button"
                      className="underline underline-offset-4"
                      onClick={onSwitchToSignup}
                    >
                      Sign up
                    </button>
                  </>
                ) : type === "signup" ? (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      className="underline underline-offset-4"
                      onClick={onSwitchToLogin}
                    >
                      Log in
                    </button>
                  </>
                ) : (
                  <>
                    Back to{" "}
                    <button
                      type="button"
                      className="underline underline-offset-4"
                      onClick={onSwitchToLogin}
                    >
                      Login
                    </button>
                  </>
                )}
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary">
        By clicking continue, you agree to our{" "}
        <Link href="/terms-of-service">Terms of Service</Link> and{" "}
        <Link href="/privacy-policy">Privacy Policy</Link>.
      </div>
    </div>
  );
}
