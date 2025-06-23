import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface SavePasswordDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => boolean;
  message?: string;
}

const SavePasswordDialog: React.FC<SavePasswordDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  message = "Please enter your password to confirm saving changes to live.",
}) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Password is required");
      return;
    }

    const isCorrect = onConfirm(password);
    if (!isCorrect) {
      setError("Incorrect password. Please try again.");
    }
  };

  const handleClose = () => {
    setPassword("");
    setError("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card rounded-lg shadow-xl p-6 max-w-md w-full mx-4 relative border border-border">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={20} />
        </button>

        <h3 className="text-lg font-medium text-foreground mb-4">
          Confirm Save to Live
        </h3>

        <p className="text-sm text-muted-foreground mb-4">{message}</p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <Input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              className={error ? "border-destructive" : ""}
              autoFocus
            />
            {error && <p className="text-destructive text-sm mt-1">{error}</p>}
          </div>

          <div className="flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" variant="default" disabled={!password.trim()}>
              Confirm Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SavePasswordDialog;
