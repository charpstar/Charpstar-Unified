"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Button, Label } from "@/components/ui/display";
import { Input } from "@/components/ui/inputs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs/select";
import { Badge, Alert, AlertDescription } from "@/components/ui/feedback";
import { toast } from "sonner";
import { useLoading } from "@/contexts/LoadingContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers/dialog";
import { Checkbox } from "@/components/ui/inputs/checkbox";
import { PhoneInput } from "@/components/ui/inputs/phone-input";
import {
  ArrowLeft,
  UserPlus,
  Building,
  Shield,
  User,
  Link,
  CheckCircle,
  Loader2,
  AlertTriangle,
  Users,
  Briefcase,
  X,
} from "lucide-react";

interface UserFormData {
  // Basic info
  email: string;
  firstName: string;
  lastName: string;
  role: "client" | "modeler" | "qa" | "admin";
  password: string;
  confirmPassword: string;

  // Client fields
  clientName: string;
  title: string;
  phoneNumber: string;

  // QA fields
  discordName: string;

  // Modeler fields
  softwareExperience: string[];
  modelTypes: string[];
  dailyHours: number;
  exclusiveWork: boolean;
  country: string;
  portfolioLinks: string[];
}

const SOFTWARE_OPTIONS = [
  "Blender",
  "Maya",
  "3ds Max",
  "Cinema 4D",
  "Houdini",
  "ZBrush",
  "Substance Painter",
  "Substance Designer",
  "Marvelous Designer",
  "SketchUp",
  "Rhino",
  "Fusion 360",
  "SolidWorks",
  "Other",
];

const MODEL_TYPE_OPTIONS = [
  "Furniture",
  "Architecture",
  "Characters",
  "Vehicles",
  "Electronics",
  "Clothing",
  "Jewelry",
  "Food & Beverages",
  "Industrial",
  "Medical",
  "Other",
];

