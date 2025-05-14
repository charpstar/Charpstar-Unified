"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ROLES } from "@/lib/auth";

const userFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum([
    "Admin",
    "User",
    "Manager",
    "QA",
    "QAmanager",
    "Modeler",
    "Modelermanager",
    "Client",
  ] as const),
});

export type UserFormValues = z.infer<typeof userFormSchema>;

interface UserFormProps {
  onSubmit: (data: UserFormValues) => Promise<void>;
  isLoading: boolean;
  defaultValues?: Partial<UserFormValues>;
  isEdit?: boolean;
}

export function UserForm({
  onSubmit,
  isLoading,
  defaultValues,
  isEdit,
}: UserFormProps) {
  // Use a dynamic schema based on isEdit
  const schema = useMemo(() => {
    return isEdit
      ? z.object({
          name: z.string().min(2, "Name must be at least 2 characters"),
          email: z.string().email("Invalid email address"),
          password: z.string().optional(),
          role: z.enum([
            "Admin",
            "User",
            "Manager",
            "QA",
            "QAmanager",
            "Modeler",
            "Modelermanager",
            "Client",
          ] as const),
        })
      : userFormSchema;
  }, [isEdit]);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name || "",
      email: defaultValues?.email || "",
      password: "",
      role: defaultValues?.role || "User",
    },
  });

  const handleSubmit = async (data: UserFormValues) => {
    try {
      await onSubmit(data);
      if (!isEdit) form.reset();
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="john@example.com" type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {!isEdit && (
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input placeholder="••••••" type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="User">User</SelectItem>
                  <SelectItem value="Manager">Manager</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="QA">QA</SelectItem>
                  <SelectItem value="QAmanager">QA Manager</SelectItem>
                  <SelectItem value="Modeler">Modeler</SelectItem>
                  <SelectItem value="Modelermanager">
                    Modeler Manager
                  </SelectItem>
                  <SelectItem value="Client">Client</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-4 pt-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading
              ? isEdit
                ? "Saving..."
                : "Creating..."
              : isEdit
                ? "Save Changes"
                : "Create User"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
