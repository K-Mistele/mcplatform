// MCP Server Setup and Tool Registration
// Extracted from: packages/mcp-docs-server/src/index.ts

import { MCPServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "node:fs/promises";
import { fromPackageRoot } from "./utils.js";

// Core MCP Server initialization pattern
export async function createMCPServer() {
  const server = new MCPServer({
    name: 'Mastra Documentation Server',
    version: JSON.parse(await fs.readFile(fromPackageRoot(`package.json`), 'utf8')).version,
    tools: {
      // Blog and documentation tools
      mastraBlog: blogTool,
      mastraDocs: docsTool,
      mastraExamples: examplesTool,
      mastraChanges: changesTool,
      
      // Course tools - the core interactive learning functions
      startMastraCourse,
      getMastraCourseStatus,
      startMastraCourseLesson,
      nextMastraCourseStep,
      clearMastraCourseHistory,
    },
  });

  return server;
}

// Tool structure pattern - all MCP tools follow this interface
export interface MCPTool {
  name: string;
  description: string;
  parameters: any; // Zod schema
  execute: (args: any) => Promise<string>;
}

// Example tool implementation pattern
export const exampleTool: MCPTool = {
  name: "toolName",
  description: "Tool purpose and detailed usage instructions",
  parameters: zodSchema,
  execute: async (args: InputType) => {
    try {
      // Implementation with comprehensive error handling
      void logger.debug('Executing tool', { args });
      
      // Core tool logic here
      const result = await performToolAction(args);
      
      return result;
    } catch (error) {
      void logger.error('Tool execution failed', error);
      throw error;
    }
  },
};