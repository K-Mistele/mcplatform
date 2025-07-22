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
 * Tool: get_current_step
 * Gets the current step for a user in a walkthrough with detailed information
 */
export const getCurrentStepTool: Tool = {
    name: 'get_current_step',
    description: 'Gets the current step for a user in a walkthrough with detailed instructions and progress',
    inputSchema: {
        type: 'object',
        properties: {
            walkthroughId: {
                type: 'string',
                description: 'The ID of the walkthrough'
            }
        },
        required: ['walkthroughId']
    }
}

const getCurrentStepInputSchema = z.object({
    walkthroughId: z.string()
})

export async function handleGetCurrentStep(
    request: CallToolRequest,
    context: {
        mcpServerId: string
        mcpServerUserId: string
        serverSessionId: string
    }
): Promise<any> {
    try {
        const { walkthroughId } = getCurrentStepInputSchema.parse(request.params.arguments)

        // Initialize progress if not exists
        await getOrInitializeProgress(context.mcpServerUserId, walkthroughId)

        const currentStep = await calculateNextStep(context.mcpServerUserId, walkthroughId)

        if (!currentStep) {
            throw new Error('Walkthrough not found or has no steps')
        }

        // Track the tool call
        await db.insert(toolCalls).values({
            mcpServerId: context.mcpServerId,
            toolName: 'get_current_step',
            mcpServerUserId: context.mcpServerUserId,
            mcpServerSessionId: context.serverSessionId,
            input: request.params.arguments,
            output: { stepId: currentStep.id, isCompleted: currentStep.isCompleted }
        })

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        currentStep: {
                            id: currentStep.id,
                            title: currentStep.title,
                            instructions: currentStep.instructions,
                            displayOrder: currentStep.displayOrder,
                            isCompleted: currentStep.isCompleted,
                            progress: {
                                totalSteps: currentStep.totalSteps,
                                completedCount: currentStep.completedCount,
                                progressPercent: currentStep.progressPercent
                            }
                        }
                    }, null, 2)
                }
            ]
        }
    } catch (error) {
        console.error('Error in get_current_step:', error)
        throw error
    }
}

/**
 * Tool: complete_step
 * Marks a step as completed and advances progress
 */
export const completeStepTool: Tool = {
    name: 'complete_step',
    description: 'Marks a step as completed and advances progress in the walkthrough',
    inputSchema: {
        type: 'object',
        properties: {
            walkthroughId: {
                type: 'string',
                description: 'The ID of the walkthrough'
            },
            stepId: {
                type: 'string',
                description: 'The ID of the step to mark as completed'
            }
        },
        required: ['walkthroughId', 'stepId']
    }
}

const completeStepInputSchema = z.object({
    walkthroughId: z.string(),
    stepId: z.string()
})

export async function handleCompleteStep(
    request: CallToolRequest,
    context: {
        mcpServerId: string
        mcpServerUserId: string
        serverSessionId: string
    }
): Promise<any> {
    try {
        const { walkthroughId, stepId } = completeStepInputSchema.parse(request.params.arguments)

        await completeStep(context.mcpServerUserId, walkthroughId, stepId)

        // Get updated progress after completion
        const nextStep = await calculateNextStep(context.mcpServerUserId, walkthroughId)

        // Track the tool call
        await db.insert(toolCalls).values({
            mcpServerId: context.mcpServerId,
            toolName: 'complete_step',
            mcpServerUserId: context.mcpServerUserId,
            mcpServerSessionId: context.serverSessionId,
            input: request.params.arguments,
            output: { 
                completedStepId: stepId,
                nextStepId: nextStep?.id || null,
                isWalkthroughCompleted: nextStep?.isCompleted || false
            }
        })

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        completedStep: {
                            stepId,
                            walkthroughId
                        },
                        progress: nextStep ? {
                            nextStep: nextStep.isCompleted ? null : {
                                id: nextStep.id,
                                title: nextStep.title,
                                instructions: nextStep.instructions,
                                displayOrder: nextStep.displayOrder
                            },
                            totalSteps: nextStep.totalSteps,
                            completedCount: nextStep.completedCount,
                            progressPercent: nextStep.progressPercent,
                            isWalkthroughCompleted: nextStep.isCompleted
                        } : null
                    }, null, 2)
                }
            ]
        }
    } catch (error) {
        console.error('Error in complete_step:', error)
        throw error
    }
}

/**
 * Tool: get_walkthrough_steps
 * Gets all steps for a walkthrough with their completion status
 */
export const getWalkthroughStepsTool: Tool = {
    name: 'get_walkthrough_steps',
    description: 'Gets all steps for a walkthrough with their completion status and progress information',
    inputSchema: {
        type: 'object',
        properties: {
            walkthroughId: {
                type: 'string',
                description: 'The ID of the walkthrough to get steps for'
            }
        },
        required: ['walkthroughId']
    }
}

const getWalkthroughStepsInputSchema = z.object({
    walkthroughId: z.string()
})

export async function handleGetWalkthroughSteps(
    request: CallToolRequest,
    context: {
        mcpServerId: string
        mcpServerUserId: string
        serverSessionId: string
    }
): Promise<any> {
    try {
        const { walkthroughId } = getWalkthroughStepsInputSchema.parse(request.params.arguments)

        const steps = await getWalkthroughStepsWithProgress(walkthroughId, context.mcpServerUserId)

        // Track the tool call
        await db.insert(toolCalls).values({
            mcpServerId: context.mcpServerId,
            toolName: 'get_walkthrough_steps',
            mcpServerUserId: context.mcpServerUserId,
            mcpServerSessionId: context.serverSessionId,
            input: request.params.arguments,
            output: { walkthroughId, stepCount: steps.length }
        })

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        walkthrough: {
                            id: walkthroughId,
                            steps: steps.map(step => ({
                                id: step.id,
                                title: step.title,
                                instructions: step.instructions,
                                displayOrder: step.displayOrder,
                                isCompleted: step.isCompleted
                            })),
                            progress: {
                                totalSteps: steps[0]?.totalSteps || 0,
                                completedCount: steps[0]?.completedCount || 0,
                                progressPercent: steps[0]?.progressPercent || 0
                            }
                        }
                    }, null, 2)
                }
            ]
        }
    } catch (error) {
        console.error('Error in get_walkthrough_steps:', error)
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
    get_current_step: {
        tool: getCurrentStepTool,
        handler: handleGetCurrentStep
    },
    complete_step: {
        tool: completeStepTool,
        handler: handleCompleteStep
    },
    get_walkthrough_steps: {
        tool: getWalkthroughStepsTool,
        handler: handleGetWalkthroughSteps
    }
}