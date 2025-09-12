import { createOpencodeClient, createOpencodeServer } from '@opencode-ai/sdk'

const server = await createOpencodeServer({
    port: 8099
})

const sessionId = 'ses_7cbe170b3ffeIfBwe30iL1Icot'
try {
    const client = createOpencodeClient({
        baseUrl: server.url
    })
    const { data: session } = await client.session.get({ path: { id: sessionId } })
    console.log(session)
    const { data: messages } = await client.session.messages({ path: { id: sessionId } })
    console.log(messages)
} catch (error: unknown) {
    console.error(error)
} finally {
    await server.close()
}
