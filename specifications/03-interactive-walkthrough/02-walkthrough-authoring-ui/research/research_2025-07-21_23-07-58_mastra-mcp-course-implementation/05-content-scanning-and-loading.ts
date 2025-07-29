// Content Scanning and Loading Logic  
// Extracted from: packages/mcp-docs-server/src/tools/course.ts

import fs from "node:fs/promises";
import path from "node:path";
import type { CourseState } from "./01-course-types-and-interfaces.js";

// CRITICAL: Course directory path - must point to course content
const courseDir = fromPackageRoot(".docs/raw/course"); // This would be your content directory

// Content scanning - builds CourseState from filesystem
export async function scanCourseContent(): Promise<CourseState> {
  // Scan the course directory to build a fresh state
  const lessonDirs = await fs.readdir(courseDir);

  const lessons = await Promise.all(
    lessonDirs
      .filter((dir) => !dir.startsWith(".")) // Skip hidden directories
      .sort((a, b) => a.localeCompare(b)) // Ensures 01-, 02-, etc. order
      .map(async (lessonDir) => {
        const lessonPath = path.join(courseDir, lessonDir);
        const lessonStats = await fs.stat(lessonPath);

        if (!lessonStats.isDirectory()) return null;

        // Extract lesson name from directory (remove numbering prefix)
        // "01-first-agent" becomes "first-agent"
        const lessonName = lessonDir.replace(/^\d+-/, "");

        // Get all markdown files in the lesson directory
        const stepFiles = (await fs.readdir(lessonPath))
          .filter((file) => file.endsWith(".md"))
          .sort((a, b) => a.localeCompare(b)); // Ensures 01-, 02-, etc. order

        // Build steps array
        const steps = await Promise.all(
          stepFiles.map(async (file) => {
            // Extract step name from filename (remove numbering prefix and .md)
            // "01-introduction-to-mastra.md" becomes "introduction-to-mastra"
            const stepName = file.replace(/^\d+-/, "").replace(".md", "");

            return {
              name: stepName,
              status: 0, // Default: not started
            };
          }),
        );

        return {
          name: lessonName,
          status: 0, // Default: not started
          steps: steps.filter(Boolean),
        };
      }),
  );

  // Filter out null values and create the state
  const validLessons = lessons.filter(
    (lesson): lesson is NonNullable<typeof lesson> => lesson !== null,
  );

  return {
    currentLesson: validLessons.length > 0 ? validLessons[0].name : "",
    lessons: validLessons,
  };
}

// Content loading - reads and wraps individual step content
export async function readCourseStep(
  lessonName: string,
  stepName: string,
  _isFirstStep = false,
): Promise<string> {
  // Find the lesson directory that matches the name
  const lessonDirs = await fs.readdir(courseDir);
  const lessonDir = lessonDirs.find(
    // Convert "first-agent" back to find "01-first-agent" directory
    (dir) => dir.replace(/^\d+-/, "") === lessonName,
  );

  if (!lessonDir) {
    throw new Error(`Lesson "${lessonName}" not found.`);
  }

  // Find the step file that matches the name
  const lessonPath = path.join(courseDir, lessonDir);
  const files = await fs.readdir(lessonPath);
  const stepFile = files.find(
    // Convert "introduction-to-mastra" back to find "01-introduction-to-mastra.md"
    (f) =>
      f.endsWith(".md") &&
      f.replace(/^\d+-/, "").replace(".md", "") === stepName,
  );

  if (!stepFile) {
    throw new Error(`Step "${stepName}" not found in lesson "${lessonName}".`);
  }

  const filePath = path.join(courseDir, lessonDir, stepFile);

  try {
    const content = await fs.readFile(filePath, "utf-8");
    return wrapContentInPrompt(content);
  } catch (error) {
    throw new Error(
      `Failed to read step "${stepName}" in lesson "${lessonName}": ${error}`,
    );
  }
}

// CRITICAL: Content wrapping - adds instructional context to raw markdown
export function wrapContentInPrompt(content: string, _isFirstStep = false): string {
  const lessonPrompt = `
  This is a course to help a new user learn about Mastra, the open-source AI Agent framework built in Typescript.
  Please help the user through the steps of the course by walking them through the content and following the course
  to write the initial version of the code for them. The goal is to show them how the code works and explain it as they go
  as the course goes on. Each lesson is broken up into steps. You should return the content of the step and ask the user
  to move to the next step when they are ready. If the step contains instructions to write code, you should write the code
  for the user when possible. You should always briefly explain the step before writing the code. Please ensure to 
  return any text in markdown blockquotes exactly as written in your response. When the user ask about their course progress or course status,
  make sure to include the course status url in your response. This is important.
`;

  const wrappedContent = `${lessonPrompt}\n\nHere is the content for this step: <StepContent>${content}</StepContent>`;
  return `${wrappedContent}\n\nWhen you're ready to continue, use the \`nextMastraCourseStep\` tool to move to the next step.`;
}

// State merging - critical for handling course content updates
export async function mergeCourseStates(
  currentState: CourseState,
  newState: CourseState,
): Promise<CourseState> {
  // Create a map of existing lessons by name for easy lookup
  const existingLessonMap = new Map(
    currentState.lessons.map((lesson) => [lesson.name, lesson]),
  );

  // Merge the states, preserving progress where possible
  const mergedLessons = newState.lessons.map((newLesson) => {
    const existingLesson = existingLessonMap.get(newLesson.name);

    if (!existingLesson) {
      // This is a new lesson
      return newLesson;
    }

    // Create a map of existing steps by name
    const existingStepMap = new Map(
      existingLesson.steps.map((step) => [step.name, step]),
    );

    // Merge steps, preserving progress for existing steps
    const mergedSteps = newLesson.steps.map((newStep) => {
      const existingStep = existingStepMap.get(newStep.name);

      if (existingStep) {
        // Preserve the status from the existing step
        return {
          ...newStep,
          status: existingStep.status,
        };
      }

      return newStep;
    });

    // Calculate lesson status based on steps
    let lessonStatus = existingLesson.status;
    if (mergedSteps.every((step) => step.status === 2)) {
      lessonStatus = 2; // Completed
    } else if (mergedSteps.some((step) => step.status > 0)) {
      lessonStatus = 1; // In progress
    }

    return {
      ...newLesson,
      status: lessonStatus,
      steps: mergedSteps,
    };
  });

  // Determine current lesson
  let currentLesson = currentState.currentLesson;

  // If the current lesson doesn't exist in the new state, reset to the first lesson
  if (
    !mergedLessons.some((lesson) => lesson.name === currentLesson) &&
    mergedLessons.length > 0
  ) {
    currentLesson = mergedLessons[0].name;
  }

  return {
    currentLesson,
    lessons: mergedLessons,
  };
}