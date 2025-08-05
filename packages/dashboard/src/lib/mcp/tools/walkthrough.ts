import { db, schema } from 'database'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { renderWalkthroughStep, renderWalkthroughStepOutput } from '../../template-engine'
import type { McpServer, McpServerConfig } from '../types'
import { calculateNextStep, completeStep, getOrInitializeProgress, getServerWalkthroughs } from '../walkthrough-utils'

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
    // Register smart start_walkthrough tool (replaces list_walkthroughs)
    registerStartWalkthroughTool({ server, serverConfig, mcpServerUserId, serverSessionId })

    // Register get_next_step tool
    registerGetNextStepTool({ server, serverConfig, mcpServerUserId, serverSessionId })
}

/**
 * Helper function to format walkthroughs list for display
 */
function formatWalkthroughsList(walkthroughs: Awaited<ReturnType<typeof getServerWalkthroughs>>) {
    return JSON.stringify(
        {
            walkthroughs: walkthroughs.map(
                ({ walkthrough, progress, totalSteps, progressPercent }) => ({
                    title: walkthrough.title,
                    description: walkthrough.description,
                    type: walkthrough.type,
                    totalSteps,
                    progressPercent,
                    isStarted: progress != null && progress.startedAt != null,
                    isCompleted: progress?.completedAt != null,
                    estimatedDurationMinutes: walkthrough.estimatedDurationMinutes,
                    tags: walkthrough.tags || []
                })
            )
        },
        null,
        2
    )
}

/**
 * Helper function to start a walkthrough
 */
async function startWalkthrough(
    selectedWalkthrough: Awaited<ReturnType<typeof getServerWalkthroughs>>[0],
    restart: boolean,
    mcpServerUserId: string
) {
    // If restart is requested, clear existing progress
    if (restart && selectedWalkthrough.progress) {
        await db
            .delete(schema.walkthroughProgress)
            .where(
                and(
                    eq(schema.walkthroughProgress.mcpServerUserId, mcpServerUserId),
                    eq(schema.walkthroughProgress.walkthroughId, selectedWalkthrough.walkthrough.id)
                )
            )
    }

    // Initialize or get progress
    const progress = await getOrInitializeProgress(mcpServerUserId, selectedWalkthrough.walkthrough.id)

    // Get the first/next step
    const nextStepResult = await calculateNextStep(selectedWalkthrough.walkthrough.id, progress)

    if (!nextStepResult) {
        return {
            content: [
                {
                    type: 'text' as const,
                    text: 'Walkthrough has no steps or could not calculate next step'
                }
            ]
        }
    }

    // If there's no step, show error
    if (!nextStepResult.step) {
        return {
            content: [
                {
                    type: 'text' as const,
                    text: 'No steps found in this walkthrough'
                }
            ]
        }
    }

    // Return the same format as get_next_step
    return {
        content: [
            {
                type: 'text' as const,
                text: renderWalkthroughStepOutput(
                    renderWalkthroughStep(selectedWalkthrough.walkthrough.title, nextStepResult.step),
                    {
                        progressPercent: nextStepResult.progressPercent,
                        completed: nextStepResult.isCompleted,
                        stepId: nextStepResult.step.id,
                        totalSteps: nextStepResult.totalSteps,
                        completedSteps: nextStepResult.completedCount,
                        walkthroughId: selectedWalkthrough.walkthrough.id
                    }
                )
            }
        ]
    }
}

