"use client";

import { Suspense } from "react";
import { Button } from "@/components/ui/display";
import { BatchUploadSheet } from "@/components/asset-library/components/batch-upload-sheet";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function UploadPageContent() {
  const router = useRouter();

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Link href="/asset-library">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
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

export default function UploadPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <UploadPageContent />
    </Suspense>
  );
}
