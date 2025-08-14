"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/display";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import { MultiSelect } from "@/components/ui/inputs";
import { Checkbox } from "@/components/ui/inputs";
import {
  ArrowLeft,
  User,
  ShieldCheck,
  Users,
  CheckCircle,
  Package,
  Settings,
  BarChart3,
  UserCheck,
  AlertCircle,
  Plus,
  Trash2,
  Eye,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

interface User {
  id: string;
  email: string;
  title?: string;
  role: string;
}

interface QAAllocation {
  id: string;
  qa_id: string;
  modeler_id: string;
  created_at: string;
  qa_user: User;
  modeler_user: User;
}

export default function QAAllocationPage() {
  const router = useRouter();
  const [qaUsers, setQAUsers] = useState<User[]>([]);
  const [modelers, setModelers] = useState<User[]>([]);
  const [allocations, setAllocations] = useState<QAAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQA, setSelectedQA] = useState<string>("");
  const [selectedModelers, setSelectedModelers] = useState<string[]>([]);
  const [allocating, setAllocating] = useState(false);
  const [currentQAModelers, setCurrentQAModelers] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  // Update current QA modelers when selectedQA changes
  useEffect(() => {
    if (selectedQA) {
      const qaAllocations = allocations.filter(
        (allocation) => allocation.qa_id === selectedQA
      );
      const modelerIds = qaAllocations.map(
        (allocation) => allocation.modeler_id
      );
      setCurrentQAModelers(modelerIds);
      // Pre-select current modelers
      setSelectedModelers(modelerIds);
    } else {
      setCurrentQAModelers([]);
      setSelectedModelers([]);
    }
  }, [selectedQA, allocations]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch all QA users
      const { data: qaData, error: qaError } = await supabase
        .from("profiles")
        .select("id, email, title, role")
        .eq("role", "qa");

      if (qaError) {
        console.error("Error fetching QA users:", qaError);
        toast.error("Failed to fetch QA users");
        return;
      }

      // Fetch all modelers
      const { data: modelerData, error: modelerError } = await supabase
        .from("profiles")
        .select("id, email, title, role")
        .eq("role", "modeler");

      if (modelerError) {
        console.error("Error fetching modelers:", modelerError);
        toast.error("Failed to fetch modelers");
        return;
      }

      // Fetch existing QA allocations
      const { data: allocationData, error: allocationError } =
        await supabase.from("qa_allocations").select(`
          id,
          qa_id,
          modeler_id,
          created_at
        `);

      if (allocationError) {
        console.error("Error fetching QA allocations:", allocationError);
        toast.error("Failed to fetch QA allocations");
        return;
      }

      // Fetch user details for allocations
      const qaIds = [...new Set(allocationData?.map((a) => a.qa_id) || [])];
      const modelerIds = [
        ...new Set(allocationData?.map((a) => a.modeler_id) || []),
      ];

      const { data: qaDetails, error: qaDetailsError } = await supabase
        .from("profiles")
        .select("id, email, title, role")
        .in("id", qaIds);

      const { data: modelerDetails, error: modelerDetailsError } =
        await supabase
          .from("profiles")
          .select("id, email, title, role")
          .in("id", modelerIds);

      if (qaDetailsError || modelerDetailsError) {
        console.error(
          "Error fetching user details:",
          qaDetailsError || modelerDetailsError
        );
        toast.error("Failed to fetch user details");
        return;
      }

      // Create maps for quick lookup
      const qaMap = new Map(qaDetails?.map((qa) => [qa.id, qa]) || []);
      const modelerMap = new Map(
        modelerDetails?.map((modeler) => [modeler.id, modeler]) || []
      );

      // Combine allocation data with user details
      const allocationsWithUsers: QAAllocation[] = allocationData
        ?.map((allocation) => {
          const qaUser = qaMap.get(allocation.qa_id);
          const modelerUser = modelerMap.get(allocation.modeler_id);

          if (!qaUser || !modelerUser) {
            console.warn(`Missing user data for allocation ${allocation.id}`);
            return null;
          }

          return {
            id: allocation.id,
            qa_id: allocation.qa_id,
            modeler_id: allocation.modeler_id,
            created_at: allocation.created_at,
            qa_user: qaUser,
            modeler_user: modelerUser,
          };
        })
        .filter(Boolean) as QAAllocation[];

      setQAUsers(qaData || []);
      setModelers(modelerData || []);
      setAllocations(allocationsWithUsers);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const handleAllocate = async () => {
    if (!selectedQA || selectedModelers.length === 0) {
      toast.error("Please select both a QA user and at least one modeler");
      return;
    }

    try {
      setAllocating(true);

      let successCount = 0;
      let errorCount = 0;

      // Get current modelers for this QA
      const currentModelerIds = allocations
        .filter((allocation) => allocation.qa_id === selectedQA)
        .map((allocation) => allocation.modeler_id);

      // Find modelers to add (new selections not currently assigned)
      const modelersToAdd = selectedModelers.filter(
        (modelerId) => !currentModelerIds.includes(modelerId)
      );

      // Find modelers to remove (currently assigned but not in new selection)
      const modelersToRemove = currentModelerIds.filter(
        (modelerId) => !selectedModelers.includes(modelerId)
      );

      // Remove modelers that are no longer selected
      for (const modelerId of modelersToRemove) {
        const allocationToRemove = allocations.find(
          (allocation) =>
            allocation.qa_id === selectedQA &&
            allocation.modeler_id === modelerId
        );

        if (allocationToRemove) {
          const { error } = await supabase
            .from("qa_allocations")
            .delete()
            .eq("id", allocationToRemove.id);

          if (error) {
            console.error("Error removing QA allocation:", error);
            const modelerName =
              modelers.find((m) => m.id === modelerId)?.title || modelerId;
            toast.error(`Failed to remove ${modelerName} from QA`);
            errorCount++;
            continue;
          }
          successCount++;
        }
      }

      // Add new modelers
      for (const modelerId of modelersToAdd) {
        const { error } = await supabase.from("qa_allocations").insert({
          qa_id: selectedQA,
          modeler_id: modelerId,
          created_at: new Date().toISOString(),
        });

        if (error) {
          console.error("Error creating QA allocation:", error);
          const modelerName =
            modelers.find((m) => m.id === modelerId)?.title || modelerId;
          toast.error(`Failed to assign ${modelerName} to QA`);
          errorCount++;
          continue;
        }

        successCount++;
      }

      if (successCount > 0) {
        toast.success(
          `Updated ${successCount} allocation(s) successfully${errorCount > 0 ? ` (${errorCount} failed)` : ""}`
        );
      }

      // Keep the selected QA but reset modeler selection
      // setSelectedQA(""); // Keep QA selected for better UX
      setSelectedModelers([]);

      // Update local state instead of refetching data
      // Remove deleted allocations
      const updatedAllocations = allocations.filter((allocation) => {
        if (allocation.qa_id === selectedQA) {
          // Keep allocations that weren't removed
          return !modelersToRemove.includes(allocation.modeler_id);
        }
        return true;
      });

      // Add new allocations to local state
      const newAllocations: QAAllocation[] = [];
      for (const modelerId of modelersToAdd) {
        const modeler = modelers.find((m) => m.id === modelerId);
        const qa = qaUsers.find((q) => q.id === selectedQA);
        if (modeler && qa) {
          newAllocations.push({
            id: `temp-${Date.now()}-${modelerId}`, // Temporary ID
            qa_id: selectedQA,
            modeler_id: modelerId,
            created_at: new Date().toISOString(),
            qa_user: qa,
            modeler_user: modeler,
          });
        }
      }

      setAllocations([...updatedAllocations, ...newAllocations]);
    } catch (error) {
      console.error("Error updating QA allocations:", error);
      toast.error("Failed to update QA allocations");
    } finally {
      setAllocating(false);
    }
  };

  const handleRemoveAllocation = async (allocationId: string) => {
    try {
      const { error } = await supabase
        .from("qa_allocations")
        .delete()
        .eq("id", allocationId);

      if (error) {
        console.error("Error removing QA allocation:", error);
        toast.error("Failed to remove QA allocation");
        return;
      }

      // Update local state instead of refetching
      setAllocations((prev) =>
        prev.filter((allocation) => allocation.id !== allocationId)
      );

      // If this allocation affects the currently selected QA, update the current modelers
      const removedAllocation = allocations.find((a) => a.id === allocationId);
      if (removedAllocation && removedAllocation.qa_id === selectedQA) {
        setCurrentQAModelers((prev) =>
          prev.filter((id) => id !== removedAllocation.modeler_id)
        );
        setSelectedModelers((prev) =>
          prev.filter((id) => id !== removedAllocation.modeler_id)
        );
      }

      toast.success("QA allocation removed successfully");
    } catch (error) {
      console.error("Error removing QA allocation:", error);
      toast.error("Failed to remove QA allocation");
    }
  };

  const getAvailableModelers = () => {
    // Show all modelers since the system allows multiple allocations
    return modelers;
  };

  const getAvailableQAUsers = () => {
    // Allow QA users to be allocated to multiple modelers
    // No filtering needed since we're selecting QA first
    return qaUsers;
  };

  const handleRemoveModelerFromQA = async (modelerId: string) => {
    try {
      const allocationToRemove = allocations.find(
        (allocation) =>
          allocation.qa_id === selectedQA && allocation.modeler_id === modelerId
      );

      if (!allocationToRemove) {
        toast.error("Allocation not found");
        return;
      }

      const { error } = await supabase
        .from("qa_allocations")
        .delete()
        .eq("id", allocationToRemove.id);

      if (error) {
        console.error("Error removing QA allocation:", error);
        toast.error("Failed to remove QA allocation");
        return;
      }

      // Update local state instead of refetching
      setAllocations((prev) =>
        prev.filter((allocation) => allocation.id !== allocationToRemove.id)
      );

      // Update current QA modelers for the selected QA
      setCurrentQAModelers((prev) => prev.filter((id) => id !== modelerId));

      // Update selected modelers if the removed modeler was selected
      setSelectedModelers((prev) => prev.filter((id) => id !== modelerId));

      toast.success("Modeler removed from QA successfully");
    } catch (error) {
      console.error("Error removing modeler from QA:", error);
      toast.error("Failed to remove modeler from QA");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen  ">
        <div className="container mx-auto p-8 space-y-8">
          {/* Header Skeleton */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-muted animate-pulse rounded-lg" />
                <div className="space-y-2">
                  <div className="h-6 w-48 bg-muted animate-pulse rounded" />
                  <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                </div>
              </div>
              <div className="h-10 w-32 bg-muted animate-pulse rounded-lg" />
            </div>
          </div>

          {/* Content Skeleton */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2 space-y-6">
              <div className="h-96 bg-white border rounded-xl animate-pulse" />
            </div>
            <div className="space-y-6">
              <div className="h-64 bg-white border rounded-xl animate-pulse" />
            </div>
          </div>

          <div className="h-64 bg-white border rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <style jsx global>{`
        @keyframes slide-progress {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>

      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Settings className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                QA Allocation Management
              </h1>
              <p className="text-sm text-gray-600">
                Manage quality assurance assignments and reviewer allocations
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push("/production")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Production
          </Button>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Allocation Manager */}
          <div className="xl:col-span-2">
            <Card className="bg-white border border-gray-100 shadow-sm relative">
              {/* Progress Bar */}
              {allocating && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gray-200 overflow-hidden">
                  <div
                    className="h-full bg-gray-600"
                    style={{
                      animation: "slide-progress 2s ease-in-out infinite",
                      background:
                        "linear-gradient(90deg, transparent, #4B5563, transparent)",
                    }}
                  />
                </div>
              )}

              <CardHeader className="border-b border-gray-100 bg-gray-50/70">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <UserCheck className="h-5 w-5 text-gray-600" />
                  QA Allocation Manager
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Assign modelers to QA reviewers and manage existing
                  allocations
                </p>
              </CardHeader>

              <CardContent className="p-4 space-y-5">
                {/* QA Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <ShieldCheck className="h-4 w-4 inline-block mr-1" />
                    Select QA Reviewer
                  </label>
                  <Select value={selectedQA} onValueChange={setSelectedQA}>
                    <SelectTrigger className="h-12 text-base border-gray-200 focus:border-gray-400">
                      <SelectValue placeholder="Choose a QA reviewer..." />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableQAUsers().map((qa) => (
                        <SelectItem key={qa.id} value={qa.id}>
                          {qa.title || qa.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Modeler Management */}
                {selectedQA ? (
                  <div className="space-y-5">
                    {/* Current Assignments */}
                    {currentQAModelers.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          Current Modelers ({currentQAModelers.length})
                        </h4>
                        <ul className="divide-y divide-gray-100 border border-gray-100 rounded-md bg-gray-50 max-h-56 overflow-y-auto">
                          {currentQAModelers.map((id) => {
                            const modeler = modelers.find((m) => m.id === id);
                            if (!modeler) return null;
                            return (
                              <li
                                key={id}
                                className="flex items-center justify-between px-3 py-2 bg-white hover:bg-gray-50"
                              >
                                <span className="text-sm font-medium">
                                  {modeler.title || modeler.email}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRemoveModelerFromQA(id)}
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Remove
                                </Button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {/* Add New Modelers */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Add New Modelers
                      </h4>
                      {getAvailableModelers().filter(
                        (m) => !currentQAModelers.includes(m.id)
                      ).length > 0 ? (
                        <div className="border border-gray-100 rounded-md bg-gray-50 p-3">
                          {getAvailableModelers()
                            .filter((m) => !currentQAModelers.includes(m.id))
                            .map((modeler) => (
                              <label
                                key={modeler.id}
                                className="flex items-center gap-2 py-1.5 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedModelers.includes(
                                    modeler.id
                                  )}
                                  onChange={(e) => {
                                    setSelectedModelers(
                                      e.target.checked
                                        ? [...selectedModelers, modeler.id]
                                        : selectedModelers.filter(
                                            (id) => id !== modeler.id
                                          )
                                    );
                                  }}
                                  className="accent-gray-600"
                                />
                                <span className="text-sm">
                                  {modeler.title || modeler.email}
                                </span>
                              </label>
                            ))}
                        </div>
                      ) : (
                        <div className="bg-gray-50 border border-gray-100 rounded-md p-4 text-center text-sm text-gray-600">
                          All available modelers are already assigned
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-100 rounded-md p-6 text-center text-gray-600">
                    Select a QA reviewer to manage their modeler assignments
                  </div>
                )}

                {/* Action Button */}
                {selectedQA && (
                  <div className="pt-4 border-t border-gray-100">
                    <Button
                      onClick={handleAllocate}
                      disabled={
                        !selectedQA ||
                        selectedModelers.length === 0 ||
                        allocating ||
                        (currentQAModelers.length > 0 &&
                          selectedModelers.length ===
                            currentQAModelers.length &&
                          selectedModelers.every((id) =>
                            currentQAModelers.includes(id)
                          ))
                      }
                      className="w-full h-10"
                    >
                      {allocating ? "Processing..." : "Update Allocations"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Stats Sidebar */}
          <div className="space-y-4">
            {[
              {
                icon: ShieldCheck,
                label: "QA Reviewers",
                value: qaUsers.length,
                sub: "Available for assignment",
              },
              {
                icon: Users,
                label: "Total Modelers",
                value: modelers.length,
                sub: "In the system",
              },
              {
                icon: CheckCircle,
                label: "Active Allocations",
                value: allocations.length,
                sub: "Current assignments",
              },
              {
                icon: BarChart3,
                label: "Avg per QA",
                value:
                  qaUsers.length > 0
                    ? (allocations.length / qaUsers.length).toFixed(1)
                    : "0",
                sub: "Modelers assigned",
              },
            ].map((stat, i) => (
              <Card
                key={i}
                className="bg-white border border-gray-100 shadow-sm"
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-full">
                      <stat.icon className="h-4 w-4 text-gray-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-700">
                        {stat.label}
                      </div>
                      <div className="text-xs text-gray-500">{stat.sub}</div>
                    </div>
                  </div>
                  <div className="text-xl font-semibold text-gray-900">
                    {stat.value}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
