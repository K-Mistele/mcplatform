import weave from 'weave'

interface WeaveConfig {
    projectName: string
    apiKey?: string
    baseUrl?: string
}

interface ToolCallData {
    toolName: string
    input: any
    output: any
    duration: number
    success: boolean
    error?: string
    userId?: string
    serverId: string
}

class WeaveMCPTelemetry {
    private client: any
    private initialized = false

    constructor(private config: WeaveConfig) {}

    async initialize() {
        if (this.initialized) return

        try {
            // Initialize Weave client
            this.client = weave.init(this.config.projectName)
            this.initialized = true
            console.log(`Weave MCP telemetry initialized for project: ${this.config.projectName}`)
        } catch (error) {
            console.error('Failed to initialize Weave:', error)
            throw error
        }
    }

    // Wrapper function to trace MCP tool calls
    wrapToolCall<T extends (...args: any[]) => any>(toolName: string, serverId: string, originalFunction: T): T {
        return (async (...args: any[]) => {
            if (!this.initialized) {
                await this.initialize()
            }

            const startTime = Date.now()
            const span = this.client?.startSpan(`mcp.tool.${toolName}`, {
                'tool.name': toolName,
                'mcp.server.id': serverId,
                'mcp.operation': 'tool_call'
            })

            try {
                const result = await originalFunction(...args)
                const duration = Date.now() - startTime

                // Log to Weave
                await this.logToolCall({
                    toolName,
                    input: args[0] || {},
                    output: result,
                    duration,
                    success: true,
                    serverId
                })

                span?.setStatus({ code: 1 }) // OK
                return result
            } catch (error) {
                const duration = Date.now() - startTime
                const errorMessage = error instanceof Error ? error.message : String(error)

                // Log error to Weave
                await this.logToolCall({
                    toolName,
                    input: args[0] || {},
                    output: null,
                    duration,
                    success: false,
                    error: errorMessage,
                    serverId
                })

                span?.setStatus({ code: 2, message: errorMessage }) // ERROR
                throw error
            } finally {
                span?.end()
            }
        }) as T
    }

    // Manual logging method for tool calls
    async logToolCall(data: ToolCallData) {
        if (!this.initialized) {
            await this.initialize()
        }

        try {
            // Create a Weave trace for this tool call
            const trace = {
                name: `mcp_tool_${data.toolName}`,
                inputs: data.input,
                output: data.output,
                metadata: {
                    tool_name: data.toolName,
                    server_id: data.serverId,
                    duration_ms: data.duration,
                    success: data.success,
                    error: data.error,
                    timestamp: new Date().toISOString(),
                    user_id: data.userId
                }
            }

            // Log to Weave (using eval for now since the API might vary)
            await this.client?.log(trace)
        } catch (error) {
            console.error('Failed to log tool call to Weave:', error)
        }
    }

    // Track MCP server metrics
    async trackServerMetrics(
        serverId: string,
        metrics: {
            totalCalls: number
            successRate: number
            avgResponseTime: number
            errorRate: number
        }
    ) {
        if (!this.initialized) {
            await this.initialize()
        }

        try {
            await this.client?.log({
                name: 'mcp_server_metrics',
                inputs: { server_id: serverId },
                output: metrics,
                metadata: {
                    metric_type: 'server_performance',
                    timestamp: new Date().toISOString()
                }
            })
        } catch (error) {
            console.error('Failed to track server metrics:', error)
        }
    }
}

// Singleton instance
let weaveTelemetry: WeaveMCPTelemetry | null = null

export function getWeaveTelemetry(config?: WeaveConfig): WeaveMCPTelemetry {
    if (!weaveTelemetry && config) {
        weaveTelemetry = new WeaveMCPTelemetry(config)
    }
    return weaveTelemetry!
}

export { WeaveMCPTelemetry }
export type { ToolCallData, WeaveConfig }
