import { createHash } from 'crypto'

/**
 * Verify PKCE code challenge
 * @param verifier The code_verifier provided by the client
 * @param challenge The code_challenge stored during authorization
 * @param method The code_challenge_method (should be 'S256')
 * @returns true if verification passes, false otherwise
 */
export function verifyPKCEChallenge(
    verifier: string,
    challenge: string,
    method: string = 'S256'
): boolean {
    // Only support S256 method for security
    if (method !== 'S256') {
        return false
    }

    // Validate inputs
    if (!verifier || !challenge) {
        return false
    }

    try {
        // Compute SHA256 hash of the verifier
        const hash = createHash('sha256').update(verifier).digest()
        
        // Convert to base64url encoding (no padding, URL-safe characters)
        const computed = hash
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '')

        // Use timing-safe comparison
        if (computed.length !== challenge.length) {
            return false
        }

        let mismatch = 0
        for (let i = 0; i < computed.length; i++) {
            mismatch |= computed.charCodeAt(i) ^ challenge.charCodeAt(i)
        }

        return mismatch === 0
    } catch (error) {
        console.error('[PKCE] Error verifying code challenge:', error)
        return false
    }
}