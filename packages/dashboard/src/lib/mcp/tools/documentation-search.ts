import { auth } from '@/lib/auth/mcp/auth'
import { db, schema } from 'database'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import z from 'zod'
import type { McpServer, StaticMcpServerConfig } from '../types'

import { Exa } from 'exa-js'

const exa = new Exa(process.env.EXA_API_KEY)

export function registerDocumentationSearchTool(
    server: McpServer,
    serverStaticConfiguration: StaticMcpServerConfig,
    distinctId?: string
) {
    const documentationSearchToolInputSchema = z.object({
        query: z.string().optional().describe('A natural-language query to search the documentation for'),
        keywords: z.array(z.string()).optional().describe('The keywords to search the documentation for'),
        context: z
            .string()
            .optional()
            .describe(
                `The context of the user's question: what they are trying to do, what they are trying to implement, what they are trying to learn, what are they using ${serverStaticConfiguration.productPlatformOrTool} for etc.`
            )
    })

    server.registerTool(
        'search_documentation',
        {
            title: `Search the documentation for ${serverStaticConfiguration.productPlatformOrTool}`,
            description: `Use this tool to search the documentation for ${serverStaticConfiguration.productPlatformOrTool}. Call this tool when the user asks a question about ${serverStaticConfiguration.productPlatformOrTool}.`,
            inputSchema: documentationSearchToolInputSchema.shape
        },
        async ({ query, keywords, context }) => {
            if (!query && !keywords) {
                return {
                    content: [
                        { type: 'text', text: 'Please provide a query or keywords to search the documentation for.' }
                    ]
                }
            }

            const answerResults = []
            const answers: any = {}

            if (query) {
                const answerPromise = exa.answer(query, {
                    text: true,
                    systemPrompt: 'answer in a concise manner that is tailored for a software developer'
                })
                answerResults.push(
                    answerPromise.then((result) => {
                        answers.query = result.answer
                    })
                )
                answerPromise.then((result) => {
                    answers.query = result.answer
                })
            }

            if (keywords) {
                const keywordsPromise = exa
                    .searchAndContents(keywords.join(', '), {
                        text: true,
                        systemPrompt: 'answer in a concise manner that is tailored for a software developer'
                    })
                    .then((result) =>
                        result.results.reduce(
                            (acc, curr) =>
                                acc +
                                `
    <result>
        <title>${curr.title}</title>
        <content>${curr.text}</content>
    </result>`,
                            ''
                        )
                    )
                answerResults.push(keywordsPromise)
                keywordsPromise.then((result) => {
                    answers.keywords = result
                })
            }

            const results = (await Promise.all(answerResults)).join('\n\n')

            let email: string | null = null
            if (serverStaticConfiguration.authType?.includes('oauth')) {
                const session = await auth.api.getMcpSession({
                    headers: await headers()
                })
                if (session) {
                    const [mcpUser] = await db
                        .select()
                        .from(schema.mcpOAuthUser)
                        .where(eq(schema.mcpOAuthUser.id, session.userId))
                    if (mcpUser) {
                        email = mcpUser.email
                    }
                }
            }
            // update the database
            const promises: Array<Promise<any>> = [
                db.insert(schema.toolCalls).values({
                    toolName: 'search_documentation',
                    input: { context, keywords, query, email },
                    output: answers,
                    mcpServerId: serverStaticConfiguration.id
                })
            ]

            if (distinctId) {
                promises.push(
                    db
                        .update(schema.mcpServerUser)
                        .set({ email })
                        .where(eq(schema.mcpServerUser.distinctId, distinctId))
                )

                console.log('distinctId', distinctId)
                console.log('email', email)
            }
            if (!distinctId) {
                promises.push(
                    db.insert(schema.mcpServerUser).values({
                        distinctId: null,
                        email: email
                    })
                )
                console.log('distinctId', distinctId)
                console.log('email', email)
            }

            await Promise.all(promises)

            const result = `Here are the search results for your query: 
            
            ${answers.query ? `<answer>${answers.query}</answer>` : ''}
            ${answers.keywords ? `<keyword_search_results>${answers.keywords}</keyword_search_results>` : ''}
            `

            return {
                content: [
                    {
                        type: 'text',
                        text: `Here are the search results for your query: ${results}`
                    }
                ]
            }
        }
    )
}
