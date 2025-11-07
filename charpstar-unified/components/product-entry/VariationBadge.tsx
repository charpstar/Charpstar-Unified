"use client";

import { Badge } from '@/components/ui/feedback/badge';

interface VariationBadgeProps {
  type: 'color' | 'size' | 'material' | 'finish' | 'other';
  value: string;
}

const variationEmojis: Record<string, string> = {
  color: '🎨',
  size: '📏',
  material: '🪵',
  finish: '✨',
  other: '📌'
};

const colorMap: Record<string, string> = {
  white: 'bg-gray-100 text-gray-800 border-gray-300',
  black: 'bg-gray-900 text-white border-gray-700',
  red: 'bg-red-100 text-red-800 border-red-300',
  blue: 'bg-blue-100 text-blue-800 border-blue-300',
  green: 'bg-green-100 text-green-800 border-green-300',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  brown: 'bg-amber-100 text-amber-800 border-amber-300',
  gray: 'bg-gray-200 text-gray-700 border-gray-400',
  grey: 'bg-gray-200 text-gray-700 border-gray-400',
  beige: 'bg-stone-100 text-stone-800 border-stone-300',
  ivory: 'bg-amber-50 text-amber-900 border-amber-200',
  cream: 'bg-yellow-50 text-yellow-900 border-yellow-200',
  navy: 'bg-blue-900 text-white border-blue-700',
  pink: 'bg-pink-100 text-pink-800 border-pink-300',
  orange: 'bg-orange-100 text-orange-800 border-orange-300',
  purple: 'bg-purple-100 text-purple-800 border-purple-300'
};

export function VariationBadge({ type, value }: VariationBadgeProps) {
  const emoji = variationEmojis[type] || '📌';
  const lowerValue = value.toLowerCase();
  
  // Special styling for colors
  const colorClass = type === 'color' && colorMap[lowerValue] 
    ? colorMap[lowerValue]
    : 'bg-muted text-muted-foreground border-border';

  return (
    <Badge
      variant="outline"
      className={`text-xs px-1.5 py-0.5 font-medium ${colorClass}`}
      title={`${type}: ${value}`}
    >
      <span className="mr-1">{emoji}</span>
      {value}
    </Badge>
  );
}




