// Complete MCP Course Tool Implementations
// Extracted and condensed from: packages/mcp-docs-server/src/tools/course.ts

import { z } from "zod";
import type { MCPTool } from "./02-mcp-server-setup.js";
import { 
  courseLessonSchema, 
  confirmationSchema,
  type CourseLessonParams, 
  type ConfirmationParams,
  type CourseState 
} from "./01-course-types-and-interfaces.js";
import {
  getDeviceCredentials,
  getDeviceId,
  loadCourseState,
  saveCourseState,
  saveDeviceCredentials
} from "./03-state-management-core.js";
import { registerUser } from "./04-api-communication.js";
import { 
  scanCourseContent, 
  readCourseStep, 
  mergeCourseStates 
} from "./05-content-scanning-and-loading.js";
import { 
  introductionPrompt,
  buildStatusReport 
} from "./06-course-prompts-and-templates.js";

// TOOL 1: Start Mastra Course
export const startMastraCourse: MCPTool = {
  name: "startMastraCourse",
  description: "Starts the Mastra Course. If the user is not registered, they will be prompted to register first. Otherwise, it will start at the first lesson or pick up where they last left off. ALWAYS ask the user for their email address if they are not registered. DO NOT assume their email address, they must confirm their email and that they want to register.",
  parameters: z.object({
    email: z
      .string()
      .email()
      .optional()
      .describe("Email address for registration if not already registered. "),
  }),
  execute: async (args: { email?: string }) => {
    try {
      // Check if the user is registered
      const creds = await getDeviceCredentials();
      const registered = creds !== null;
      let deviceId = creds?.deviceId ?? null;
      
      if (!registered) {
        // If not registered and no email provided, prompt for email
        if (!args.email) {
          return "To start the Mastra Course, you need to register first. Please provide your email address by calling this tool again with the email parameter.";
        }

        // User provided email, register them
        try {
          const response = await registerUser(args.email);

          if (response.success) {
            // Save both deviceId and key
            await saveDeviceCredentials(response.id, response.key);
            deviceId = response.id;
          } else {
            return `Registration failed: ${response.message}. Please try again with a valid email address.`;
          }
        } catch (error) {
          return `Failed to register: ${error instanceof Error ? error.message : String(error)}. Please try again later.`;
        }
      }

      // Try to load the user's course progress
      let courseState = await loadCourseState();
      let statusMessage = "";

      // Get the latest course content structure
      const latestCourseState = await scanCourseContent();

      if (!latestCourseState.lessons.length) {
        return "No course content found. Please make sure the course content is properly set up in the .docs/course/lessons directory.";
      }

      if (courseState) {
        // User has existing progress, merge with latest content
        const previousState = JSON.parse(JSON.stringify(courseState)) as CourseState; // Deep clone for comparison
        courseState = await mergeCourseStates(courseState, latestCourseState);

        // Check if there are differences in the course structure
        const newLessons = latestCourseState.lessons.filter(
          (newLesson) =>
            !previousState.lessons.some(
              (oldLesson: { name: string }) =>
                oldLesson.name === newLesson.name,
            ),
        );

        if (newLessons.length > 0) {
          statusMessage = `📚 Course content has been updated! ${newLessons.length} new lesson(s) have been added:\n`;
          statusMessage += newLessons
            .map((lesson) => `- ${lesson.name}`)
            .join("\n");
          statusMessage += "\n\n";
        }

        // Save the merged state
        await saveCourseState(courseState, deviceId);
      } else {
        // First time user, create new state
        courseState = latestCourseState;
        await saveCourseState(courseState, deviceId);

        // Check if this is a new registration
        if (!registered && args.email) {
          // Just return the introduction prompt.
          return introductionPrompt;
        }
      }

      // Find the current lesson and step
      const currentLessonName = courseState.currentLesson;
      const currentLesson = courseState.lessons.find(
        (lesson) => lesson.name === currentLessonName,
      );

      if (!currentLesson) {
        return "Error: Current lesson not found in course content. Please try again or reset your course progress.";
      }

      // Find the first incomplete step in the current lesson
      const currentStep = currentLesson.steps.find((step) => step.status !== 2);

      if (!currentStep && currentLesson.status !== 2) {
        // Mark the lesson as completed if all steps are done
        currentLesson.status = 2;
        await saveCourseState(courseState, deviceId);

        // Find the next lesson that's not completed
        const nextLesson = courseState.lessons.find(
          (lesson) => lesson.status !== 2 && lesson.name !== currentLessonName,
        );

        if (nextLesson) {
          courseState.currentLesson = nextLesson.name;
          await saveCourseState(courseState, deviceId);

          return `${statusMessage}🎉 You've completed the "${currentLessonName}" lesson!\n\nMoving on to the next lesson: "${nextLesson.name}".\n\nUse the \`nextMastraCourseStep\` tool to start the first step of this lesson.`;
        } else {
          return `${statusMessage}🎉 Congratulations! You've completed all available lessons in the Mastra Course!\n\nIf you'd like to review any lesson, use the \`startMastraCourseLesson\` tool with the lesson name.`;
        }
      }

      if (!currentStep) {
        // This should not happen, but just in case
        return `${statusMessage}Error: No incomplete steps found in the current lesson. Please try another lesson or reset your course progress.`;
      }

      // Mark the step as in progress
      currentStep.status = 1;

      // If the lesson is not in progress, mark it as in progress
      if (currentLesson.status === 0) {
        currentLesson.status = 1;
      }

      // Save the updated state
      await saveCourseState(courseState, deviceId);

      // Get the content for the current step
      const stepContent = await readCourseStep(
        currentLessonName,
        currentStep.name,
      );

      return `📘 Lesson: ${currentLessonName}\n📝 Step: ${currentStep.name}\n\n${stepContent}\n\nWhen you've completed this step, use the \`nextMastraCourseStep\` tool to continue.`;
    } catch (error) {
      return `Error starting the Mastra course: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};

// TOOL 2: Get Course Status
export const getMastraCourseStatus: MCPTool = {
  name: "getMastraCourseStatus",
  description: "Gets the current status of the Mastra Course, including which lessons and steps have been completed",
  parameters: z.object({}),
  execute: async (_args: Record<string, never>) => {
    try {
      // Check if the user is registered
      const deviceId = await getDeviceId();

      if (deviceId === null) {
        return "You need to register for the Mastra Course first. Please use the `startMastraCourse` tool to register.";
      }

      // Load the course state
      const courseState = await loadCourseState();

      if (!courseState) {
        return "No course progress found. Please start the course first using the `startMastraCourse` tool.";
      }

      // Get the latest course content structure to ensure we have the most up-to-date information
      const latestCourseState = await scanCourseContent();

      if (!latestCourseState.lessons.length) {
        return "No course content found. Please make sure the course content is properly set up in the .docs/course/lessons directory.";
      }

      // Merge the states to ensure we have the latest content with the user's progress
      const mergedState = await mergeCourseStates(courseState, latestCourseState);

      // Build a formatted status report
      const statusReport = buildStatusReport(mergedState, deviceId);

      return `Course Status: ${statusReport}\n\nCourse status url: https://mastra.ai/course/${deviceId}`;
    } catch (error) {
      return `Error getting course status: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};

// TOOL 3: Start Specific Lesson
export const startMastraCourseLesson: MCPTool = {
  name: "startMastraCourseLesson",
  description: "Starts a specific lesson in the Mastra Course. If the lesson has been started before, it will resume from the first incomplete step",
  parameters: courseLessonSchema,
  execute: async (args: CourseLessonParams) => {
    try {
      // Check if the user is registered
      const deviceId = await getDeviceId();

      if (deviceId === null) {
        return "You need to register for the Mastra Course first. Please use the `startMastraCourse` tool to register.";
      }

      // Load the current course state
      const courseState = await loadCourseState();

      if (!courseState) {
        return "No course progress found. Please start the course first using the `startMastraCourse` tool.";
      }

      // Find the target lesson by name
      const targetLessonName = args.lessonName;

      // Find the target lesson
      const targetLesson = courseState.lessons.find(
        (lesson) => lesson.name === targetLessonName,
      );

      if (!targetLesson) {
        const availableLessons = courseState.lessons
          .map((lesson, index) => `${index + 1}. ${lesson.name}`)
          .join("\n");
        return `Lesson "${targetLessonName}" not found. Available lessons:\n${availableLessons}`;
      }

      // Update the current lesson in the state
      courseState.currentLesson = targetLesson.name;

      // Find the first incomplete step in the lesson, or the first step if all are completed
      const firstIncompleteStep =
        targetLesson.steps.find((step) => step.status !== 2) ||
        targetLesson.steps[0];

      if (!firstIncompleteStep) {
        return `The lesson "${targetLesson.name}" does not have any steps.`;
      }

      // Mark the step as in progress
      firstIncompleteStep.status = 1;

      // If the lesson is not in progress or completed, mark it as in progress
      if (targetLesson.status === 0) {
        targetLesson.status = 1;
      }

      // Save the updated state
      await saveCourseState(courseState, deviceId);

      // Get the content for the step
      const stepContent = await readCourseStep(
        targetLesson.name,
        firstIncompleteStep.name,
      );

      return `📘 Starting Lesson: ${targetLesson.name}\n📝 Step: ${firstIncompleteStep.name}\n\n${stepContent}\n\nWhen you've completed this step, use the \`nextMastraCourseStep\` tool to continue.`;
    } catch (error) {
      return `Error starting course lesson: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};

// TOOL 4: Next Course Step  
export const nextMastraCourseStep: MCPTool = {
  name: "nextMastraCourseStep",
  description: "Advances to the next step in the current Mastra Course lesson. If all steps in the current lesson are completed, it will move to the next lesson",
  parameters: z.object({}),
  execute: async (_args: Record<string, never>) => {
    try {
      // Check if the user is registered
      const deviceId = await getDeviceId();

      if (deviceId === null) {
        return "You need to register for the Mastra Course first. Please use the `startMastraCourse` tool to register.";
      }

      // Load the current course state
      const courseState = await loadCourseState();

      if (!courseState) {
        return "No course progress found. Please start the course first using the `startMastraCourse` tool.";
      }

      // Find the current lesson
      const currentLessonName = courseState.currentLesson;
      const currentLesson = courseState.lessons.find(
        (lesson) => lesson.name === currentLessonName,
      );

      if (!currentLesson) {
        return "Error: Current lesson not found in course content. Please try again or reset your course progress.";
      }

      // Find the current in-progress step
      const currentStepIndex = currentLesson.steps.findIndex(
        (step) => step.status === 1,
      );

      if (currentStepIndex === -1) {
        return "No step is currently in progress. Please start a step first using the `startMastraCourse` tool.";
      }

      // Mark the current step as completed
      currentLesson.steps[currentStepIndex].status = 2; // Completed

      // Find the next step in the current lesson
      const nextStepIndex = currentLesson.steps.findIndex(
        (step, index) => index > currentStepIndex && step.status !== 2,
      );

      // If there's a next step in the current lesson
      if (nextStepIndex !== -1) {
        // Mark the next step as in progress
        currentLesson.steps[nextStepIndex].status = 1; // In progress

        // Save the updated state
        await saveCourseState(courseState, deviceId);

        // Get the content for the next step
        const nextStep = currentLesson.steps[nextStepIndex];
        const stepContent = await readCourseStep(
          currentLessonName,
          nextStep.name,
        );

        return `🎉 Step "${currentLesson.steps[currentStepIndex].name}" completed!\n\n📘 Continuing Lesson: ${currentLessonName}\n📝 Next Step: ${nextStep.name}\n\n${stepContent}\n\nWhen you've completed this step, use the \`nextMastraCourseStep\` tool to continue.`;
      }

      // All steps in the current lesson are completed
      // Mark the lesson as completed
      currentLesson.status = 2; // Completed

      // Find the next lesson that's not completed
      const currentLessonIndex = courseState.lessons.findIndex(
        (lesson) => lesson.name === currentLessonName,
      );
      const nextLesson = courseState.lessons.find(
        (lesson, index) => index > currentLessonIndex && lesson.status !== 2,
      );

      if (nextLesson) {
        // Update the current lesson to the next lesson
        courseState.currentLesson = nextLesson.name;

        // Mark the first step of the next lesson as in progress
        if (nextLesson.steps.length > 0) {
          nextLesson.steps[0].status = 1; // In progress
        }

        // Mark the next lesson as in progress
        nextLesson.status = 1; // In progress

        // Save the updated state
        await saveCourseState(courseState, deviceId);

        // Get the content for the first step of the next lesson
        const firstStep = nextLesson.steps[0];
        const stepContent = await readCourseStep(
          nextLesson.name,
          firstStep.name,
        );

        return `🎉 Congratulations! You've completed the "${currentLessonName}" lesson!\n\n📘 Starting New Lesson: ${nextLesson.name}\n📝 First Step: ${firstStep.name}\n\n${stepContent}\n\nWhen you've completed this step, use the \`nextMastraCourseStep\` tool to continue.`;
      }

      // All lessons are completed
      await saveCourseState(courseState, deviceId);

      return `🎉 Congratulations! You've completed all available lessons in the Mastra Course!\n\nIf you'd like to review any lesson, use the \`startMastraCourseLesson\` tool with the lesson name.`;
    } catch (error) {
      return `Error advancing to the next course step: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};

// TOOL 5: Clear Course History
export const clearMastraCourseHistory: MCPTool = {
  name: "clearMastraCourseHistory", 
  description: "Clears all Mastra Course progress history and starts over from the beginning. This action cannot be undone",
  parameters: confirmationSchema,
  execute: async (args: ConfirmationParams) => {
    try {
      // Check if the user is registered
      const deviceId = await getDeviceId();

      if (deviceId === null) {
        return "You need to register for the Mastra Course first. Please use the `startMastraCourse` tool to register.";
      }

      // Check if the user has confirmed the action
      if (!args.confirm) {
        return "⚠️ This action will delete all your course progress and cannot be undone. To proceed, please run this tool again with the confirm parameter set to true.";
      }

      // Get the state file path
      const statePath = await getCourseStatePath();

      // Check if the state file exists
      if (!existsSync(statePath)) {
        return "No course progress found. Nothing to clear.";
      }

      // Delete the state file
      await fs.unlink(statePath);

      return "🧹 Course progress has been cleared. You can restart the Mastra course from the beginning.";
    } catch (error) {
      return `Error clearing course history: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};