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
import {
  ArrowLeft,
  User,
  ShieldCheck,
  Users,
  CheckCircle,
  Package,
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

  useEffect(() => {
    fetchData();
  }, []);

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

      for (const modelerId of selectedModelers) {
        // Check if allocation already exists
        const existingAllocation = allocations.find(
          (allocation) =>
            allocation.qa_id === selectedQA &&
            allocation.modeler_id === modelerId
        );

        if (existingAllocation) {
          const modelerName =
            modelers.find((m) => m.id === modelerId)?.title || modelerId;
          toast.error(`Allocation for ${modelerName} already exists`);
          errorCount++;
          continue;
        }

        const { error } = await supabase.from("qa_allocations").insert({
          qa_id: selectedQA,
          modeler_id: modelerId,
          created_at: new Date().toISOString(),
        });

        if (error) {
          console.error("Error creating QA allocation:", error);
          const modelerName =
            modelers.find((m) => m.id === modelerId)?.title || modelerId;
          toast.error(`Failed to create allocation for ${modelerName}`);
          errorCount++;
          continue;
        }

        successCount++;
      }

      if (successCount > 0) {
        toast.success(
          `Created ${successCount} allocation(s) successfully${errorCount > 0 ? ` (${errorCount} failed)` : ""}`
        );
      }

      // Reset form
      setSelectedQA("");
      setSelectedModelers([]);

      // Refresh data
      await fetchData();
    } catch (error) {
      console.error("Error creating QA allocations:", error);
      toast.error("Failed to create QA allocations");
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
    // Allow modelers to be allocated to multiple QA users
    // Show all modelers since the system allows multiple allocations
    return modelers;
  };

  const getAvailableQAUsers = () => {
    // Allow QA users to be allocated to multiple modelers
    // No filtering needed since we're selecting QA first
    return qaUsers;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 bg-muted animate-pulse rounded" />
          <div className="h-8 w-32 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-muted animate-pulse rounded-lg" />
          <div className="h-64 bg-muted animate-pulse rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/production")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Production
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create New Allocation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Create New QA Allocation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">QA Reviewer</label>
              <Select value={selectedQA} onValueChange={setSelectedQA}>
                <SelectTrigger>
                  <SelectValue placeholder="Select QA reviewer" />
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

            <div className="space-y-2">
              <label className="text-sm font-medium">Modelers</label>
              {selectedQA ? (
                <div className="space-y-2">
                  {/* Simple checkbox list for testing */}
                  <div className="border rounded-md p-3 max-h-40 overflow-y-auto">
                    <div className="text-sm font-medium mb-2">
                      Select Modelers:
                    </div>
                    {getAvailableModelers().map((modeler) => (
                      <div
                        key={modeler.id}
                        className="flex items-center space-x-2 py-1"
                      >
                        <input
                          type="checkbox"
                          id={modeler.id}
                          checked={selectedModelers.includes(modeler.id)}
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
                        />
                        <label htmlFor={modeler.id} className="text-sm">
                          {modeler.title || modeler.email}
                        </label>
                      </div>
                    ))}
                  </div>

                  {/* Original MultiSelect for comparison */}
                  <MultiSelect
                    options={getAvailableModelers().map((modeler) => ({
                      value: modeler.id,
                      label: modeler.title || modeler.email,
                    }))}
                    value={selectedModelers}
                    onChange={setSelectedModelers}
                    placeholder="Select modelers"
                  />
                </div>
              ) : (
                <div className="p-3 text-sm text-muted-foreground bg-muted rounded-md">
                  Please select a QA reviewer first
                </div>
              )}
            </div>

            <Button
              onClick={handleAllocate}
              disabled={
                !selectedQA || selectedModelers.length === 0 || allocating
              }
              className="w-full"
            >
              {allocating ? "Creating..." : "Create Allocation"}
            </Button>
          </CardContent>
        </Card>

        {/* Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Allocation Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {qaUsers.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total QA Users
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {modelers.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Modelers
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-success">
                  {allocations.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  Active Allocations
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-info">
                  {qaUsers.length > 0
                    ? (allocations.length / qaUsers.length).toFixed(1)
                    : "0"}
                </div>
                <div className="text-sm text-muted-foreground">
                  Avg Allocations per QA
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Allocations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Current QA Allocations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allocations.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No QA allocations found</p>
              <p className="text-sm text-muted-foreground">
                Create your first QA allocation above
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>QA Reviewer</TableHead>
                  <TableHead>Modeler</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allocations.map((allocation) => (
                  <TableRow key={allocation.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        <div>
                          <div className="font-medium">
                            {allocation.qa_user?.title ||
                              allocation.qa_user?.email}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            QA Reviewer
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        <div>
                          <div className="font-medium">
                            {allocation.modeler_user?.title ||
                              allocation.modeler_user?.email}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Modeler
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {new Date(allocation.created_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveAllocation(allocation.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
