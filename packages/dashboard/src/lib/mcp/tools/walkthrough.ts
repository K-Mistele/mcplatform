import type { CallToolRequest, Tool } from '@modelcontextprotocol/sdk/types.js'
import { db, toolCalls, walkthroughProgress } from 'database'
import { and, eq, desc } from 'drizzle-orm'
import { z } from 'zod'
import {
    calculateNextStep,
    completeStep,
    getOrInitializeProgress,
    getServerWalkthroughs
} from '../walkthrough-utils'

/**
 * Tool: list_walkthroughs
 * Lists all available walkthroughs with basic info and progress
 */
export const listWalkthroughsTool: Tool = {
    name: 'list_walkthroughs',
    description: 'Lists all available walkthroughs with name, type, description, progress and ID',
    inputSchema: {
        type: 'object',
        properties: {},
        required: []
    }
}

const listWalkthroughsInputSchema = z.object({})

export async function handleListWalkthroughs(
    request: CallToolRequest,
    context: {
        mcpServerId: string
        mcpServerUserId: string
        serverSessionId: string
    }
): Promise<any> {
    try {
        listWalkthroughsInputSchema.parse(request.params.arguments)

        const walkthroughs = await getServerWalkthroughs(context.mcpServerId, context.mcpServerUserId)

        // Track the tool call
        await db.insert(toolCalls).values({
            mcpServerId: context.mcpServerId,
            toolName: 'list_walkthroughs',
            mcpServerUserId: context.mcpServerUserId,
            mcpServerSessionId: context.serverSessionId,
            input: request.params.arguments,
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
        throw error
    }
}

/**
 * Tool: start_walkthrough
 * Starts or resumes a walkthrough by name
 */
export const startWalkthroughTool: Tool = {
    name: 'start_walkthrough',
    description: 'Starts or resumes a walkthrough by name. By default resumes existing progress, but can be forced to restart.',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'The name/title of the walkthrough to start'
            },
            restart: {
                type: 'boolean',
                description: 'Optional: If true, restart the walkthrough from the beginning (default: false, resumes progress)'
            }
        },
        required: ['name']
    }
}

const startWalkthroughInputSchema = z.object({
    name: z.string(),
    restart: z.boolean().default(false)
})

export async function handleStartWalkthrough(
    request: CallToolRequest,
    context: {
        mcpServerId: string
        mcpServerUserId: string
        serverSessionId: string
    }
): Promise<any> {
    try {
        const { name, restart } = startWalkthroughInputSchema.parse(request.params.arguments)

        // Get available walkthroughs
        const walkthroughs = await getServerWalkthroughs(context.mcpServerId, context.mcpServerUserId)
        
        // Find by exact name match
        const selectedWalkthrough = walkthroughs.find(w => 
            w.walkthrough.title === name
        )
        
        if (!selectedWalkthrough) {
            throw new Error(`Walkthrough '${name}' not found`)
        }
        
        // If restart is requested, clear existing progress
        if (restart && selectedWalkthrough.progress) {
            await db.delete(walkthroughProgress).where(
                and(
                    eq(walkthroughProgress.mcpServerUserId, context.mcpServerUserId),
                    eq(walkthroughProgress.walkthroughId, selectedWalkthrough.walkthrough.id)
                )
            )
        }
        
        // Initialize or get progress
        await getOrInitializeProgress(context.mcpServerUserId, selectedWalkthrough.walkthrough.id)
        
        // Get the first/next step
        const nextStep = await calculateNextStep(context.mcpServerUserId, selectedWalkthrough.walkthrough.id)
        
        if (!nextStep) {
            throw new Error('Walkthrough has no steps or could not calculate next step')
        }
        
        // Track the tool call
        await db.insert(toolCalls).values({
            mcpServerId: context.mcpServerId,
            toolName: 'start_walkthrough',
            mcpServerUserId: context.mcpServerUserId,
            mcpServerSessionId: context.serverSessionId,
            input: request.params.arguments,
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
        throw error
    }
}

/**
 * Tool: get_next_step
 * Gets the next step in the currently active walkthrough, optionally completing the current step first
 * This follows Mastra's pattern of combining step completion and progression
 */
export const getNextStepTool: Tool = {
    name: 'get_next_step',
    description: 'Gets the next step in your active walkthrough. If currentStepId is provided, marks it as completed first. Use start_walkthrough first to begin a walkthrough.',
    inputSchema: {
        type: 'object',
        properties: {
            currentStepId: {
                type: 'string',
                description: 'Optional: The ID of the current step to mark as completed before getting the next step'
            }
        },
        required: []
    }
}

const getNextStepInputSchema = z.object({
    currentStepId: z.string().optional()
})

export async function handleGetNextStep(
    request: CallToolRequest,
    context: {
        mcpServerId: string
        mcpServerUserId: string
        serverSessionId: string
    }
): Promise<any> {
    try {
        const { currentStepId } = getNextStepInputSchema.parse(request.params.arguments)

        // Find the user's active walkthrough (most recent progress)
        const activeProgress = await db
            .select()
            .from(walkthroughProgress)
            .where(eq(walkthroughProgress.mcpServerUserId, context.mcpServerUserId))
            .orderBy(desc(walkthroughProgress.lastActivityAt))
            .limit(1)
        
        if (!activeProgress[0]) {
            throw new Error('No active walkthrough found. Use start_walkthrough to begin a walkthrough first.')
        }
        
        const walkthroughId = activeProgress[0].walkthroughId

        // If currentStepId is provided, mark it as completed first
        if (currentStepId) {
            await completeStep(context.mcpServerUserId, walkthroughId, currentStepId)
        }

        // Get the next step (or current if no step was completed)
        const nextStep = await calculateNextStep(context.mcpServerUserId, walkthroughId)

        if (!nextStep) {
            throw new Error('Could not calculate next step for active walkthrough')
        }

        // Track the tool call
        await db.insert(toolCalls).values({
            mcpServerId: context.mcpServerId,
            toolName: 'get_next_step',
            mcpServerUserId: context.mcpServerUserId,
            mcpServerSessionId: context.serverSessionId,
            input: request.params.arguments,
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
        throw error
    }
}


// Export all tools and handlers as a registry
export const walkthroughTools = {
    list_walkthroughs: {
        tool: listWalkthroughsTool,
        handler: handleListWalkthroughs
    },
    start_walkthrough: {
        tool: startWalkthroughTool,
        handler: handleStartWalkthrough
    },
    get_next_step: {
        tool: getNextStepTool,
        handler: handleGetNextStep
    }
}