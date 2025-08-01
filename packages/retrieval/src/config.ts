/**
 * Configurations for throttling and batching and rate-limiting and all that neat stuff
 *
 * For gemini you can find limit information here: https://ai.google.dev/gemini-api/docs/rate-limits
 */

// Config for throttling on chat completions API
export const CHAT_COMPLETIONS_API_THROTTLE_LIMIT = 1_000
export const CHAT_COMPLETIONS_API_THROTTLE_PERIOD = '1m'

// Config for batching/gathering chunks for embedding
//     This defines how many chunks to send to API at once, and period to wait before sending if batch not full
export const EMBED_CHUNK_API_BATCH_SIZE = 100
export const EMBED_CHUNK_API_BATCH_GATHER_PERIOD = '5s'

// Config for throttling on embedding API
export const EMBED_CHUNK_API_THROTTLE_LIMIT = 3_000
export const EMBED_CHUNK_API_THROTTLE_PERIOD = '1m'
