import { Turbopuffer } from '@turbopuffer/turbopuffer'

export const turboPuffer = new Turbopuffer({
    apiKey: process.env.TURBOPUFFER_API_KEY!,
    region: 'aws-us-east-1' // closest to our backend.
})
