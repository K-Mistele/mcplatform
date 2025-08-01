import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db } from './index'

export const handler = async (event: any) => {
    console.log(`Migrating database...`)
    await migrate(db, {
        migrationsFolder: './migrations'
    })
    console.log(`Database migrated successfully`)
}
