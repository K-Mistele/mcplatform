import ngrok from '@ngrok/ngrok'

await ngrok.forward({
    port: 3000,
    proto: 'http',
    domain: 'pro-model-sturgeon.ngrok-free.app',
    authtoken: process.env.NGROK_AUTH_TOKEN
})

while (true) {
    await new Promise((resolve) => setTimeout(resolve, 100_000))
}
