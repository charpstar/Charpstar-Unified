"use client";

import { useState } from "react";
import { Label } from "@/components/ui/display";
import { Input } from "@/components/ui/inputs";
import { Button } from "@/components/ui/display";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import { Icons } from "@/app/components/ui/icons";

export interface UserFormValues {
  email: string;
  name: string;
  role: "admin" | "client" | "user";
  password: string;
}

interface UserFormProps {
  onSubmit: (data: UserFormValues) => Promise<void>;
  isLoading?: boolean;
  initialData?: UserFormValues;
  error?: string | null;
}

export function UserForm({
  onSubmit,
  isLoading,
  initialData,
  error,
}: UserFormProps) {
  const [formData, setFormData] = useState<UserFormValues>(
    initialData || {
      email: "",
      name: "",
      role: "user",
      password: "",
    }
  );

  const isEditMode = !!initialData;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="  bg-background  p-6 space-y-10  ">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email" className="text-sm text-foreground">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="user@example.com"
          value={formData.email}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, email: e.target.value }))
          }
          required
          className="w-full rounded-[var(--radius)] border border-input bg-background text-foreground focus:ring-2 focus:ring-ring transition"
          disabled={isLoading || isEditMode}
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="name" className="text-sm text-foreground">
          Full Name
        </Label>
        <Input
          id="name"
          placeholder="John Doe"
          value={formData.name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          required
          className="w-full rounded-[var(--radius)] border border-input bg-background text-foreground focus:ring-2 focus:ring-ring transition"
          disabled={isLoading}
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="role" className="text-sm text-foreground">
          Role
        </Label>
        <Select
          value={formData.role}
          onValueChange={(value: "admin" | "client" | "user") =>
            setFormData((prev) => ({ ...prev, role: value }))
          }
          disabled={isLoading}
        >
          <SelectTrigger className="w-full bg-muted text-foreground rounded-[var(--radius)] border border-input focus:ring-2 focus:ring-ring transition cursor-pointer">
            <SelectValue placeholder="Select a role" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground rounded-[var(--radius)] border border-border shadow-md">
            <SelectItem
              value="user"
              className="cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-[var(--radius)]"
            >
              User{" "}
              <span className="text-muted-foreground ml-2">(Basic access)</span>
            </SelectItem>
            <SelectItem
              value="client"
              className="cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-[var(--radius)]"
            >
              Client{" "}
              <span className="text-muted-foreground ml-2">
                (Client features)
              </span>
            </SelectItem>
            <SelectItem
              value="admin"
              className="cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-[var(--radius)]"
            >
              Admin{" "}
              <span className="text-muted-foreground ml-2">(Full access)</span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!isEditMode && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="password" className="text-sm text-foreground">
            Password
            <span className="text-muted-foreground ml-2 text-xs">
              (Minimum 8 characters)
            </span>
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={formData.password}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, password: e.target.value }))
            }
            required={!isEditMode}
            minLength={8}
            className="w-full rounded-[var(--radius)] border border-input bg-background text-foreground focus:ring-2 focus:ring-ring transition"
            disabled={isLoading}
            autoComplete="new-password"
          />
        </div>
      )}

      {error && (
        <div className="rounded-[var(--radius)] bg-destructive/10 text-destructive text-sm text-center px-3 py-2">
          {error}
        </div>
      )}

      <Button
        type="submit"
        className="w-full rounded-[var(--radius)] bg-primary text-primary-foreground font-medium shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring transition flex items-center justify-center gap-2"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
            {isEditMode ? "Updating..." : "Creating..."}
          </>
        ) : isEditMode ? (
          "Update User"
        ) : (
          "Create User"
        )}
      </Button>
    </form>
  );
}
