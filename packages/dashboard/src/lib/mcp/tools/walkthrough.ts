import type { CallToolRequest, Tool } from '@modelcontextprotocol/sdk/types.js'
import { db, toolCalls } from 'database'
import { z } from 'zod'
import {
    calculateNextStep,
    completeStep,
    getOrInitializeProgress,
    getServerWalkthroughs,
    getWalkthroughDetails,
    getWalkthroughStepsWithProgress
} from '../walkthrough-utils'

/**
 * Tool: list_walkthroughs
 * Lists all available walkthroughs for the current MCP server
 */
export const listWalkthroughsTool: Tool = {
    name: 'list_walkthroughs',
    description: 'Lists all available walkthroughs for this server with progress information',
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
                            estimatedDurationMinutes: walkthrough.estimatedDurationMinutes,
                            tags: walkthrough.tags,
                            totalSteps,
                            progressPercent,
                            isStarted: !!progress,
                            isCompleted: progress?.completedAt != null,
                            lastActivity: progress?.lastActivityAt
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
 * Tool: get_walkthrough_details
 * Gets detailed information about a specific walkthrough including current step and progress
 */
export const getWalkthroughDetailsTool: Tool = {
    name: 'get_walkthrough_details',
    description: 'Gets detailed information about a specific walkthrough including current step and progress',
    inputSchema: {
        type: 'object',
        properties: {
            walkthroughId: {
                type: 'string',
                description: 'The ID of the walkthrough to get details for'
            }
        },
        required: ['walkthroughId']
    }
}

const getWalkthroughDetailsInputSchema = z.object({
    walkthroughId: z.string()
})

export async function handleGetWalkthroughDetails(
    request: CallToolRequest,
    context: {
        mcpServerId: string
        mcpServerUserId: string
        serverSessionId: string
    }
): Promise<any> {
    try {
        const { walkthroughId } = getWalkthroughDetailsInputSchema.parse(request.params.arguments)

        const walkthroughDetails = await getWalkthroughDetails(walkthroughId, context.mcpServerUserId)

        if (!walkthroughDetails) {
            throw new Error('Walkthrough not found')
        }

        // Track the tool call
        await db.insert(toolCalls).values({
            mcpServerId: context.mcpServerId,
            toolName: 'get_walkthrough_details',
            mcpServerUserId: context.mcpServerUserId,
            mcpServerSessionId: context.serverSessionId,
            input: request.params.arguments,
            output: { walkthroughId: walkthroughDetails.id }
        })

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        walkthrough: {
                            id: walkthroughDetails.id,
                            title: walkthroughDetails.title,
                            description: walkthroughDetails.description,
                            estimatedDurationMinutes: walkthroughDetails.estimatedDurationMinutes,
                            tags: walkthroughDetails.tags,
                            totalSteps: walkthroughDetails.totalSteps,
                            completedSteps: walkthroughDetails.completedSteps,
                            progressPercent: walkthroughDetails.progressPercent,
                            currentStepId: walkthroughDetails.currentStepId,
                            isCompleted: walkthroughDetails.isCompleted,
                            createdAt: walkthroughDetails.createdAt,
                            updatedAt: walkthroughDetails.updatedAt
                        }
                    }, null, 2)
                }
            ]
        }
    } catch (error) {
        console.error('Error in get_walkthrough_details:', error)
        throw error
    }
}

/**
 * Tool: get_next_step
 * Gets the next step in a walkthrough, optionally completing the current step first
 * This follows Mastra's pattern of combining step completion and progression
 */
export const getNextStepTool: Tool = {
    name: 'get_next_step',
    description: 'Gets the next step in a walkthrough. If currentStepId is provided, marks it as completed first before returning the next step.',
    inputSchema: {
        type: 'object',
        properties: {
            walkthroughId: {
                type: 'string',
                description: 'The ID of the walkthrough'
            },
            currentStepId: {
                type: 'string',
                description: 'Optional: The ID of the current step to mark as completed before getting the next step'
            }
        },
        required: ['walkthroughId']
    }
}

const getNextStepInputSchema = z.object({
    walkthroughId: z.string(),
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
        const { walkthroughId, currentStepId } = getNextStepInputSchema.parse(request.params.arguments)

        // Initialize progress if not exists
        await getOrInitializeProgress(context.mcpServerUserId, walkthroughId)

        // If currentStepId is provided, mark it as completed first
        if (currentStepId) {
            await completeStep(context.mcpServerUserId, walkthroughId, currentStepId)
        }

        // Get the next step (or current if no step was completed)
        const nextStep = await calculateNextStep(context.mcpServerUserId, walkthroughId)

        if (!nextStep) {
            throw new Error('Walkthrough not found or has no steps')
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
                        }
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
    get_walkthrough_details: {
        tool: getWalkthroughDetailsTool,
        handler: handleGetWalkthroughDetails
    },
    get_next_step: {
        tool: getNextStepTool,
        handler: handleGetNextStep
    }
}