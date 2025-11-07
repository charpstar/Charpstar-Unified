"use client";

import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/feedback/badge';

interface ProductGroupHeaderProps {
  baseProductName: string;
  variationCount: number;
  variationTypes: string[];
  isExpanded: boolean;
  onToggle: () => void;
}

const variationEmojis: Record<string, string> = {
  color: '🎨',
  size: '📏',
  material: '🪵',
  finish: '✨',
  other: '📌'
};

export function ProductGroupHeader({
  baseProductName,
  variationCount,
  variationTypes,
  isExpanded,
  onToggle
}: ProductGroupHeaderProps) {
  const variationTypesStr = variationTypes
    .map(type => `${variationEmojis[type] || '📌'} ${type.charAt(0).toUpperCase() + type.slice(1)}`)
    .join(' | ');

  return (
    <div
      className="flex items-center gap-3 px-4 py-3
        bg-gradient-to-r from-primary/5 via-primary/3 to-transparent
        border-l-4 border-primary
        cursor-pointer
        hover:from-primary/10 hover:via-primary/5
        transition-colors duration-200"
      onClick={onToggle}
    >
      <div className="flex items-center gap-2 text-primary">
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </div>
      
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">
            {baseProductName}
          </span>
          <Badge variant="outline" className="text-xs">
            {variationCount} variation{variationCount > 1 ? 's' : ''}
          </Badge>
        </div>
        {variationTypes.length > 0 && (
          <div className="text-xs text-muted-foreground mt-1">
            {variationTypesStr}
          </div>
        )}
      </div>
    </div>
  );
}




