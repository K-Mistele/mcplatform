import { db, schema } from 'database'
import { and, eq, desc } from 'drizzle-orm'
import { z } from 'zod'
import type { McpServer, McpServerConfig } from '../types'
import {
    calculateNextStep,
    completeStep,
    getOrInitializeProgress,
    getServerWalkthroughs
} from '../walkthrough-utils'

/**
 * Register all walkthrough-related MCP tools
 * Following the pattern from support.ts with integrated registration
 */
export function registerWalkthroughTools({
    server,
    serverConfig,
    mcpServerUserId,
    serverSessionId
}: {
    server: McpServer
    serverConfig: McpServerConfig
    mcpServerUserId: string
    serverSessionId: string
}) {
    // Register list_walkthroughs tool
    registerListWalkthroughsTool({ server, serverConfig, mcpServerUserId, serverSessionId })
    
    // Register start_walkthrough tool
    registerStartWalkthroughTool({ server, serverConfig, mcpServerUserId, serverSessionId })
    
    // Register get_next_step tool
    registerGetNextStepTool({ server, serverConfig, mcpServerUserId, serverSessionId })
}

/**
 * Tool: list_walkthroughs
 * Lists all available walkthroughs with basic info and progress
 */
function registerListWalkthroughsTool({
    server,
    serverConfig,
    mcpServerUserId,
    serverSessionId
}: {
    server: McpServer
    serverConfig: McpServerConfig
    mcpServerUserId: string
    serverSessionId: string
}) {
    // Empty schema for list_walkthroughs
    const inputSchema = z.object({})
    
    server.registerTool(
        'list_walkthroughs',
        {
            title: 'List Available Walkthroughs',
            description: 'Lists all available walkthroughs with name, type, description, progress and ID',
            inputSchema: inputSchema.shape
        },
        async (args) => {
            try {
                inputSchema.parse(args)
                
                const walkthroughs = await getServerWalkthroughs(serverConfig.id, mcpServerUserId)
                
                // Track the tool call
                await db.insert(schema.toolCalls).values({
                    mcpServerId: serverConfig.id,
                    toolName: 'list_walkthroughs',
                    mcpServerUserId: mcpServerUserId,
                    mcpServerSessionId: serverSessionId,
                    input: args,
                    output: { walkthroughs: walkthroughs.length }
                })
                
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                walkthroughs: walkthroughs.map(({ walkthrough, progress, totalSteps, progressPercent }) => ({
                                    id: walkthrough.id,
                                    title: walkthrough.title,
                                    description: walkthrough.description,
                                    type: walkthrough.type,
                                    totalSteps,
                                    progressPercent,
                                    isStarted: progress != null && progress.startedAt != null,
                                    isCompleted: progress?.completedAt != null,
                                    estimatedDurationMinutes: walkthrough.estimatedDurationMinutes,
                                    tags: walkthrough.tags || []
                                }))
                            }, null, 2)
                        }
                    ]
                }
            } catch (error) {
                console.error('Error in list_walkthroughs:', error)
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error listing walkthroughs: ${error instanceof Error ? error.message : 'Unknown error'}`
                        }
                    ]
                }
            }
        }
    )
}

/**
 * Tool: start_walkthrough
 * Starts or resumes a walkthrough by name
 */
function registerStartWalkthroughTool({
    server,
    serverConfig,
    mcpServerUserId,
    serverSessionId
}: {
    server: McpServer
    serverConfig: McpServerConfig
    mcpServerUserId: string
    serverSessionId: string
}) {
    const inputSchema = z.object({
        name: z.string().describe('The name/title of the walkthrough to start'),
        restart: z.boolean().default(false).describe('Optional: If true, restart the walkthrough from the beginning (default: false, resumes progress)')
    })
    
    server.registerTool(
        'start_walkthrough',
        {
            title: 'Start or Resume a Walkthrough',
            description: 'Starts or resumes a walkthrough by name. By default resumes existing progress, but can be forced to restart.',
            inputSchema: inputSchema.shape
        },
        async (args) => {
            try {
                const { name, restart } = inputSchema.parse(args)
                
                // Get available walkthroughs
                const walkthroughs = await getServerWalkthroughs(serverConfig.id, mcpServerUserId)
                
                // Find by exact name match
                const selectedWalkthrough = walkthroughs.find(w => 
                    w.walkthrough.title === name
                )
                
                if (!selectedWalkthrough) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Walkthrough '${name}' not found. Use list_walkthroughs to see available walkthroughs.`
                            }
                        ]
                    }
                }
                
                // If restart is requested, clear existing progress
                if (restart && selectedWalkthrough.progress) {
                    await db.delete(schema.walkthroughProgress).where(
                        and(
                            eq(schema.walkthroughProgress.mcpServerUserId, mcpServerUserId),
                            eq(schema.walkthroughProgress.walkthroughId, selectedWalkthrough.walkthrough.id)
                        )
                    )
                }
                
                // Initialize or get progress
                await getOrInitializeProgress(mcpServerUserId, selectedWalkthrough.walkthrough.id)
                
                // Get the first/next step
                const nextStep = await calculateNextStep(mcpServerUserId, selectedWalkthrough.walkthrough.id)
                
                if (!nextStep) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: 'Walkthrough has no steps or could not calculate next step'
                            }
                        ]
                    }
                }
                
                // Track the tool call
                await db.insert(schema.toolCalls).values({
                    mcpServerId: serverConfig.id,
                    toolName: 'start_walkthrough',
                    mcpServerUserId: mcpServerUserId,
                    mcpServerSessionId: serverSessionId,
                    input: args,
                    output: { 
                        walkthroughId: selectedWalkthrough.walkthrough.id,
                        nextStepId: nextStep.id,
                        wasRestarted: restart
                    }
                })
                
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                walkthrough: {
                                    id: selectedWalkthrough.walkthrough.id,
                                    title: selectedWalkthrough.walkthrough.title,
                                    description: selectedWalkthrough.walkthrough.description,
                                    type: selectedWalkthrough.walkthrough.type,
                                    estimatedDurationMinutes: selectedWalkthrough.walkthrough.estimatedDurationMinutes,
                                    tags: selectedWalkthrough.walkthrough.tags
                                },
                                nextStep: nextStep.isCompleted ? null : {
                                    id: nextStep.id,
                                    title: nextStep.title,
                                    instructions: nextStep.instructions,
                                    displayOrder: nextStep.displayOrder
                                },
                                progress: {
                                    totalSteps: nextStep.totalSteps,
                                    completedCount: nextStep.completedCount,
                                    progressPercent: nextStep.progressPercent,
                                    isCompleted: nextStep.isCompleted,
                                    wasRestarted: restart
                                }
                            }, null, 2)
                        }
                    ]
                }
            } catch (error) {
                console.error('Error in start_walkthrough:', error)
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error starting walkthrough: ${error instanceof Error ? error.message : 'Unknown error'}`
                        }
                    ]
                }
            }
        }
    )
}

/**
 * Tool: get_next_step
 * Gets the next step in the currently active walkthrough, optionally completing the current step first
 * This follows Mastra's pattern of combining step completion and progression
 */
function registerGetNextStepTool({
    server,
    serverConfig,
    mcpServerUserId,
    serverSessionId
}: {
    server: McpServer
    serverConfig: McpServerConfig
    mcpServerUserId: string
    serverSessionId: string
}) {
    const inputSchema = z.object({
        currentStepId: z.string().optional().describe('Optional: The ID of the current step to mark as completed before getting the next step')
    })
    
    server.registerTool(
        'get_next_step',
        {
            title: 'Get Next Walkthrough Step',
            description: 'Gets the next step in your active walkthrough. If currentStepId is provided, marks it as completed first. Use start_walkthrough first to begin a walkthrough.',
            inputSchema: inputSchema.shape
        },
        async (args) => {
            try {
                const { currentStepId } = inputSchema.parse(args)
                
                // Find the user's active walkthrough (most recent progress)
                const activeProgress = await db
                    .select()
                    .from(schema.walkthroughProgress)
                    .where(eq(schema.walkthroughProgress.mcpServerUserId, mcpServerUserId))
                    .orderBy(desc(schema.walkthroughProgress.lastActivityAt))
                    .limit(1)
                
                if (!activeProgress[0]) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: 'No active walkthrough found. Use start_walkthrough to begin a walkthrough first.'
                            }
                        ]
                    }
                }
                
                const walkthroughId = activeProgress[0].walkthroughId
                
                // If currentStepId is provided, mark it as completed first
                if (currentStepId) {
                    await completeStep(mcpServerUserId, walkthroughId, currentStepId)
                }
                
                // Get the next step (or current if no step was completed)
                const nextStep = await calculateNextStep(mcpServerUserId, walkthroughId)
                
                if (!nextStep) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: 'Could not calculate next step for active walkthrough'
                            }
                        ]
                    }
                }
                
                // Track the tool call
                await db.insert(schema.toolCalls).values({
                    mcpServerId: serverConfig.id,
                    toolName: 'get_next_step',
                    mcpServerUserId: mcpServerUserId,
                    mcpServerSessionId: serverSessionId,
                    input: args,
                    output: { 
                        completedStepId: currentStepId || null,
                        nextStepId: nextStep.id,
                        walkthroughId: walkthroughId,
                        isWalkthroughCompleted: nextStep.isCompleted
                    }
                })
                
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                ...(currentStepId && {
                                    completedStep: {
                                        stepId: currentStepId,
                                        walkthroughId
                                    }
                                }),
                                nextStep: nextStep.isCompleted ? null : {
                                    id: nextStep.id,
                                    title: nextStep.title,
                                    instructions: nextStep.instructions,
                                    displayOrder: nextStep.displayOrder
                                },
                                progress: {
                                    totalSteps: nextStep.totalSteps,
                                    completedCount: nextStep.completedCount,
                                    progressPercent: nextStep.progressPercent,
                                    isWalkthroughCompleted: nextStep.isCompleted
                                },
                                walkthroughId: walkthroughId
                            }, null, 2)
                        }
                    ]
                }
            } catch (error) {
                console.error('Error in get_next_step:', error)
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error getting next step: ${error instanceof Error ? error.message : 'Unknown error'}`
                        }
                    ]
                }
            }
        }
    )
}