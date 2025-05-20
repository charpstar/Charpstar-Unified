// components/ui/login-form.tsx

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";

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
      <Card className="overflow-hidden">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-6 md:p-8 w-full" onSubmit={onSubmit}>
            <div className="flex flex-col gap-6">
              {/* Title Section */}
              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold">
                  {type === "login"
                    ? "Welcome back"
                    : type === "signup"
                      ? "Create your account"
                      : "Reset Password"}
                </h1>
                <p className="text-balance text-muted-foreground">
                  {type === "login"
                    ? "Login to your Charpstar account"
                    : type === "signup"
                      ? "Start your journey with Charpstar"
                      : "Enter your email to reset your password"}
                </p>
              </div>
              {/* Show errors */}
              {error && (
                <div className="rounded bg-destructive/20 p-2 text-destructive text-center text-sm">
                  {error}
                </div>
              )}
              {/* Show reset sent message */}
              {type === "reset" && resetSent && (
                <div className="rounded bg-primary/10 p-2 text-primary text-center text-sm">
                  Reset instructions sent! Please check your email.
                </div>
              )}
              {/* Login */}
              {type === "login" && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="m@charpstar.com"
                      value={values.email}
                      onChange={onChange}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center">
                      <Label htmlFor="password">Password</Label>
                      <button
                        type="button"
                        onClick={onSwitchToReset}
                        className="ml-auto text-sm underline-offset-2 hover:underline"
                        tabIndex={0}
                      >
                        Forgot your password?
                      </button>
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
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Logging in..." : "Login"}
                  </Button>
                  <div className="text-center text-sm">
                    Don&apos;t have an account?{" "}
                    <button
                      type="button"
                      className="underline underline-offset-4"
                      onClick={onSwitchToSignup}
                    >
                      Sign up
                    </button>
                  </div>
                </>
              )}
              {/* Signup */}
              {type === "signup" && (
                <>
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
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="m@charpstar.com"
                      value={values.email}
                      onChange={onChange}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      value={values.password}
                      onChange={onChange}
                      required
                    />
                  </div>
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
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Signing up..." : "Sign up"}
                  </Button>
                  <div className="text-center text-sm">
                    Already have an account?{" "}
                    <button
                      type="button"
                      className="underline underline-offset-4"
                      onClick={onSwitchToLogin}
                    >
                      Log in
                    </button>
                  </div>
                </>
              )}
              {/* Reset password */}
              {type === "reset" && !resetSent && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="resetEmail">Email</Label>
                    <Input
                      id="resetEmail"
                      name="resetEmail"
                      type="email"
                      placeholder="your@email.com"
                      value={values.email}
                      onChange={onChange}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Sending..." : "Send Reset Email"}
                  </Button>
                  <div className="text-center text-sm">
                    Back to{" "}
                    <button
                      type="button"
                      className="underline underline-offset-4"
                      onClick={onSwitchToLogin}
                    >
                      Login
                    </button>
                  </div>
                </>
              )}
              {/* Separator */}
              {(type === "login" || type === "signup") && (
                <div className="relative text-center text-sm  after:flex after:items-center after:border-t after:border-border">
                  <span className="relative z-10 bg-background px-2 text-muted-foreground"></span>
                </div>
              )}
            </div>
          </form>
          <div className="relative hidden bg-muted md:block">
            <Image
              src="/images/charpstarGrey.png"
              alt="Charpstar"
              className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
              width={300}
              height={300}
            />
          </div>
        </CardContent>
      </Card>
      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </div>
    </div>
  );
}
