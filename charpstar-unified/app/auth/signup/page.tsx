"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { useLoading } from "@/contexts/LoadingContext";
import { Button } from "@/components/ui/display";
import { Input } from "@/components/ui/inputs";
import { Card } from "@/components/ui/containers";
import { Badge } from "@/components/ui/feedback";
import {
  UserPlus,
  CheckCircle,
  AlertCircle,
  Loader2,
  Mail,
  Building,
  Shield,
} from "lucide-react";
import { useToast } from "@/components/ui/utilities";
import { createClient } from "@/utils/supabase/client";

interface InvitationData {
  id: string;
  email: string;
  client_name: string;
  role: string;
  status: string;
  expires_at: string;
}

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useUser();
  const { toast } = useToast();
  const { startLoading } = useLoading();

  const [loading, setLoading] = useState(true);
  const [invitationData, setInvitationData] = useState<InvitationData | null>(
    null
  );
  const [signupLoading, setSignupLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    // client fields
    title: "",
    phoneNumber: "",
    // QA fields
    discordName: "",
    // Modeler fields
    softwareExperience: [] as string[],
    modelTypes: [] as string[],
    dailyHours: 8,
    exclusiveWork: false,
    portfolioLinks: [] as string[],
    country: "",
  });

  const token = searchParams.get("token");

  useEffect(() => {
    if (user) {
      // User is already logged in, redirect to dashboard

      router.push("/dashboard");
      return;
    }

    if (!token) {
      setLoading(false);
      return;
    }

    // Validate invitation token

    validateInvitation();
  }, [token, user, router]);

  const validateInvitation = async () => {
    try {
      const response = await fetch("/api/auth/validate-invitation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (response.ok) {
        setInvitationData(data.invitation);
        setFormData((prev) => ({ ...prev, email: data.invitation.email }));
      } else {
        console.error("Invitation validation failed:", data);
        toast({
          title: "Invalid Invitation",
          description:
            data.error || "This invitation link is invalid or has expired.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error validating invitation:", error);
      toast({
        title: "Error",
        description: "Failed to validate invitation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const validateRoleSpecificFields = () => {
    const role = invitationData?.role;

    switch (role) {
      case "client":
        if (!formData.title.trim()) {
          toast({
            title: "Missing Information",
            description: "Please enter your job title.",
            variant: "destructive",
          });
          return false;
        }
        if (!formData.phoneNumber.trim()) {
          toast({
            title: "Missing Information",
            description: "Please enter your phone number.",
            variant: "destructive",
          });
          return false;
        }
        break;

      case "qa":
        if (!formData.phoneNumber.trim()) {
          toast({
            title: "Missing Information",
            description: "Please enter your phone number.",
            variant: "destructive",
          });
          return false;
        }
        if (!formData.discordName.trim()) {
          toast({
            title: "Missing Information",
            description: "Please enter your Discord username.",
            variant: "destructive",
          });
          return false;
        }
        break;

      case "modeler":
        if (formData.softwareExperience.length === 0) {
          toast({
            title: "Missing Information",
            description:
              "Please select at least one software you have experience with.",
            variant: "destructive",
          });
          return false;
        }
        if (formData.modelTypes.length === 0) {
          toast({
            title: "Missing Information",
            description:
              "Please select at least one model type you can work on.",
            variant: "destructive",
          });
          return false;
        }
        if (!formData.phoneNumber.trim()) {
          toast({
            title: "Missing Information",
            description: "Please enter your phone number.",
            variant: "destructive",
          });
          return false;
        }
        if (!formData.discordName.trim()) {
          toast({
            title: "Missing Information",
            description: "Please enter your Discord username.",
            variant: "destructive",
          });
          return false;
        }
        if (!formData.country.trim()) {
          toast({
            title: "Missing Information",
            description: "Please select your country.",
            variant: "destructive",
          });
          return false;
        }
        break;
    }

    return true;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log("Form submitted", { formData, invitationData });

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "Please make sure your passwords match.",
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    // Validate role-specific fields
    if (!validateRoleSpecificFields()) {
      console.log("Validation failed");
      return;
    }

    console.log("Starting signup process");
    setSignupLoading(true);
    startLoading(); // Start the nprogress bar
    try {
      const supabase = createClient();
      let userId: string;

      // Try to create the user

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            // Store basic info in user_metadata
            client: invitationData?.client_name
              ? [invitationData.client_name]
              : null,
            role: invitationData?.role,
            client_config: invitationData?.client_name,
          },
        },
      });

      if (authError) {
        // Check if it's the "already registered" error
        if (authError.message.includes("User already registered")) {
          // Use our admin API to update the existing user
          const updateResponse = await fetch("/api/auth/update-invited-user", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: formData.email,
              password: formData.password,
              firstName: formData.firstName,
              lastName: formData.lastName,
              client: invitationData?.client_name
                ? [invitationData.client_name]
                : null,
              role: invitationData?.role,
              title: formData.title,
              phoneNumber: formData.phoneNumber,
              discordName: formData.discordName,
              softwareExperience: formData.softwareExperience,
              modelTypes: formData.modelTypes,
            }),
          });

          if (!updateResponse.ok) {
            const errorData = await updateResponse.json();
            throw new Error(errorData.error || "Failed to update user account");
          }

          const updateData = await updateResponse.json();
          userId = updateData.userId;

          // Sign in the user with the new password
          const { error: signInError } = await supabase.auth.signInWithPassword(
            {
              email: formData.email,
              password: formData.password,
            }
          );

          if (signInError) {
            throw signInError;
          }
        } else {
          // Some other error
          throw authError;
        }
      } else if (authData.user) {
        // User was created successfully

        userId = authData.user.id;
      } else {
        throw new Error("Failed to create user");
      }

      // Accept the invitation
      const acceptPayload = {
        invitationToken: token,
        userId: userId,
        email: formData.email,
        // Role-specific data
        title: formData.title,
        phoneNumber: formData.phoneNumber,
        discordName: formData.discordName,
        softwareExperience: formData.softwareExperience,
        modelTypes: formData.modelTypes,
        // Modeler-specific fields (will be null for other roles)
        dailyHours: formData.dailyHours,
        exclusiveWork: formData.exclusiveWork,
        country: formData.country,
        portfolioLinks: formData.portfolioLinks,
      };

      const acceptResponse = await fetch("/api/auth/accept-invitation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(acceptPayload),
      });

      if (acceptResponse.ok) {
        // Test direct profiles table update
        try {
          const testPayload = {
            userId: userId,
            email: formData.email,
            title: formData.title,
            phoneNumber: formData.phoneNumber,
            discordName: formData.discordName,
            softwareExperience: formData.softwareExperience,
            modelTypes: formData.modelTypes,
            client: invitationData?.client_name
              ? [invitationData.client_name]
              : null,
            role: invitationData?.role,
            // Modeler-specific fields (will be null for other roles)
            dailyHours: formData.dailyHours,
            exclusiveWork: formData.exclusiveWork,
            country: formData.country,
            portfolioLinks: formData.portfolioLinks,
          };

          const testResponse = await fetch("/api/test-profiles", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(testPayload),
          });

          if (!testResponse.ok) {
            const errorData = await testResponse.json();
            console.error("Test profiles update failed:", errorData);
          } else {
            await testResponse.json();
          }
        } catch (testError) {
          console.error("Error in test profiles update:", testError);
        }

        toast({
          title: "Account Setup Complete!",
          description: "Welcome to CharpstAR. You can now access your account.",
        });

        // Redirect to dashboard with refresh to ensure user metadata is loaded
        router.push("/dashboard?refreshUser=1");
      } else {
        console.error("Failed to accept invitation");
        // Still redirect since account was created/updated
        router.push("/dashboard?refreshUser=1");
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        title: "Setup Failed",
        description:
          error.message ||
          "Failed to complete account setup. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSignupLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "client":
        return (
          <Badge variant="default" className="gap-1">
            <UserPlus className="h-3 w-3" />
            client
          </Badge>
        );
      case "modeler":
        return (
          <Badge variant="secondary" className="gap-1">
            <Building className="h-3 w-3" />
            3D Modeler
          </Badge>
        );
      case "qa":
        return (
          <Badge variant="outline" className="gap-1">
            <Shield className="h-3 w-3" />
            Quality Assurance
          </Badge>
        );
      default:
        return <Badge variant="secondary">{role}</Badge>;
    }
  };

  const renderRoleSpecificFields = () => {
    const role = invitationData?.role;

    switch (role) {
      case "client":
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Job Title</label>
              <Input
                type="text"
                placeholder="e.g., Marketing Manager, CEO, Designer"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Phone Number</label>
              <Input
                type="tel"
                placeholder="+46 xxx xxx xxx"
                value={formData.phoneNumber}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    phoneNumber: e.target.value,
                  }))
                }
                required
              />
            </div>
          </div>
        );

      case "qa":
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Phone Number</label>
              <Input
                type="tel"
                placeholder="+46 xxx xxx xxx"
                value={formData.phoneNumber}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    phoneNumber: e.target.value,
                  }))
                }
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Discord Username</label>
              <Input
                type="text"
                placeholder="username#1234"
                value={formData.discordName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    discordName: e.target.value,
                  }))
                }
                required
              />
            </div>
          </div>
        );

      case "modeler":
        return (
          <>
            {/* Enhanced background sections with depth - Wide Grid Layout */}
            <div className="grid grid-cols-2 gap-2">
              {/* Software Experience Section */}
              <div className="surface-raised p-5 rounded-lg border border-light shadow-depth-sm transition-all duration-300 hover:shadow-depth-md">
                <label className="text-sm font-semibold mb-3 block text-foreground">
                  Software Experience *
                </label>
                <div className="grid grid-cols-1 gap-3">
                  {["Blender", "Maya"].map((software) => (
                    <label
                      key={software}
                      className="flex items-center space-x-3 p-3 rounded-md border border-input bg-surface-base hover:bg-surface-raised transition-all duration-200 cursor-pointer hover-lift-subtle"
                    >
                      <input
                        type="checkbox"
                        checked={formData.softwareExperience.includes(software)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData((prev) => ({
                              ...prev,
                              softwareExperience: [
                                ...prev.softwareExperience,
                                software,
                              ],
                            }));
                          } else {
                            setFormData((prev) => ({
                              ...prev,
                              softwareExperience:
                                prev.softwareExperience.filter(
                                  (s) => s !== software
                                ),
                            }));
                          }
                        }}
                        className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-all duration-200"
                      />
                      <span className="text-sm font-medium text-foreground">
                        {software}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Model Types Section */}
              <div className="surface-raised p-5 rounded-lg border border-light shadow-depth-sm transition-all duration-300 hover:shadow-depth-md">
                <label className="text-sm font-semibold mb-3 block text-foreground">
                  Model Types You Can Work On *
                </label>
                <div className="grid grid-cols-1 gap-3">
                  {["Hard Surface", "Soft Surface"].map((type) => (
                    <label
                      key={type}
                      className="flex items-center space-x-3 p-3 rounded-md border border-input bg-surface-base hover:bg-surface-raised transition-all duration-200 cursor-pointer hover-lift-subtle"
                    >
                      <input
                        type="checkbox"
                        checked={formData.modelTypes.includes(type)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData((prev) => ({
                              ...prev,
                              modelTypes: [...prev.modelTypes, type],
                            }));
                          } else {
                            setFormData((prev) => ({
                              ...prev,
                              modelTypes: prev.modelTypes.filter(
                                (t) => t !== type
                              ),
                            }));
                          }
                        }}
                        className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-all duration-200"
                      />
                      <span className="text-sm font-medium text-foreground">
                        {type}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Personal Information Section */}
              <div className="grid grid-cols-2 gap-4">
                <div className="surface-raised p-4 rounded-lg border border-light shadow-depth-sm transition-all duration-300">
                  <label className="text-sm font-semibold mb-2 block text-foreground">
                    Phone Number *
                  </label>
                  <Input
                    type="tel"
                    placeholder="+46 xxx xxx xxx"
                    value={formData.phoneNumber}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        phoneNumber: e.target.value,
                      }))
                    }
                    required
                    className="bg-surface-base border-input shadow-xs transition-all duration-200 focus:shadow-sm"
                  />
                </div>

                <div className="surface-raised p-4 rounded-lg border border-light shadow-depth-sm transition-all duration-300">
                  <label className="text-sm font-semibold mb-2 block text-foreground">
                    Discord Username *
                  </label>
                  <Input
                    type="text"
                    placeholder="username#1234"
                    value={formData.discordName}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        discordName: e.target.value,
                      }))
                    }
                    required
                    className="bg-surface-base border-input shadow-xs transition-all duration-200 focus:shadow-sm"
                  />
                </div>
              </div>

              {/* Availability & Location Section */}
              <div className="grid grid-cols-2 gap-4">
                <div className="surface-raised p-4 rounded-lg border border-light shadow-depth-sm transition-all duration-300">
                  <label className="text-sm font-semibold mb-2 block text-foreground">
                    Daily Hours Available *
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="24"
                    placeholder="8"
                    value={formData.dailyHours}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        dailyHours: parseInt(e.target.value) || 8,
                      }))
                    }
                    required
                    className="bg-surface-base border-input shadow-xs transition-all duration-200 focus:shadow-sm"
                  />
                </div>

                <div className="surface-raised p-4 rounded-lg border border-light shadow-depth-sm transition-all duration-300">
                  <label className="text-sm font-semibold mb-2 block text-foreground">
                    Country *
                  </label>
                  <select
                    value={formData.country}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        country: e.target.value,
                      }))
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-surface-base px-3 py-1 text-sm shadow-xs transition-all duration-200 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                    required
                  >
                    <option value="">Select your country</option>
                    <option value="SE">Sweden</option>
                    <option value="NO">Norway</option>
                    <option value="DK">Denmark</option>
                    <option value="FI">Finland</option>
                    <option value="US">United States</option>
                    <option value="GB">United Kingdom</option>
                    <option value="DE">Germany</option>
                    <option value="FR">France</option>
                    <option value="ES">Spain</option>
                    <option value="IT">Italy</option>
                    <option value="NL">Netherlands</option>
                    <option value="BE">Belgium</option>
                    <option value="AT">Austria</option>
                    <option value="CH">Switzerland</option>
                    <option value="PL">Poland</option>
                    <option value="CZ">Czech Republic</option>
                    <option value="HU">Hungary</option>
                    <option value="RO">Romania</option>
                    <option value="BG">Bulgaria</option>
                    <option value="HR">Croatia</option>
                    <option value="SI">Slovenia</option>
                    <option value="SK">Slovakia</option>
                    <option value="LT">Lithuania</option>
                    <option value="LV">Latvia</option>
                    <option value="EE">Estonia</option>
                    <option value="IE">Ireland</option>
                    <option value="PT">Portugal</option>
                    <option value="GR">Greece</option>
                    <option value="CY">Cyprus</option>
                    <option value="MT">Malta</option>
                    <option value="LU">Luxembourg</option>
                    <option value="CA">Canada</option>
                    <option value="AU">Australia</option>
                    <option value="NZ">New Zealand</option>
                    <option value="JP">Japan</option>
                    <option value="KR">South Korea</option>
                    <option value="CN">China</option>
                    <option value="IN">India</option>
                    <option value="BR">Brazil</option>
                    <option value="MX">Mexico</option>
                    <option value="AR">Argentina</option>
                    <option value="CL">Chile</option>
                    <option value="CO">Colombia</option>
                    <option value="PE">Peru</option>
                    <option value="VE">Venezuela</option>
                    <option value="ZA">South Africa</option>
                    <option value="EG">Egypt</option>
                    <option value="NG">Nigeria</option>
                    <option value="KE">Kenya</option>
                    <option value="MA">Morocco</option>
                    <option value="TN">Tunisia</option>
                    <option value="DZ">Algeria</option>
                    <option value="LY">Libya</option>
                    <option value="SD">Sudan</option>
                    <option value="ET">Ethiopia</option>
                    <option value="GH">Ghana</option>
                    <option value="UG">Uganda</option>
                    <option value="TZ">Tanzania</option>
                    <option value="MW">Malawi</option>
                    <option value="ZM">Zambia</option>
                    <option value="ZW">Zimbabwe</option>
                    <option value="BW">Botswana</option>
                    <option value="NA">Namibia</option>
                    <option value="SZ">Eswatini</option>
                    <option value="LS">Lesotho</option>
                    <option value="MG">Madagascar</option>
                    <option value="MU">Mauritius</option>
                    <option value="SC">Seychelles</option>
                    <option value="RE">Réunion</option>
                    <option value="YT">Mayotte</option>
                    <option value="KM">Comoros</option>
                    <option value="DJ">Djibouti</option>
                    <option value="SO">Somalia</option>
                    <option value="ER">Eritrea</option>
                    <option value="SS">South Sudan</option>
                    <option value="CF">Central African Republic</option>
                    <option value="TD">Chad</option>
                    <option value="NE">Niger</option>
                    <option value="ML">Mali</option>
                    <option value="BF">Burkina Faso</option>
                    <option value="CI">Ivory Coast</option>
                    <option value="SN">Senegal</option>
                    <option value="GM">Gambia</option>
                    <option value="GN">Guinea</option>
                    <option value="GW">Guinea-Bissau</option>
                    <option value="SL">Sierra Leone</option>
                    <option value="LR">Liberia</option>
                    <option value="CV">Cape Verde</option>
                    <option value="ST">São Tomé and Príncipe</option>
                    <option value="GQ">Equatorial Guinea</option>
                    <option value="GA">Gabon</option>
                    <option value="CG">Republic of the Congo</option>
                    <option value="CD">Democratic Republic of the Congo</option>
                    <option value="AO">Angola</option>
                    <option value="CM">Cameroon</option>
                    <option value="BI">Burundi</option>
                    <option value="RW">Rwanda</option>
                    <option value="MZ">Mozambique</option>
                  </select>
                </div>
              </div>

              {/* Exclusive Work Checkbox */}
              <div className="surface-raised p-4 rounded-lg border border-light shadow-depth-sm transition-all duration-300">
                <label className="flex items-center space-x-3 cursor-pointer hover-lift-subtle p-2 rounded-md">
                  <input
                    type="checkbox"
                    checked={formData.exclusiveWork}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        exclusiveWork: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-all duration-200"
                  />
                  <span className="text-sm font-medium text-foreground">
                    I work exclusively with CharpstAR
                  </span>
                </label>
              </div>

              {/* Portfolio Links Section */}
              <div className="surface-raised p-5 rounded-lg border border-light shadow-depth-sm transition-all duration-300">
                <label className="text-sm font-semibold mb-3 block text-foreground">
                  Portfolio Links{" "}
                  <span className="text-muted-foreground font-normal">
                    (Optional)
                  </span>
                </label>
                <div className="space-y-3">
                  {formData.portfolioLinks.map((link, index) => (
                    <div
                      key={index}
                      className="flex gap-2 surface-base p-3 rounded-md border border-input shadow-xs"
                    >
                      <Input
                        type="text"
                        placeholder="your-portfolio.com or https://your-portfolio.com"
                        value={link}
                        onChange={(e) => {
                          const newLinks = [...formData.portfolioLinks];
                          newLinks[index] = e.target.value;
                          setFormData((prev) => ({
                            ...prev,
                            portfolioLinks: newLinks,
                          }));
                        }}
                        className="bg-transparent border-0 shadow-none focus-visible:ring-0"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            portfolioLinks: prev.portfolioLinks.filter(
                              (_, i) => i !== index
                            ),
                          }));
                        }}
                        className="hover-lift-subtle"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        portfolioLinks: [...prev.portfolioLinks, ""],
                      }));
                    }}
                    className="w-full hover-lift-subtle"
                  >
                    Add Portfolio Link
                  </Button>
                </div>
              </div>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Validating your invitation...</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 max-w-md w-full">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Invalid Invitation Link</h1>
            <p className="text-muted-foreground mb-4">
              This invitation link is missing or invalid. Please check your
              email for the correct link.
            </p>
            <Button onClick={() => router.push("/auth")}>Go to Login</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!invitationData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 max-w-md w-full">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Invitation Not Found</h1>
            <p className="text-muted-foreground mb-4">
              This invitation has expired or is no longer valid.
            </p>
            <Button onClick={() => router.push("/auth")}>Go to Login</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto rounded-b-lg justify-center items-center bg-background h-full max-h-[calc(100vh-80px)] scrollbar-gutter-stable flex items-center justify-center bg-background dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="p-8 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-6">
          <UserPlus className="h-12 w-12 text-info mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Welcome to CharpstAR</h1>
          <p className="text-muted-foreground">
            Complete your account setup to get started
          </p>
        </div>

        {/* Invitation Details */}
        <div className="bg-muted rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="h-4 w-4 text-info" />
            <span className="font-medium text-foreground">
              {invitationData.email}
            </span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Building className="h-4 w-4 text-info" />
            <span className="text-sm text-foreground">
              {invitationData.client_name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {getRoleBadge(invitationData.role)}
          </div>
        </div>

        {/* Signup Form */}
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">First Name</label>
              <Input
                type="text"
                value={formData.firstName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    firstName: e.target.value,
                  }))
                }
                required
                autoComplete="given-name"
                placeholder="Enter your first name"
                name="firstName"
                id="firstName"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Last Name</label>
              <Input
                type="text"
                value={formData.lastName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, lastName: e.target.value }))
                }
                required
                autoComplete="family-name"
                placeholder="Enter your last name"
                name="lastName"
                id="lastName"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              value={formData.email}
              disabled
              className="bg-muted"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Password</label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, password: e.target.value }))
              }
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Create a password"
              name="password"
              id="password"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Confirm Password</label>
            <Input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  confirmPassword: e.target.value,
                }))
              }
              required
              autoComplete="new-password"
              placeholder="Confirm your password"
              name="confirmPassword"
              id="confirmPassword"
            />
          </div>

          {/* Role-specific fields */}
          {renderRoleSpecificFields()}

          <Button type="submit" className="w-full" disabled={signupLoading}>
            {signupLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating Account...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Complete Setup
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            By completing this setup, you agree to our Terms of Service and
            Privacy Policy.
          </p>
        </div>
      </Card>
    </div>
  );
}
