"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Input } from "@/components/ui/inputs";
import { Badge } from "@/components/ui/feedback";
import { Loader2, Search, Users, X } from "lucide-react";
import { toast } from "sonner";

interface Colleague {
  id: string;
  email: string;
  name?: string;
  displayName: string;
  title?: string;
  client: string[] | string | null;
}

interface AllocateProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetIds: string[];
  onSuccess?: () => void;
}

export function AllocateProductsDialog({
  open,
  onOpenChange,
  assetIds,
  onSuccess,
}: AllocateProductsDialogProps) {
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedColleagueId, setSelectedColleagueId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && assetIds.length > 0) {
      fetchColleagues();
    }
  }, [open, assetIds]);

  const fetchColleagues = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        "/api/client-product-assignments/colleagues"
      );
      if (!response.ok) {
        throw new Error("Failed to fetch colleagues");
      }
      const data = await response.json();
      setColleagues(data.colleagues || []);
    } catch (error) {
      console.error("Error fetching colleagues:", error);
      toast.error("Failed to load colleagues");
    } finally {
      setLoading(false);
    }
  };

  const handleAllocate = async () => {
    if (!selectedColleagueId) {
      toast.error("Please select a colleague");
      return;
    }

    if (assetIds.length === 0) {
      toast.error("No products selected");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/client-product-assignments/allocate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetIds,
          assignedToUserId: selectedColleagueId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to allocate products");
      }

      if (data.alreadyAssigned && data.alreadyAssigned.length > 0) {
        toast.warning(
          `Assigned ${data.assigned?.length || 0} product(s). ${data.alreadyAssigned.length} were already assigned.`
        );
      } else {
        toast.success(
          data.message || `Successfully assigned ${assetIds.length} product(s)`
        );
      }

      onOpenChange(false);
      setSelectedColleagueId("");
      setSearchTerm("");
      onSuccess?.();
    } catch (error: any) {
      console.error("Error allocating products:", error);
      toast.error(error.message || "Failed to allocate products");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredColleagues = colleagues.filter((colleague) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      colleague.displayName.toLowerCase().includes(term) ||
      colleague.email?.toLowerCase().includes(term) ||
      colleague.title?.toLowerCase().includes(term)
    );
  });

  const selectedColleague = colleagues.find(
    (c) => c.id === selectedColleagueId
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Allocate Products to Colleague</DialogTitle>
          <DialogDescription>
            Select a colleague to allocate {assetIds.length} selected product(s)
            to. They will be able to review and QA these products.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search colleagues..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Colleague Selection */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredColleagues.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? (
                <p>No colleagues found matching &quot;{searchTerm}&quot;</p>
              ) : (
                <div className="space-y-2">
                  <Users className="h-8 w-8 mx-auto text-muted-foreground/50" />
                  <p>No colleagues available</p>
                  <p className="text-sm">
                    Colleagues must share at least one client with you.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {filteredColleagues.map((colleague) => (
                <div
                  key={colleague.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedColleagueId === colleague.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedColleagueId(colleague.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {colleague.displayName}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {colleague.email}
                      </div>
                      {colleague.title && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {colleague.title}
                        </div>
                      )}
                    </div>
                    {selectedColleagueId === colleague.id && (
                      <div className="flex-shrink-0">
                        <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                          <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Selected Colleague Info */}
          {selectedColleague && (
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    Selected: {selectedColleague.displayName}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setSelectedColleagueId("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Products Count */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{assetIds.length}</Badge>
            <span>
              {assetIds.length === 1 ? "product" : "products"} selected
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setSelectedColleagueId("");
              setSearchTerm("");
            }}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAllocate}
            disabled={
              !selectedColleagueId || submitting || assetIds.length === 0
            }
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Allocating...
              </>
            ) : (
              `Allocate ${assetIds.length} Product${assetIds.length === 1 ? "" : "s"}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
