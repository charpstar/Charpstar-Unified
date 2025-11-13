"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/display";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/display";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/containers";
import {
  Upload,
  X,
  User,
  Users,
  Crown,
  Star,
  Heart,
  Zap,
  Target,
  Palette,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/contexts/useUser";

interface AvatarPickerProps {
  currentAvatar?: string;
  onAvatarChange: (avatarUrl: string | null) => void;
  onAvatarUpdateSuccess?: () => void;
  className?: string;
}

const presetAvatars = [
  { id: "default", icon: User, color: "bg-blue-500", label: "Default" },
  { id: "team", icon: Users, color: "bg-green-500", label: "Team" },
  { id: "premium", icon: Crown, color: "bg-yellow-500", label: "Premium" },
  { id: "star", icon: Star, color: "bg-purple-500", label: "Star" },
  { id: "heart", icon: Heart, color: "bg-pink-500", label: "Heart" },
  { id: "zap", icon: Zap, color: "bg-orange-500", label: "Zap" },
  { id: "target", icon: Target, color: "bg-red-500", label: "Target" },
  { id: "palette", icon: Palette, color: "bg-indigo-500", label: "Palette" },
];

export function AvatarPicker({
  currentAvatar,
  onAvatarChange,
  onAvatarUpdateSuccess,
  className,
}: AvatarPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(
    currentAvatar || null
  );
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const user = useUser();

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      return;
    }

    setIsUploading(true);
    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;

      const { error } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        console.error("Upload error:", error);
        throw error;
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(fileName);

      await handleAvatarChange(publicUrl);
    } catch (error) {
      console.error("Error uploading avatar:", error);
      alert("Failed to upload avatar. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handlePresetSelect = (avatarId: string) => {
    setSelectedAvatar(avatarId);
    onAvatarChange(avatarId);
    setIsOpen(false);
  };

  const handleRemoveAvatar = () => {
    setSelectedAvatar(null);
    onAvatarChange(null);
    setIsOpen(false);
  };

  const getInitials = (email: string) => {
    return email.split("@")[0].substring(0, 2).toUpperCase();
  };

  const renderAvatar = (avatar: string | null) => {
    if (!avatar) {
      return (
        <Avatar className="h-16 w-16 rounded-full">
          <AvatarFallback className="bg-primary/10 text-primary text-lg rounded-full">
            {getInitials(user?.email || "U")}
          </AvatarFallback>
        </Avatar>
      );
    }

    if (avatar.startsWith("http")) {
      return (
        <Avatar className="h-16 w-16 rounded-full">
          <AvatarImage src={avatar} alt="Profile" className="rounded-full" />
          <AvatarFallback className="bg-primary/10 text-primary text-lg rounded-full">
            {getInitials(user?.email || "U")}
          </AvatarFallback>
        </Avatar>
      );
    }

    // Preset avatar
    const preset = presetAvatars.find((p) => p.id === avatar);
    if (preset) {
      const IconComponent = preset.icon;
      return (
        <Avatar className="h-16 w-16 rounded-full">
          <AvatarFallback
            className={`${preset.color} text-white text-lg rounded-full`}
          >
            <IconComponent className="h-6 w-6" />
          </AvatarFallback>
        </Avatar>
      );
    }

    return (
      <Avatar className="h-16 w-16 rounded-full">
        <AvatarFallback className="bg-primary/10 text-primary text-lg rounded-full">
          {getInitials(user?.email || "U")}
        </AvatarFallback>
      </Avatar>
    );
  };

  const handleAvatarChange = async (avatarUrl: string | null) => {
    try {
      const response = await fetch("/api/users/avatar", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          avatar_url: avatarUrl,
          user_id: user?.id, // Send user ID for validation
        }),
      });

      if (response.ok) {
        setSelectedAvatar(avatarUrl);
        onAvatarChange(avatarUrl);
        setIsOpen(false);

        // Dispatch avatar update event for other components
        window.dispatchEvent(new CustomEvent("avatarUpdated"));

        // Call the success callback if provided
        if (onAvatarUpdateSuccess) {
          onAvatarUpdateSuccess();
        }
      } else {
        console.error("Failed to update avatar");
      }
    } catch (error) {
      console.error("Error updating avatar:", error);
    }
  };

  return (
    <div className={className}>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="p-0 h-auto w-auto rounded-full">
            <div className="relative group">
              {renderAvatar(selectedAvatar)}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                <Upload className="h-6 w-6 text-white" />
              </div>
            </div>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md h-full sm:h-auto sm:max-w-md sm:min-h-0 sm:max-h-[60vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Choose Profile Picture</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Upload Section */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Upload Custom Image</h3>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full"
                size="sm"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? "Uploading..." : "Choose File"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <p className="text-xs text-muted-foreground">
                JPG, PNG, GIF up to 5MB
              </p>
            </div>

            {/* Preset Avatars */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Choose Preset</h3>
              <div className="grid grid-cols-4 gap-2 items-center justify-center">
                {presetAvatars.map((preset) => {
                  const IconComponent = preset.icon;
                  return (
                    <Button
                      key={preset.id}
                      variant="outline"
                      size="sm"
                      onClick={() => handlePresetSelect(preset.id)}
                      className={`h-10 w-10 p-0 ${preset.color} hover:opacity-80`}
                    >
                      <IconComponent className="h-4 w-4 text-white" />
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Remove Avatar */}
            {selectedAvatar && (
              <div className="pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={handleRemoveAvatar}
                  className="w-full text-destructive hover:text-destructive"
                  size="sm"
                >
                  <X className="h-4 w-4 mr-2" />
                  Remove Avatar
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
