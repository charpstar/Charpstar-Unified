"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Input } from "@/components/ui/inputs";
import { Label } from "@/components/ui/display";
import { Plus, X } from "lucide-react";
import { useToast } from "@/components/ui/utilities";

interface EditCompaniesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
  onSuccess?: () => void;
}

export function EditCompaniesDialog({
  isOpen,
  onClose,
  userId,
  userEmail,
  onSuccess,
}: EditCompaniesDialogProps) {
  const [companies, setCompanies] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && userId) {
      fetchCompanies();
    }
  }, [isOpen, userId]);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}/companies`);
      if (!response.ok) {
        throw new Error("Failed to fetch companies");
      }
      const data = await response.json();
      setCompanies(
        data.companies && data.companies.length > 0 ? data.companies : [""]
      );
    } catch (error) {
      console.error("Error fetching companies:", error);
      toast({
        title: "Error",
        description: "Failed to load companies",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const validCompanies = companies.filter((c) => c.trim());

      if (validCompanies.length === 0) {
        toast({
          title: "Error",
          description: "Please add at least one company",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(`/api/users/${userId}/companies`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ companies: validCompanies }),
      });

      if (!response.ok) {
        throw new Error("Failed to update companies");
      }

      toast({
        title: "Success",
        description: "Companies updated successfully",
      });

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Error updating companies:", error);
      toast({
        title: "Error",
        description: "Failed to update companies",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addCompany = () => {
    setCompanies([...companies, ""]);
  };

  const removeCompany = (index: number) => {
    if (companies.length > 1) {
      setCompanies(companies.filter((_, i) => i !== index));
    }
  };

  const updateCompany = (index: number, value: string) => {
    const newCompanies = [...companies];
    newCompanies[index] = value;
    setCompanies(newCompanies);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Companies - {userEmail}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Companies / Brands *
                </Label>
                {companies.map((company, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={company}
                      onChange={(e) => updateCompany(index, e.target.value)}
                      placeholder={`Company ${index + 1}`}
                      className="flex-1"
                    />
                    {companies.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removeCompany(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCompany}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Another Company
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                This user will have access to products from all listed
                companies. Products will be fetched using{" "}
                <code className="bg-muted px-1 py-0.5 rounded">
                  .in(&quot;client&quot;, companies)
                </code>
              </p>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={onClose} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                      Saving...
                    </>
                  ) : (
                    "Save Companies"
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
