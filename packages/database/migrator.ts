import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db } from './index'

export const handler = async (event: any) => {
    await migrate(db, {
        migrationsFolder: './migrations'
    })
}
