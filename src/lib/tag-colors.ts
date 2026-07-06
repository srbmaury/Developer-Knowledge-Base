import type { TagColor } from "@/types/knowledge";

export const TAG_COLORS: TagColor[] = [
  "gray", "red", "orange", "yellow", "green", "blue", "purple", "pink"
];

export const TAG_COLOR_CLASSES: Record<TagColor, string> = {
  gray:   "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  red:    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  green:  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  blue:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  pink:   "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
};

export const TAG_DOT_CLASSES: Record<TagColor, string> = {
  gray:   "bg-gray-400",
  red:    "bg-red-500",
  orange: "bg-orange-500",
  yellow: "bg-yellow-500",
  green:  "bg-green-500",
  blue:   "bg-blue-500",
  purple: "bg-purple-500",
  pink:   "bg-pink-500",
};
