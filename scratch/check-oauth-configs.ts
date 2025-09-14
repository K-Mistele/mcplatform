import { db, schema } from 'database'

async function checkOAuthConfigs() {
    const configs = await db.select().from(schema.customOAuthConfigs)
    console.log('Total OAuth Configs:', configs.length)
    console.log('Configs:', JSON.stringify(configs, null, 2))
    
    // Check for the most recent one named "Google"
    const googleConfigs = configs.filter(c => c.name === 'Google')
    console.log('\nGoogle configs found:', googleConfigs.length)
    if (googleConfigs.length > 0) {
        console.log('Latest Google config:', JSON.stringify(googleConfigs[googleConfigs.length - 1], null, 2))
    }
    
    process.exit(0)
}

checkOAuthConfigs().catch(console.error)