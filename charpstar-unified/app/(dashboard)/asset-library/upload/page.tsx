"use client";

import { Button } from "@/components/ui/display";
import { BatchUploadSheet } from "@/components/asset-library/components/batch-upload-sheet";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const router = useRouter();

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href="/asset-library">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Upload Assets</h1>
        </div>

        <div className="mt-4">
          <BatchUploadSheet
            onSuccess={() => {
              router.push("/asset-library");
            }}
          />
        </div>
      </div>
    </div>
  );
}
