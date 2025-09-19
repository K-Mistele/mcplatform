import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

// Generate a stable RSA key pair for this instance
// In production, this should be stored in a secure key management service
const generateJWKS = () => {
    // For now, return a placeholder JWKS that indicates we don't sign JWTs
    // Since we're acting as a proxy and not issuing ID tokens, we don't need signing keys
    return {
        keys: []
    }
}

export async function GET() {
    await headers()
    
    // Return the JWKS (JSON Web Key Set)
    // Since we're a proxy server and don't issue signed JWTs (we use opaque tokens),
    // we return an empty key set. This endpoint exists for RFC compliance.
    const jwks = generateJWKS()
    
    return new Response(JSON.stringify(jwks), {
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    })
}

// Handle CORS preflight
export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400'
        }
    })
}