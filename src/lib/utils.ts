import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
