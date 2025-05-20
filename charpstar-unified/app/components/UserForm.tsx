"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Icons } from "@/components/ui/icons";

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
}

export function UserForm({ onSubmit, isLoading, initialData }: UserFormProps) {
  const [formData, setFormData] = useState<UserFormValues>(
    initialData || {
      email: "",
      name: "",
      role: "user",
      password: "",
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  const isEditMode = !!initialData;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="user@example.com"
          value={formData.email}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, email: e.target.value }))
          }
          required
          className="w-full"
          disabled={isLoading || isEditMode}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Full Name</Label>
        <Input
          id="name"
          placeholder="John Doe"
          value={formData.name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          required
          className="w-full"
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <Select
          value={formData.role}
          onValueChange={(value: "admin" | "client" | "user") =>
            setFormData((prev) => ({ ...prev, role: value }))
          }
          disabled={isLoading}
        >
          <SelectTrigger className="w-full cursor-pointer bg-white dark:bg-gray-900">
            <SelectValue placeholder="Select a role" />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-gray-900 cursor-pointer">
            <SelectItem
              className="cursor-pointer bg-white dark:bg-gray-900"
              value="user"
            >
              User
              <span className="text-muted-foreground ml-2 cursor-pointer bg-white dark:bg-gray-900">
                (Basic access)
              </span>
            </SelectItem>
            <SelectItem
              className="cursor-pointer bg-white dark:bg-gray-900"
              value="client"
            >
              Client
              <span className="text-muted-foreground ml-2 cursor-pointer bg-white dark:bg-gray-900">
                (Client features)
              </span>
            </SelectItem>
            <SelectItem
              className="cursor-pointer bg-white dark:bg-gray-900"
              value="admin"
            >
              Admin
              <span className="text-muted-foreground ml-2 cursor-pointer bg-white dark:bg-gray-900">
                (Full access)
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!isEditMode && (
        <div className="space-y-2">
          <Label htmlFor="password">
            Password
            <span className="text-muted-foreground ml-2 text-sm">
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
            className="w-full"
            disabled={isLoading}
          />
        </div>
      )}

      <Button
        type="submit"
        className="w-full cursor-pointer bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800"
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
