import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Download, Heart } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";

interface Asset {
  id: string;
  product_name: string;
  preview_image: string;
  category: string;
  subcategory: string;
}

export default function AssetCard({ asset }: { asset: Asset }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [liked, setLiked] = useState(false);

  return (
    <motion.div
      initial={{ y: 15, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      whileHover={{
        scale: 1.02,
        rotateX: 2,
        boxShadow: "0 6px 36px rgba(0,0,0,0.08)",
      }}
      transition={{ type: "spring", stiffness: 210, damping: 20 }}
      className="group"
    >
      <Card className="relative flex flex-col h-full min-h-[220px] min-w-[220px] overflow-hidden border border-border/50 transition-all duration-300 bg-white dark:bg-black/90 shadow-sm">
        {/* Like button */}
        <button
          onClick={() => setLiked((v) => !v)}
          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-white/90 dark:bg-black/70 hover:bg-primary/10 transition"
          aria-label={liked ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart
            className={`h-5 w-5 ${liked ? "text-rose-500 fill-rose-500" : "text-border"}`}
          />
        </button>

        <CardHeader className="flex-shrink-0 p-2">
          <div className="relative rounded-xl overflow-hidden bg-white dark:bg-black">
            {/* Image skeleton loader */}
            {!imgLoaded && (
              <Skeleton className="w-full h-36 absolute inset-0" />
            )}
            <motion.img
              src={asset.preview_image || "/placeholder.png"}
              alt={asset.product_name}
              className={`w-full h-36 object-contain transition-transform duration-500 ${
                imgLoaded ? "scale-100" : "scale-105 blur-sm"
              } group-hover:scale-105`}
              onLoad={() => setImgLoaded(true)}
              whileHover={{ scale: 1.08 }}
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
        </CardHeader>

        <CardContent className="flex-1 flex flex-col justify-between items-center gap-3 p-3">
          <div className="w-full">
            <CardTitle className="line-clamp-1 font-bold text-base text-center mb-2 transition-colors group-hover:text-primary">
              {asset.product_name}
            </CardTitle>
            <div className="flex flex-wrap justify-center gap-1">
              <Badge
                variant="secondary"
                className="flex items-center gap-1 text-xs font-medium transition group-hover:bg-primary/10"
              >
                {/* Insert category icon here if desired */}
                {asset.category}
              </Badge>
              {asset.subcategory && (
                <Badge
                  variant="outline"
                  className="text-xs font-medium group-hover:border-primary/50"
                >
                  {asset.subcategory}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-1 mt-2 justify-center">
              {asset.materials?.map((m) => (
                <Badge
                  key={m}
                  variant="secondary"
                  className="text-xs group-hover:bg-primary/10 transition-all"
                >
                  {m.replace(/[[\]"]/g, "")}
                </Badge>
              ))}
              {asset.colors?.map((c) => (
                <Badge
                  key={c}
                  variant="outline"
                  className="text-xs group-hover:border-primary/60 transition-all"
                >
                  {c.replace(/[[\]"]/g, "")}
                </Badge>
              ))}
            </div>
          </div>
          {/* Actions: Buttons as animated overlay */}
          <motion.div
            className="flex w-full gap-2 justify-between pt-2"
            initial={{ y: 10, opacity: 0 }}
            whileHover={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 group/btn dark:bg-muted dark:text-white transition-all hover:scale-105"
                  asChild
                >
                  <Link
                    href={`/asset-library/${asset.id}`}
                    className="flex items-center justify-center gap-1"
                    prefetch={true}
                  >
                    View
                    <ExternalLink className="h-4 w-4 ml-1" />
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
                  className="h-9 w-9 hover:bg-muted/70 hover:scale-110 group/download"
                  asChild
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
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
