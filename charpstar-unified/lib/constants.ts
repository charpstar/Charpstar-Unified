// Global constants for status labels

export const STATUS_LABELS = {
  in_production: "In Production",
  revisions: "Ready for Revision",
  approved: "Approved",
  delivered_by_artist: "Delivered by Artist",
} as const;

export type StatusKey = keyof typeof STATUS_LABELS;

export const PRIORITY_LABELS = {
  1: "High",
  2: "Medium",
  3: "Low",
} as const;

export type PriorityLevel = keyof typeof PRIORITY_LABELS;

// Helper function for priority labels
export const getPriorityLabel = (priority: number): string => {
  return PRIORITY_LABELS[priority as PriorityLevel] || PRIORITY_LABELS[3];
};