export default function CreateUsersPage() {
  const user = useUser();
  const { startLoading, stopLoading } = useLoading();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [formData, setFormData] = useState<UserFormData>({
    email: "",
    firstName: "",
    lastName: "",
    role: "client",
    password: "",
    confirmPassword: "",
    clientName: "",
    title: "",
    phoneNumber: "",
    discordName: "",
    softwareExperience: [],
    modelTypes: [],
    dailyHours: 8,
    exclusiveWork: false,
    country: "",
    portfolioLinks: [""],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) {
      router.push("/auth");
    }
  }, [user, router]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Basic validation
    if (!formData.email) newErrors.email = "Email is required";
    if (!formData.firstName) newErrors.firstName = "First name is required";
    if (!formData.lastName) newErrors.lastName = "Last name is required";
    if (!formData.password) newErrors.password = "Password is required";
    if (formData.password.length < 8)
      newErrors.password = "Password must be at least 8 characters";
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    // Role-specific validation
    switch (formData.role) {
      case "client":
        if (!formData.clientName)
          newErrors.clientName = "Client name is required";
        if (!formData.title) newErrors.title = "Job title is required";
        if (!formData.phoneNumber)
          newErrors.phoneNumber = "Phone number is required";
        break;
      case "qa":
        if (!formData.phoneNumber)
          newErrors.phoneNumber = "Phone number is required";
        if (!formData.discordName)
          newErrors.discordName = "Discord username is required";
        break;
      case "modeler":
        if (!formData.phoneNumber)
          newErrors.phoneNumber = "Phone number is required";
        if (!formData.country) newErrors.country = "Country is required";
        if (formData.softwareExperience.length === 0) {
          newErrors.softwareExperience =
            "At least one software experience is required";
        }
        if (formData.modelTypes.length === 0) {
          newErrors.modelTypes = "At least one model type is required";
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error("Please fix the errors before submitting");
      return;
    }

    setLoading(true);
    startLoading();

    try {
      // Use the new API endpoint for creating users
      const response = await fetch("/api/users/create-provisional", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create user");
      }

      toast.success(
        data.message ||
          `Successfully created ${formData.role} user: ${formData.email}`
      );

      // Reset form
      setFormData({
        email: "",
        firstName: "",
        lastName: "",
        role: "client",
        password: "",
        confirmPassword: "",
        clientName: "",
        title: "",
        phoneNumber: "",
        discordName: "",
        softwareExperience: [],
        modelTypes: [],
        dailyHours: 8,
        exclusiveWork: false,
        country: "",
        portfolioLinks: [""],
      });

      setShowConfirmDialog(false);
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error.message || "Failed to create user");
    } finally {
      setLoading(false);
      stopLoading();
    }
  };

  const updateFormData = (field: keyof UserFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const addPortfolioLink = () => {
    setFormData((prev) => ({
      ...prev,
      portfolioLinks: [...prev.portfolioLinks, ""],
    }));
  };

  const removePortfolioLink = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      portfolioLinks: prev.portfolioLinks.filter((_, i) => i !== index),
    }));
  };

  const updatePortfolioLink = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      portfolioLinks: prev.portfolioLinks.map((link, i) =>
        i === index ? value : link
      ),
    }));
  };

  const fillMockData = (role: "client" | "modeler" | "qa") => {
    const mockData = {
      client: {
        email: "john.smith@acmecorp.com",
        firstName: "John",
        lastName: "Smith",
        role: "client" as const,
        password: "password123",
        confirmPassword: "password123",
        clientName: "Acme Corporation",
        title: "Creative Director",
        phoneNumber: "+46701234567",
        discordName: "",
        softwareExperience: [],
        modelTypes: [],
        dailyHours: 8,
        exclusiveWork: false,
        country: "",
        portfolioLinks: [""],
      },
      modeler: {
        email: "sarah.johnson@freelance.com",
        firstName: "Sarah",
        lastName: "Johnson",
        role: "modeler" as const,
        password: "password123",
        confirmPassword: "password123",
        clientName: "",
        title: "",
        phoneNumber: "+46701234567",
        discordName: "sarah3d#5678",
        softwareExperience: ["Blender", "Maya", "Substance Painter", "ZBrush"],
        modelTypes: ["Furniture", "Architecture", "Electronics", "Characters"],
        dailyHours: 6,
        exclusiveWork: true,
        country: "Sweden",
        portfolioLinks: [
          "https://artstation.com/sarahjohnson",
          "https://behance.net/sarahjohnson",
          "https://sketchfab.com/sarahjohnson",
        ],
      },
      qa: {
        email: "mike.chen@qualityassurance.com",
        firstName: "Mike",
        lastName: "Chen",
        role: "qa" as const,
        password: "password123",
        confirmPassword: "password123",
        clientName: "",
        title: "",
        phoneNumber: "+46701234567",
        discordName: "mikechen#1234",
        softwareExperience: [],
        modelTypes: [],
        dailyHours: 8,
        exclusiveWork: false,
        country: "",
        portfolioLinks: [""],
      },
    };

    setFormData(mockData[role]);
    setErrors({}); // Clear any existing errors
    toast.success(`Filled with mock ${role} data`);
  };

  const clearForm = () => {
    setFormData({
      email: "",
      firstName: "",
      lastName: "",
      role: "client",
      password: "",
      confirmPassword: "",
      clientName: "",
      title: "",
      phoneNumber: "",
      discordName: "",
      softwareExperience: [],
      modelTypes: [],
      dailyHours: 8,
      exclusiveWork: false,
      country: "",
      portfolioLinks: [""],
    });
    setErrors({});
    toast.success("Form cleared");
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "client":
        return <User className="h-5 w-5" />;
      case "modeler":
        return <Building className="h-5 w-5" />;
      case "qa":
        return <Shield className="h-5 w-5" />;
      case "admin":
        return <Users className="h-5 w-5" />;
      default:
        return <User className="h-5 w-5" />;
    }
  };

  const getRoleDescription = (role: string) => {
    switch (role) {
      case "client":
        return "Clients can browse models, create projects, and manage their assets";
      case "modeler":
        return "3D modelers create and upload 3D models with detailed specifications";
      case "qa":
        return "Quality assurance reviewers validate and approve 3D models";
      case "admin":
        return "Administrators have full system access and user management";
      default:
        return "";
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="h-full bg-gradient-to-br from-background via-background to-muted/20 flex flex-col p-6 overflow-hidden">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/users")}
            className="hover:bg-primary/8 transition-all duration-200 rounded-lg cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Create User</h1>
            <p className="text-muted-foreground">
              Create a new user account without invitation
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Main Form */}
        <div className="flex-1 overflow-y-auto">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                User Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Basic Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                      First Name *
                    </Label>
                    <Input
                      value={formData.firstName}
                      onChange={(e) =>
                        updateFormData("firstName", e.target.value)
                      }
                      placeholder="John"
                      className={errors.firstName ? "border-red-500" : ""}
                    />
                    {errors.firstName && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.firstName}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Last Name *
                    </Label>
                    <Input
                      value={formData.lastName}
                      onChange={(e) =>
                        updateFormData("lastName", e.target.value)
                      }
                      placeholder="Doe"
                      className={errors.lastName ? "border-red-500" : ""}
                    />
                    {errors.lastName && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.lastName}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Email Address *
                  </Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateFormData("email", e.target.value)}
                    placeholder="user@example.com"
                    className={errors.email ? "border-red-500" : ""}
                  />
                  {errors.email && (
                    <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Password *
                    </Label>
                    <Input
                      type="password"
                      value={formData.password}
                      onChange={(e) =>
                        updateFormData("password", e.target.value)
                      }
                      placeholder="••••••••"
                      className={errors.password ? "border-red-500" : ""}
                    />
                    {errors.password && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.password}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Confirm Password *
                    </Label>
                    <Input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        updateFormData("confirmPassword", e.target.value)
                      }
                      placeholder="••••••••"
                      className={errors.confirmPassword ? "border-red-500" : ""}
                    />
                    {errors.confirmPassword && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.confirmPassword}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Role *
                  </Label>
                  <Select
                    value={formData.role}
                    onValueChange={(
                      value: "client" | "modeler" | "qa" | "admin"
                    ) => updateFormData("role", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Client
                        </div>
                      </SelectItem>
                      <SelectItem value="modeler">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          3D Modeler
                        </div>
                      </SelectItem>
                      <SelectItem value="qa">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Quality Assurance
                        </div>
                      </SelectItem>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Administrator
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {getRoleDescription(formData.role)}
                  </p>
                </div>

                {/* Mock Data Buttons */}
                <div className="pt-2">
                  <Label className="text-sm font-medium text-muted-foreground mb-3 block">
                    Quick Fill (Testing)
                  </Label>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fillMockData("client")}
                      className="text-xs"
                    >
                      <User className="h-3 w-3 mr-1" />
                      Fill Client
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fillMockData("modeler")}
                      className="text-xs"
                    >
                      <Building className="h-3 w-3 mr-1" />
                      Fill Modeler
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fillMockData("qa")}
                      className="text-xs"
                    >
                      <Shield className="h-3 w-3 mr-1" />
                      Fill QA
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearForm}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Clear Form
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Click any button to auto-fill the form with sample data for
                    testing
                  </p>
                </div>
              </div>

              {/* Role-specific fields */}
              {formData.role === "client" && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Client Information
                  </h3>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Client/Brand Name *
                    </Label>
                    <Input
                      value={formData.clientName}
                      onChange={(e) =>
                        updateFormData("clientName", e.target.value)
                      }
                      placeholder="Company Name"
                      className={errors.clientName ? "border-red-500" : ""}
                    />
                    {errors.clientName && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.clientName}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Job Title *
                    </Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => updateFormData("title", e.target.value)}
                      placeholder="e.g., Creative Director, Product Manager"
                      className={errors.title ? "border-red-500" : ""}
                    />
                    {errors.title && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.title}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Phone Number *
                    </Label>
                    <PhoneInput
                      value={formData.phoneNumber}
                      onChange={(value) =>
                        updateFormData("phoneNumber", value || "")
                      }
                      defaultCountry="SE"
                      className={errors.phoneNumber ? "border-red-500" : ""}
                      placeholder="(xxx) xxx-xxxx"
                    />
                    {errors.phoneNumber && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.phoneNumber}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {formData.role === "qa" && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    QA Information
                  </h3>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Phone Number *
                    </Label>
                    <PhoneInput
                      value={formData.phoneNumber}
                      onChange={(value) =>
                        updateFormData("phoneNumber", value || "")
                      }
                      defaultCountry="SE"
                      className={errors.phoneNumber ? "border-red-500" : ""}
                      placeholder="(xxx) xxx-xxxx"
                    />
                    {errors.phoneNumber && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.phoneNumber}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Discord Username *
                    </Label>
                    <Input
                      value={formData.discordName}
                      onChange={(e) =>
                        updateFormData("discordName", e.target.value)
                      }
                      placeholder="username#1234"
                      className={errors.discordName ? "border-red-500" : ""}
                    />
                    {errors.discordName && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.discordName}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {formData.role === "modeler" && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    3D Modeler Information
                  </h3>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Phone Number *
                    </Label>
                    <PhoneInput
                      value={formData.phoneNumber}
                      onChange={(value) =>
                        updateFormData("phoneNumber", value || "")
                      }
                      defaultCountry="SE"
                      className={errors.phoneNumber ? "border-red-500" : ""}
                      placeholder="(xxx) xxx-xxxx"
                    />
                    {errors.phoneNumber && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.phoneNumber}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Country *
                    </Label>
                    <Input
                      value={formData.country}
                      onChange={(e) =>
                        updateFormData("country", e.target.value)
                      }
                      placeholder="e.g., United States, Canada, UK"
                      className={errors.country ? "border-red-500" : ""}
                    />
                    {errors.country && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.country}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Software Experience *
                    </Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {SOFTWARE_OPTIONS.map((software) => (
                        <div
                          key={software}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={software}
                            checked={formData.softwareExperience.includes(
                              software
                            )}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                updateFormData("softwareExperience", [
                                  ...formData.softwareExperience,
                                  software,
                                ]);
                              } else {
                                updateFormData(
                                  "softwareExperience",
                                  formData.softwareExperience.filter(
                                    (s) => s !== software
                                  )
                                );
                              }
                            }}
                          />
                          <Label
                            htmlFor={software}
                            className="text-sm cursor-pointer"
                          >
                            {software}
                          </Label>
                        </div>
                      ))}
                    </div>
                    {errors.softwareExperience && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.softwareExperience}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Model Types *
                    </Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {MODEL_TYPE_OPTIONS.map((type) => (
                        <div key={type} className="flex items-center space-x-2">
                          <Checkbox
                            id={type}
                            checked={formData.modelTypes.includes(type)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                updateFormData("modelTypes", [
                                  ...formData.modelTypes,
                                  type,
                                ]);
                              } else {
                                updateFormData(
                                  "modelTypes",
                                  formData.modelTypes.filter((t) => t !== type)
                                );
                              }
                            }}
                          />
                          <Label
                            htmlFor={type}
                            className="text-sm cursor-pointer"
                          >
                            {type}
                          </Label>
                        </div>
                      ))}
                    </div>
                    {errors.modelTypes && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.modelTypes}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                        Daily Hours Available
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        max="24"
                        value={formData.dailyHours}
                        onChange={(e) =>
                          updateFormData(
                            "dailyHours",
                            parseInt(e.target.value) || 8
                          )
                        }
                        placeholder="8"
                      />
                    </div>

                    <div className="flex items-center space-x-2 pt-6">
                      <Checkbox
                        id="exclusive"
                        checked={formData.exclusiveWork}
                        onCheckedChange={(checked) =>
                          updateFormData("exclusiveWork", !!checked)
                        }
                      />
                      <Label htmlFor="exclusive" className="text-sm">
                        Available for exclusive work
                      </Label>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Portfolio Links
                    </Label>
                    {formData.portfolioLinks.map((link, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <Input
                          value={link}
                          onChange={(e) =>
                            updatePortfolioLink(index, e.target.value)
                          }
                          placeholder="https://portfolio.example.com"
                        />
                        {formData.portfolioLinks.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removePortfolioLink(index)}
                            className="px-3"
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addPortfolioLink}
                      className="mt-2"
                    >
                      <Link className="h-4 w-4 mr-2" />
                      Add Portfolio Link
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-6">
                <Button
                  onClick={() => {
                    const isValid = validateForm();
                    if (isValid) {
                      setShowConfirmDialog(true);
                    } else {
                      toast.error("Please fix the errors before submitting");
                    }
                  }}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating User...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Create User
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="w-80 space-y-6">
          {/* Role Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getRoleIcon(formData.role)}
                {formData.role === "modeler"
                  ? "3D Modeler"
                  : formData.role === "qa"
                    ? "Quality Assurance"
                    : formData.role.charAt(0).toUpperCase() +
                      formData.role.slice(1)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {getRoleDescription(formData.role)}
              </p>

              <div className="space-y-2">
                <h4 className="font-medium text-sm">Permissions:</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {formData.role === "client" && (
                    <>
                      <li>• Browse and view 3D models</li>
                      <li>• Create and manage projects</li>
                      <li>• Upload reference images</li>
                      <li>• Request model modifications</li>
                    </>
                  )}
                  {formData.role === "modeler" && (
                    <>
                      <li>• Upload 3D models</li>
                      <li>• Manage portfolio</li>
                      <li>• View assigned projects</li>
                      <li>• Track progress and deadlines</li>
                    </>
                  )}
                  {formData.role === "qa" && (
                    <>
                      <li>• Review submitted models</li>
                      <li>• Approve or reject models</li>
                      <li>• Provide feedback</li>
                      <li>• Quality control dashboard</li>
                    </>
                  )}
                  {formData.role === "admin" && (
                    <>
                      <li>• Full system access</li>
                      <li>• User management</li>
                      <li>• System configuration</li>
                      <li>• Analytics and reporting</li>
                    </>
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <p>Fill in all required fields (marked with *)</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <p>User will receive an email with login credentials</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <p>Role-specific fields will be required based on selection</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Confirm User Creation
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to create a new user with the following
              details?
            </p>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">Name:</span>
                <span>
                  {formData.firstName} {formData.lastName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Email:</span>
                <span>{formData.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Role:</span>
                <Badge variant="outline" className="text-xs">
                  {getRoleIcon(formData.role)}
                  {formData.role === "modeler"
                    ? "3D Modeler"
                    : formData.role === "qa"
                      ? "QA"
                      : formData.role.charAt(0).toUpperCase() +
                        formData.role.slice(1)}
                </Badge>
              </div>
              {formData.role === "client" && formData.clientName && (
                <div className="flex justify-between">
                  <span className="font-medium">Client:</span>
                  <span>{formData.clientName}</span>
                </div>
              )}
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                The user will be created immediately and can log in with the
                provided email and password.
              </AlertDescription>
            </Alert>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Create User
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
