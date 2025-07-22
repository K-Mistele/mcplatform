// Core Course Data Structures
// Extracted from: packages/mcp-docs-server/src/tools/course.ts

import { z } from "zod";

// Schema definitions for tool parameters
export const courseLessonSchema = z.object({
  lessonName: z
    .string()
    .describe(
      "Name of the specific lesson to start. It must match the exact lesson name.",
    ),
});

export const confirmationSchema = z.object({
  confirm: z
    .boolean()
    .optional()
    .describe("Set to true to confirm this action"),
});

// Core CourseState type - this is the central data structure
export type CourseState = {
  currentLesson: string;
  lessons: Array<{
    name: string;
    status: number; // 0 = not started, 1 = in progress, 2 = completed
    steps: Array<{
      name: string;
      status: number; // 0 = not started, 1 = in progress, 2 = completed
    }>;
  }>;
};

// Status constants for clarity
export const STATUS = {
  NOT_STARTED: 0,
  IN_PROGRESS: 1, 
  COMPLETED: 2
} as const;

// Device credentials type for authentication
export type DeviceCredentials = {
  deviceId: string;
  key: string;
} | null;

// API response types
export type RegistrationResponse = {
  success: boolean;
  id: string;
  key: string;
  message: string;
};

// Tool parameter types (inferred from Zod schemas)
export type CourseLessonParams = z.infer<typeof courseLessonSchema>;
export type ConfirmationParams = z.infer<typeof confirmationSchema>;