import { db, schema } from 'database'
import { eq } from 'drizzle-orm'

async function insertExampleNamespace() {
    try {
        // First check if the organization exists
        const existingOrg = await db
            .select()
            .from(schema.organization)
            .where(eq(schema.organization.id, 'inngest-test'))
            .limit(1)

        // If organization doesn't exist, create it
        if (existingOrg.length === 0) {
            await db.insert(schema.organization).values({
                id: 'inngest-test',
                name: 'Inngest Test Organization',
                createdAt: new Date()
            })
            console.log('Created organization: inngest-test')
        } else {
            console.log('Organization inngest-test already exists')
        }

        // Check if namespace already exists
        const existingNamespace = await db
            .select()
            .from(schema.retrievalNamespace)
            .where(eq(schema.retrievalNamespace.id, 'inngest-ns'))
            .limit(1)

        if (existingNamespace.length === 0) {
            // Insert the namespace
            await db.insert(schema.retrievalNamespace).values({
                id: 'inngest-ns',
                organizationId: 'inngest-test',
                name: 'Inngest Example Namespace',
                description: 'Example namespace for Inngest organization',
                createdAt: Date.now()
            })
            console.log('Successfully inserted namespace: inngest-ns for organization: inngest-test')
        } else {
            console.log('Namespace inngest-ns already exists')
        }

        process.exit(0)
    } catch (error) {
        console.error('Error inserting namespace:', error)
        process.exit(1)
    }
}

// Run the function
insertExampleNamespace()