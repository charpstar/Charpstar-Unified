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

      // Reset form
      setSelectedQA("");
      setSelectedModelers([]);

      // Refresh data
      await fetchData();
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

      toast.success("QA allocation removed successfully");
      await fetchData();
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

      toast.success("Modeler removed from QA successfully");
      await fetchData();
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
    <div className="min-h-screen ">
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
      <div className="container mx-auto p-8 space-y-8">
        {/* Header */}
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-gray-200 rounded-lg">
                <Settings className="h-6 w-6 text-gray-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  QA Allocation Management
                </h1>
                <p className="text-gray-600">
                  Manage quality assurance assignments and reviewer allocations
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => router.push("/production")}
              className="gap-2 hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Production
            </Button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Allocation Management - Takes 2/3 width */}
          <div className="xl:col-span-2">
            <Card
              className={`bg-white border shadow-sm relative transition-all duration-300 ${allocating ? "ring-2 ring-gray-300 ring-opacity-50" : ""}`}
            >
              {/* Loading Progress Bar */}
              {allocating && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200 overflow-hidden z-10">
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

              <CardHeader className="border-b bg-gray-50">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-gray-200 rounded-lg">
                    <UserCheck className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <span className="text-lg font-semibold text-gray-900">
                      QA Allocation Manager
                    </span>
                    <p className="text-sm text-gray-600 font-normal mt-1">
                      Assign modelers to QA reviewers and manage existing
                      allocations
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent
                className={`p-6 space-y-6 transition-opacity duration-300 ${allocating ? "opacity-75" : "opacity-100"}`}
              >
                {/* QA Selection */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-gray-600" />
                    Select QA Reviewer
                  </label>
                  <Select value={selectedQA} onValueChange={setSelectedQA}>
                    <SelectTrigger className="h-16 text-base border-2 border-gray-200 focus:border-gray-400 transition-colors">
                      <SelectValue placeholder="Choose a QA reviewer to manage..." />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableQAUsers().map((qa) => (
                        <SelectItem key={qa.id} value={qa.id} className="py-3">
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-gray-200 rounded-full">
                              <ShieldCheck className="h-3 w-3 text-gray-600" />
                            </div>
                            <div>
                              <div className="font-medium">
                                {qa.title || qa.email}
                              </div>
                              <div className="text-xs text-gray-500">
                                QA Reviewer
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Modeler Management */}
                {selectedQA ? (
                  <div className="space-y-6">
                    {/* Current Assignments */}
                    {currentQAModelers.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4 text-gray-600" />
                          <span className="text-sm font-semibold text-gray-700">
                            Currently Assigned Modelers (
                            {currentQAModelers.length})
                          </span>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto space-y-3">
                          {currentQAModelers.map((modelerId) => {
                            const modeler = modelers.find(
                              (m) => m.id === modelerId
                            );
                            if (!modeler) return null;

                            return (
                              <div
                                key={modelerId}
                                className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-gray-200 rounded-full">
                                    <User className="h-4 w-4 text-gray-600" />
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-900">
                                      {modeler.title || modeler.email}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      Active Modeler
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleRemoveModelerFromQA(modelerId)
                                  }
                                  className="text-gray-600 hover:text-gray-700 hover:bg-gray-50 border-gray-200"
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Remove
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Add New Modelers */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4 text-gray-600" />
                        <span className="text-sm font-semibold text-gray-700">
                          Add New Modelers
                        </span>
                      </div>

                      {getAvailableModelers().filter(
                        (modeler) => !currentQAModelers.includes(modeler.id)
                      ).length > 0 ? (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <div className="space-y-2">
                            {getAvailableModelers()
                              .filter(
                                (modeler) =>
                                  !currentQAModelers.includes(modeler.id)
                              )
                              .map((modeler) => (
                                <label
                                  key={modeler.id}
                                  className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-all cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedModelers.includes(
                                      modeler.id
                                    )}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedModelers([
                                          ...selectedModelers,
                                          modeler.id,
                                        ]);
                                      } else {
                                        setSelectedModelers(
                                          selectedModelers.filter(
                                            (id) => id !== modeler.id
                                          )
                                        );
                                      }
                                    }}
                                    className="w-4 h-4 text-gray-600 bg-white border-gray-300 rounded focus:ring-gray-500 focus:ring-offset-2 focus:border-gray-500 checked:bg-gray-600 checked:border-gray-600 accent-gray-600"
                                  />
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-gray-200 rounded-full">
                                      <User className="h-3 w-3 text-gray-600" />
                                    </div>
                                    <div>
                                      <div className="font-medium text-gray-900">
                                        {modeler.title || modeler.email}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        Available Modeler
                                      </div>
                                    </div>
                                  </div>
                                </label>
                              ))}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                          <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">
                            All available modelers are already assigned to this
                            QA reviewer
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                    <Eye className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="font-medium text-gray-900 mb-2">
                      Select a QA Reviewer
                    </h3>
                    <p className="text-sm text-gray-600">
                      Choose a QA reviewer above to view and manage their
                      modeler assignments
                    </p>
                  </div>
                )}

                {/* Action Button */}
                {selectedQA && (
                  <div className="border-t pt-6">
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
                      className={`w-full h-12 text-base font-semibold transition-all duration-300 ${
                        allocating
                          ? "bg-gray-500 cursor-not-allowed transform scale-95"
                          : "bg-gray-600 hover:bg-gray-700 hover:transform hover:scale-105"
                      } disabled:bg-gray-300 disabled:cursor-not-allowed`}
                    >
                      {allocating ? (
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                            <div
                              className="absolute inset-0 w-5 h-5 border-3 border-transparent border-b-white rounded-full animate-spin animate-reverse"
                              style={{ animationDuration: "1.5s" }}
                            />
                          </div>
                          <span className="animate-pulse">
                            Processing allocations...
                          </span>
                          <div className="flex gap-1">
                            <div
                              className="w-1 h-1 bg-white rounded-full animate-bounce"
                              style={{ animationDelay: "0ms" }}
                            />
                            <div
                              className="w-1 h-1 bg-white rounded-full animate-bounce"
                              style={{ animationDelay: "150ms" }}
                            />
                            <div
                              className="w-1 h-1 bg-white rounded-full animate-bounce"
                              style={{ animationDelay: "300ms" }}
                            />
                          </div>
                        </div>
                      ) : currentQAModelers.length > 0 &&
                        selectedModelers.length === currentQAModelers.length &&
                        selectedModelers.every((id) =>
                          currentQAModelers.includes(id)
                        ) ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          No Changes Needed
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 transition-all duration-200">
                          <CheckCircle className="h-4 w-4 transition-transform group-hover:scale-110" />
                          <span>Update Allocations</span>
                        </div>
                      )}
                    </Button>

                    {currentQAModelers.length > 0 &&
                      selectedModelers.length === currentQAModelers.length &&
                      selectedModelers.every((id) =>
                        currentQAModelers.includes(id)
                      ) && (
                        <div className="text-xs text-gray-500 text-center mt-2">
                          All current modelers are selected. No changes needed.
                        </div>
                      )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Statistics Sidebar */}
          <div className="space-y-6">
            <Card className="bg-white border shadow-sm">
              <CardHeader className="border-b bg-gray-50">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-gray-200 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-gray-600" />
                  </div>
                  <span className="text-lg font-semibold text-gray-900">
                    Statistics Overview
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  {/* QA Users Stat */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-200 rounded-full">
                        <ShieldCheck className="h-4 w-4 text-gray-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-600">
                          QA Reviewers
                        </div>
                        <div className="text-xs text-gray-500">
                          Available for assignment
                        </div>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-gray-700">
                      {qaUsers.length}
                    </div>
                  </div>

                  {/* Modelers Stat */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-200 rounded-full">
                        <Users className="h-4 w-4 text-gray-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-600">
                          Total Modelers
                        </div>
                        <div className="text-xs text-gray-500">
                          In the system
                        </div>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-gray-700">
                      {modelers.length}
                    </div>
                  </div>

                  {/* Active Allocations Stat */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-200 rounded-full">
                        <CheckCircle className="h-4 w-4 text-gray-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-600">
                          Active Allocations
                        </div>
                        <div className="text-xs text-gray-500">
                          Current assignments
                        </div>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-gray-700">
                      {allocations.length}
                    </div>
                  </div>

                  {/* Average Allocation Stat */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-200 rounded-full">
                        <BarChart3 className="h-4 w-4 text-gray-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-600">
                          Avg per QA
                        </div>
                        <div className="text-xs text-gray-500">
                          Modelers assigned
                        </div>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-gray-700">
                      {qaUsers.length > 0
                        ? (allocations.length / qaUsers.length).toFixed(1)
                        : "0"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Current Allocations Table */}
        <Card className="bg-white border shadow-sm">
          <CardHeader className="border-b bg-gray-50">
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-gray-200 rounded-lg">
                <CheckCircle className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <span className="text-lg font-semibold text-gray-900">
                  Active QA Allocations
                </span>
                <p className="text-sm text-gray-600 font-normal mt-1">
                  Overview of all current QA reviewer and modeler assignments
                </p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {allocations.length === 0 ? (
              <div className="text-center py-16 px-6">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Package className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No allocations yet
                </h3>
                <p className="text-gray-600 mb-4">
                  Start by creating your first QA allocation using the manager
                  above
                </p>
                <div className="inline-flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-4 py-2 rounded-lg">
                  <ShieldCheck className="h-4 w-4" />
                  Select a QA reviewer to get started
                </div>
              </div>
            ) : (
              <div className="overflow-hidden">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow className="border-b">
                      <TableHead className="font-semibold text-gray-900 p-4">
                        QA Reviewer
                      </TableHead>
                      <TableHead className="font-semibold text-gray-900 p-4">
                        Assigned Modeler
                      </TableHead>
                      <TableHead className="font-semibold text-gray-900 p-4">
                        Assignment Date
                      </TableHead>
                      <TableHead className="font-semibold text-gray-900 p-4 text-center">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allocations.map((allocation, index) => (
                      <TableRow
                        key={allocation.id}
                        className={`border-b hover:bg-gray-50 transition-colors ${
                          index % 2 === 0 ? "bg-white" : "bg-gray-25"
                        }`}
                      >
                        <TableCell className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-200 rounded-full">
                              <ShieldCheck className="h-4 w-4 text-gray-600" />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">
                                {allocation.qa_user?.title ||
                                  allocation.qa_user?.email}
                              </div>
                              <div className="text-sm text-gray-500">
                                QA Reviewer
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-200 rounded-full">
                              <User className="h-4 w-4 text-gray-600" />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">
                                {allocation.modeler_user?.title ||
                                  allocation.modeler_user?.email}
                              </div>
                              <div className="text-sm text-gray-500">
                                Modeler
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="p-4">
                          <div className="text-sm text-gray-900 font-medium">
                            {new Date(allocation.created_at).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              }
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(allocation.created_at).toLocaleTimeString(
                              "en-US",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="p-4 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleRemoveAllocation(allocation.id)
                            }
                            className="text-gray-600 hover:text-gray-700 hover:bg-gray-50 border-gray-200 transition-colors"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
