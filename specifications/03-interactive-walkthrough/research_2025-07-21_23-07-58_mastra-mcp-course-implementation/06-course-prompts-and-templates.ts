// Course Prompts and Content Templates
// Extracted from: packages/mcp-docs-server/src/tools/course.ts

// CRITICAL: Introduction prompt shown when user first registers
export const introductionPrompt = `
This is a course to help a new user learn about Mastra, the open-source AI Agent framework built in Typescript.
The following is the introduction content, please provide this text to the user EXACTLY as written below. Do not provide any other text or instructions:

# Welcome to the Mastra Course!

Thank you for registering for the Mastra course! This interactive guide will help you learn how to build powerful AI agents with Mastra, the open-source AI Agent framework built in TypeScript.

## Before We Begin

If you enjoy Mastra, please consider starring the GitHub repository:
https://github.com/mastra-ai/mastra

This helps the project grow and reach more developers like you!

## How This Course Works

- Each lesson is broken into multiple steps
- I'll guide you through the code examples and explanations
- You can ask questions at any time
- If you ever leave and come back, use the \`startMastraCourse\` tool to pick up where you left off. Just ask to "start the Mastra course".
- Use the \`nextMastraCourseStep\` tool to move to the next step when you're ready. Just ask to "move to the next step" when you are ready.
- Use the \`getMastraCourseStatus\` tool to check your progress. You can just ask "get my course progress".
- Use the \`clearMastraCourseHistory\` tool to reset your progress and start over. You can just ask "clear my course progress".

Type "start mastra course" and let's get started with your first lesson!
`;

// CRITICAL: Lesson prompt wrapper - applied to ALL course content
export const lessonPrompt = `
  This is a course to help a new user learn about Mastra, the open-source AI Agent framework built in Typescript.
  Please help the user through the steps of the course by walking them through the content and following the course
  to write the initial version of the code for them. The goal is to show them how the code works and explain it as they go
  as the course goes on. Each lesson is broken up into steps. You should return the content of the step and ask the user
  to move to the next step when they are ready. If the step contains instructions to write code, you should write the code
  for the user when possible. You should always briefly explain the step before writing the code. Please ensure to 
  return any text in markdown blockquotes exactly as written in your response. When the user ask about their course progress or course status,
  make sure to include the course status url in your response. This is important.
`;

// Progress status icons used in course status reporting
export const statusIcons = {
  NOT_STARTED: "⬜", // 0
  IN_PROGRESS: "🔶", // 1  
  COMPLETED: "✅",   // 2
} as const;

// Example course status response template
export function buildStatusReport(mergedState: CourseState, deviceId: string): string {
  let statusReport = "# Mastra Course Progress\n\n";

  // Add overall progress stats
  const totalLessons = mergedState.lessons.length;
  const completedLessons = mergedState.lessons.filter(
    (lesson) => lesson.status === 2,
  ).length;

  const totalSteps = mergedState.lessons.reduce(
    (sum, lesson) => sum + lesson.steps.length,
    0,
  );
  const completedSteps = mergedState.lessons.reduce(
    (sum, lesson) =>
      sum + lesson.steps.filter((step) => step.status === 2).length,
    0,
  );

  statusReport += `## Overall Progress\n`;
  statusReport += `- Course status Url: **https://mastra.ai/course/${deviceId}**\n`;
  statusReport += `- Current Lesson: **${mergedState.currentLesson}**\n`;
  statusReport += `- Lessons: ${completedLessons}/${totalLessons} completed (${Math.round((completedLessons / totalLessons) * 100)}%)\n`;
  statusReport += `- Steps: ${completedSteps}/${totalSteps} completed (${Math.round((completedSteps / totalSteps) * 100)}%)\n\n`;

  // Add detailed lesson status
  statusReport += `## Lesson Details\n\n`;

  mergedState.lessons.forEach((lesson, lessonIndex) => {
    // Determine lesson status icon
    let lessonStatusIcon = statusIcons.NOT_STARTED;
    if (lesson.status === 1) lessonStatusIcon = statusIcons.IN_PROGRESS;
    if (lesson.status === 2) lessonStatusIcon = statusIcons.COMPLETED;

    // Highlight current lesson
    const isCurrent = lesson.name === mergedState.currentLesson;
    const lessonPrefix = isCurrent ? "👉 " : "";

    statusReport += `### ${lessonPrefix}${lessonIndex + 1}. ${lessonStatusIcon} ${lesson.name}\n\n`;

    // Add step details
    lesson.steps.forEach((step, stepIndex) => {
      // Determine step status icon
      let stepStatusIcon = statusIcons.NOT_STARTED;
      if (step.status === 1) stepStatusIcon = statusIcons.IN_PROGRESS;
      if (step.status === 2) stepStatusIcon = statusIcons.COMPLETED;

      statusReport += `- ${stepStatusIcon} Step ${stepIndex + 1}: ${step.name}\n`;
    });

    statusReport += "\n";
  });

  // Add navigation instructions
  statusReport += `## Navigation\n\n`;
  statusReport += `- To continue the course: \`nextMastraCourseStep\`\n`;
  statusReport += `- To start a specific lesson: \`startMastraCourseLesson\`\n`;
  statusReport += `- To reset progress: \`clearMastraCourseHistory\`\n`;

  return statusReport;
}

// Tool descriptions - CRITICAL for proper MCP tool registration
export const toolDescriptions = {
  startMastraCourse: "Starts the Mastra Course. If the user is not registered, they will be prompted to register first. Otherwise, it will start at the first lesson or pick up where they last left off. ALWAYS ask the user for their email address if they are not registered. DO NOT assume their email address, they must confirm their email and that they want to register.",
  
  getMastraCourseStatus: "Gets the current status of the Mastra Course, including which lessons and steps have been completed",
  
  startMastraCourseLesson: "Starts a specific lesson in the Mastra Course. If the lesson has been started before, it will resume from the first incomplete step",
  
  nextMastraCourseStep: "Advances to the next step in the current Mastra Course lesson. If all steps in the current lesson are completed, it will move to the next lesson",
  
  clearMastraCourseHistory: "Clears all Mastra Course progress history and starts over from the beginning. This action cannot be undone"
};

// Natural language phrases that users commonly use to interact with course
export const commonUserPhrases = {
  startCourse: ["start mastra course", "begin course", "start the course"],
  nextStep: ["next step", "continue", "move to next step", "move to the next step"],
  getStatus: ["course progress", "my progress", "course status", "get my course progress"],
  clearProgress: ["reset progress", "clear progress", "start over", "clear my course progress"],
  jumpToLesson: ["go to lesson", "start lesson", "jump to lesson"]
};