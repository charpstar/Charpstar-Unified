import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import { Download, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeletons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/display";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";

interface Asset {
  id: string;
  product_name: string;
  preview_image: string;
  category: string;
  subcategory: string;
  materials?: string[];
  colors?: string[];
  client?: string;
  glb_link?: string;
}

interface AssetCardProps {
  asset: Asset;
  isBatchEditMode?: boolean;
  isSelected?: boolean;
  onSelect?: (assetId: string) => void;
  viewMode?: "grid" | "compactGrid";
}

export default function AssetCard({
  asset,
  isBatchEditMode = false,
  isSelected = false,
  onSelect,
  viewMode = "grid",
}: AssetCardProps) {
  const [imgLoaded, setImgLoaded] = useState(false);

  const isCompactMode = viewMode === "compactGrid";

  return (
    <motion.div
      initial={{ y: 15, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      whileHover={{
        scale: isCompactMode ? 1.01 : 1.02,

        boxShadow: "0 6px 36px rgba(0,0,0,0.08)",
      }}
      className="group"
    >
      <Card
        className={`relative overflow-hidden border border-border/50 transition-all duration-300 bg-white dark:bg-black/90 shadow-sm ${
          isCompactMode
            ? "flex flex-row h-76 min-w-full"
            : "flex flex-col min-h-[220px] min-w-[220px]"
        }`}
      >
        {/* Selection checkbox */}
        {isBatchEditMode && (
          <div
            className={`absolute z-20 ${
              isCompactMode ? "top-4 left-4" : "top-3 left-3"
            }`}
          >
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect?.(asset.id);
              }}
              className={`rounded-full transition-all duration-200 border-2 shadow-lg ${
                isSelected
                  ? "bg-primary border-primary text-primary-foreground scale-110"
                  : "bg-white/95 dark:bg-black/90 border-border hover:border-primary hover:bg-primary/10 "
              } ${isCompactMode ? "p-2" : "p-2.5"}`}
              aria-label={isSelected ? "Deselect asset" : "Select asset"}
            >
              <Check
                className={`${isCompactMode ? "h-4 w-4" : "h-5 w-5"} ${isSelected ? "opacity-100" : "opacity-0"}`}
              />
            </button>
          </div>
        )}

        {isCompactMode ? (
          // Horizontal layout for compact mode
          <>
            {/* Image section */}
            <div className="flex-shrink-0 w-50 h-60 p-3">
              <Link
                href={`/asset-library/${asset.id}`}
                className="block w-full h-full"
              >
                <div className="relative rounded-xl overflow-hidden bg-white dark:bg-black w-full h-full cursor-pointer">
                  {!imgLoaded && (
                    <Skeleton className="w-full h-full absolute inset-0" />
                  )}
                  <motion.img
                    src={asset.preview_image || "/placeholder.png"}
                    alt={asset.product_name}
                    className={`w-full h-full object-contain transition-transform duration-500 ${
                      imgLoaded ? "scale-100" : "scale-105 blur-sm"
                    }`}
                    onLoad={() => setImgLoaded(true)}
                    draggable={false}
                  />
                </div>
              </Link>
            </div>

            {/* Content section */}
            <div className="flex-1 flex flex-col justify-between p-4 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <CardTitle className="line-clamp-1 font-bold text-lg transition-colors group-hover:text-primary mb-2">
                    {asset.product_name}
                  </CardTitle>

                  {/* Category and Subcategory */}
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        Category:
                      </span>
                      <Badge variant="secondary" className="text-sm">
                        {asset.category}
                      </Badge>
                    </div>
                    {asset.subcategory && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          Type:
                        </span>
                        <Badge variant="outline" className="text-sm">
                          {asset.subcategory}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Materials Section */}
                  {asset.materials && asset.materials.length > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-foreground">
                          Materials:
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {asset.materials?.slice(0, 5).map((m) => (
                          <Badge
                            key={m}
                            variant="secondary"
                            className="text-sm group-hover:bg-primary/10 transition-all"
                          >
                            {m.replace(/[[\]"]/g, "")}
                          </Badge>
                        ))}
                        {asset.materials.length > 5 && (
                          <Badge variant="outline" className="text-sm">
                            +{asset.materials.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Colors Section */}
                  {asset.colors && asset.colors.length > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-foreground">
                          Colors:
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {asset.colors?.slice(0, 4).map((c) => (
                          <Badge
                            key={c}
                            variant="outline"
                            className="text-sm group-hover:border-primary/60 transition-all"
                          >
                            {c.replace(/[[\]"]/g, "")}
                          </Badge>
                        ))}
                        {asset.colors.length > 4 && (
                          <Badge variant="outline" className="text-sm">
                            +{asset.colors.length - 4} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Additional Info */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span>ID:</span>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {asset.id.slice(0, 8)}...
                      </code>
                    </div>
                    {asset.glb_link && (
                      <div className="flex items-center gap-1">
                        <span>3D Model:</span>
                        <Badge variant="secondary" className="text-xs">
                          Available
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col items-center gap-3 flex-shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="default"
                        className="group/btn dark:bg-muted dark:text-white  w-24"
                      >
                        <Link
                          href={`/asset-library/${asset.id}`}
                          className="flex items-center justify-center gap-2"
                          prefetch={true}
                        >
                          View
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>View product details</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="default"
                        className="w-24 hover:bg-muted/70 "
                        disabled={!asset.glb_link}
                      >
                        <a
                          href={asset.glb_link}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Download 3D Model"
                          className="flex items-center justify-center gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </a>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Download 3D model</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </>
        ) : (
          // Original vertical layout for grid mode
          <>
            <CardHeader
              className={`flex-shrink-0 ${isCompactMode ? "p-1" : "p-2"}`}
            >
              <Link
                href={`/asset-library/${asset.id}`}
                className="block w-full h-full"
              >
                <div className="relative rounded-xl overflow-hidden bg-white dark:bg-black w-full h-full cursor-pointer">
                  {/* Image skeleton loader */}
                  {!imgLoaded && (
                    <Skeleton
                      className={`w-full absolute inset-0 ${isCompactMode ? "h-24" : "h-36"}`}
                    />
                  )}
                  <motion.img
                    src={asset.preview_image || "/placeholder.png"}
                    alt={asset.product_name}
                    className={`w-full object-contain transition-transform duration-500 ${
                      imgLoaded ? "scale-100" : "scale-105 blur-sm"
                    } ${isCompactMode ? "h-24" : "h-36"}`}
                    onLoad={() => setImgLoaded(true)}
                    draggable={false}
                  />
                  {/* Overlay gradient */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                    className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent pointer-events-none"
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </Link>
            </CardHeader>

            <CardContent
              className={`flex-1 flex flex-col justify-between items-center gap-3 ${isCompactMode ? "p-2" : "p-3"}`}
            >
              <div className="w-full">
                <CardTitle
                  className={`line-clamp-1 font-bold text-center mb-2 transition-colors group-hover:text-primary ${
                    isCompactMode ? "text-sm" : "text-base"
                  }`}
                >
                  {asset.product_name}
                </CardTitle>
                {!isCompactMode && (
                  <>
                    <div className="flex flex-wrap justify-center gap-1">
                      {asset.client && (
                        <Badge
                          variant="secondary"
                          className="flex items-center gap-1 text-xs font-medium transition group-hover:bg-primary/10"
                        >
                          {asset.client}
                        </Badge>
                      )}
                    </div>
                  </>
                )}
              </div>
              {/* Actions: Buttons */}
              <div
                className={`flex w-full gap-2 justify-between ${isCompactMode ? "pt-1" : "pt-2"}`}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size={isCompactMode ? "sm" : "sm"}
                      className="flex-1 group/btn dark:bg-muted dark:text-white transition-all "
                    >
                      <Link
                        href={`/asset-library/${asset.id}`}
                        className="flex items-center justify-center gap-1"
                        prefetch={true}
                      >
                        {isCompactMode ? "View" : "View"}
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>View product details</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 hover:bg-muted/70  group/download "
                      disabled={!asset.glb_link}
                    >
                      <a
                        href={asset.glb_link}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Download 3D Model"
                        className="flex items-center justify-center"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Download 3D model</TooltipContent>
                </Tooltip>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </motion.div>
  );
}