/**
 * Tool: start_walkthrough
 * Smart walkthrough tool that lists walkthroughs when called without parameters,
 * auto-starts single walkthroughs, or starts named walkthroughs
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
        name: z.string().optional().describe('Optional: The name/title of the walkthrough to start. If not provided, will list available walkthroughs or auto-start if only one exists.'),
        restart: z
            .boolean()
            .default(false)
            .describe(
                'Optional: If true, restart the walkthrough from the beginning (default: false, resumes progress)'
            )
    })

    server.registerTool(
        'start_walkthrough',
        {
            title: 'Start Walkthrough or List Available Walkthroughs',
            description:
                'Smart walkthrough tool: Call without parameters to list walkthroughs (or auto-start if only one exists). Call with "name" parameter to start a specific walkthrough.',
            inputSchema: inputSchema.shape
        },
        async (args: z.infer<typeof inputSchema>) => {
            try {
                const { name, restart } = inputSchema.parse(args)

                // Get available walkthroughs
                const walkthroughs = await getServerWalkthroughs(serverConfig.id, mcpServerUserId)

                if (walkthroughs.length === 0) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: 'No walkthroughs are available for this server.'
                            }
                        ]
                    }
                }

                // If no name provided, either list walkthroughs or auto-start single walkthrough
                if (!name) {
                    if (walkthroughs.length === 1) {
                        // Auto-start the single walkthrough
                        const selectedWalkthrough = walkthroughs[0]
                        
                        const result = await startWalkthrough(selectedWalkthrough, restart, mcpServerUserId)
                        
                        // Track after successful auto-start
                        await db.insert(schema.toolCalls).values({
                            mcpServerId: serverConfig.id,
                            toolName: 'start_walkthrough',
                            mcpServerUserId: mcpServerUserId,
                            mcpServerSessionId: serverSessionId,
                            input: { ...args, name: selectedWalkthrough.walkthrough.title },
                            output: { action: 'auto_start', walkthroughId: selectedWalkthrough.walkthrough.id, success: true }
                        })

                        return result
                    } else {
                        // Multiple walkthroughs - list them
                        // Track the listing action
                        await db.insert(schema.toolCalls).values({
                            mcpServerId: serverConfig.id,
                            toolName: 'start_walkthrough',
                            mcpServerUserId: mcpServerUserId,
                            mcpServerSessionId: serverSessionId,
                            input: args,
                            output: { action: 'list', walkthroughs: walkthroughs.length }
                        })
                        
                        return {
                            content: [
                                {
                                    type: 'text' as const,
                                    text: `Multiple walkthroughs available. Please call start_walkthrough again with the "name" parameter set to one of the following walkthrough titles:\n\n${formatWalkthroughsList(walkthroughs)}\n\nExample: Call start_walkthrough with name="${walkthroughs[0].walkthrough.title}"`
                                }
                            ]
                        }
                    }
                }

                // Find by exact name match
                const selectedWalkthrough = walkthroughs.find((w) => w.walkthrough.title === name)

                if (!selectedWalkthrough) {
                    // Track the invalid name attempt
                    await db.insert(schema.toolCalls).values({
                        mcpServerId: serverConfig.id,
                        toolName: 'start_walkthrough',
                        mcpServerUserId: mcpServerUserId,
                        mcpServerSessionId: serverSessionId,
                        input: args,
                        output: { action: 'invalid_name', requestedName: name, walkthroughs: walkthroughs.length }
                    })

                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: `Walkthrough '${name}' not found. Available walkthroughs:\n\n${formatWalkthroughsList(walkthroughs)}\n\nPlease call start_walkthrough again with one of the above walkthrough titles.`
                            }
                        ]
                    }
                }

                // Start the walkthrough first
                const result = await startWalkthrough(selectedWalkthrough, restart, mcpServerUserId)
                
                // Track after successful start
                await db.insert(schema.toolCalls).values({
                    mcpServerId: serverConfig.id,
                    toolName: 'start_walkthrough',
                    mcpServerUserId: mcpServerUserId,
                    mcpServerSessionId: serverSessionId,
                    input: args,
                    output: {
                        action: 'start_named',
                        walkthroughId: selectedWalkthrough.walkthrough.id,
                        wasRestarted: restart,
                        success: true
                    }
                })

                return result
            } catch (error) {
                console.error('Error in start_walkthrough:', error)
                return {
                    content: [
                        {
                            type: 'text' as const,
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
        currentStepId: z
            .string()
            .optional()
            .describe('Optional: The ID of the current step to mark as completed before getting the next step')
    })

    server.registerTool(
        'get_next_step',
        {
            title: 'Get Next Walkthrough Step',
            description:
                'Gets the next step in your active walkthrough. If currentStepId is provided, marks it as completed first. Use start_walkthrough first to begin a walkthrough.',
            inputSchema: inputSchema.shape
        },
        async (args: z.infer<typeof inputSchema>) => {
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
                                type: 'text' as const,
                                text: 'No active walkthrough found. Use start_walkthrough to begin a walkthrough first.'
                            }
                        ]
                    }
                }

                const walkthroughId = activeProgress[0].walkthroughId

                // If currentStepId is provided, mark it as completed first
                if (currentStepId) {
                    await completeStep(mcpServerUserId, walkthroughId, currentStepId, serverConfig.id, serverSessionId)
                }

                // Get updated progress after potential completion
                const currentProgress = await db
                    .select()
                    .from(schema.walkthroughProgress)
                    .where(
                        and(
                            eq(schema.walkthroughProgress.mcpServerUserId, mcpServerUserId),
                            eq(schema.walkthroughProgress.walkthroughId, walkthroughId)
                        )
                    )
                    .limit(1)

                // Get the next step (or current if no step was completed)
                const nextStepResult = await calculateNextStep(walkthroughId, currentProgress[0] || null)

                if (!nextStepResult) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
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
                        nextStepId: nextStepResult.step?.id || null,
                        walkthroughId: walkthroughId,
                        isWalkthroughCompleted: nextStepResult.isCompleted
                    }
                })
                // If there's no step (walkthrough completed), show completion message
                if (!nextStepResult.step) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: renderWalkthroughStepOutput(
                                    `# Walkthrough Complete!\n\nCongratulations! You have completed the "${nextStepResult.walkthrough.title}" walkthrough.`,
                                    {
                                        progressPercent: 100,
                                        completed: true,
                                        stepId: 'completed',
                                        totalSteps: nextStepResult.totalSteps,
                                        completedSteps: nextStepResult.completedCount,
                                        walkthroughId: walkthroughId
                                    }
                                )
                            }
                        ]
                    }
                }

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: renderWalkthroughStepOutput(
                                renderWalkthroughStep(nextStepResult.walkthrough.title, nextStepResult.step),
                                {
                                    progressPercent: nextStepResult.progressPercent,
                                    completed: nextStepResult.isCompleted,
                                    stepId: nextStepResult.step.id,
                                    totalSteps: nextStepResult.totalSteps,
                                    completedSteps: nextStepResult.completedCount,
                                    walkthroughId: walkthroughId
                                }
                            )
                        }
                    ]
                }
            } catch (error) {
                console.error('Error in get_next_step:', error)
                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: `Error getting next step: ${error instanceof Error ? error.message : 'Unknown error'}`
                        }
                    ]
                }
            }
        }
    )
}
