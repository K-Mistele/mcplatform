import { createHash } from 'node:crypto'
import { deflateSync } from 'node:zlib'

interface IdenticonResult {
    table: number[][]
    color: [number, number, number]
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
    const i = Math.floor(h * 6)
    const f = h * 6 - i
    const p = v * (1 - s)
    const q = v * (1 - f * s)
    const t = v * (1 - (1 - f) * s)

    switch (i % 6) {
        case 0:
            return [v, t, p]
        case 1:
            return [q, v, p]
        case 2:
            return [p, v, t]
        case 3:
            return [p, q, v]
        case 4:
            return [t, p, v]
        case 5:
            return [v, p, q]
        default:
            return [0, 0, 0]
    }
}

/**
 * Parse a hex color code (with or without #) into RGB values in the range 0-1.
 */
function parseHexColor(hexColor: string): [number, number, number] {
    // Remove # if present
    const hex = hexColor.replace('#', '')

    // Parse RGB components
    const r = Number.parseInt(hex.substring(0, 2), 16) / 255
    const g = Number.parseInt(hex.substring(2, 4), 16) / 255
    const b = Number.parseInt(hex.substring(4, 6), 16) / 255

    return [r, g, b]
}

/**
 * Deterministically select a color from the provided array based on the hash.
 */
function selectColorFromPalette(hash: string, colors: string[]): [number, number, number] {
    if (colors.length === 0) {
        // Fallback to a default color if no colors provided
        return [0.5, 0.5, 0.5] // Gray
    }

    // Use first 6 hex characters from hash to get a number
    const hexValue = hash.substring(0, 6)
    const colorIndex = Number.parseInt(hexValue, 16) % colors.length
    const selectedColor = colors[colorIndex]

    if (!selectedColor) {
        // Fallback to first color if selected index is somehow invalid
        return parseHexColor(colors[0]!)
    }

    return parseHexColor(selectedColor)
}

/**
 * Core identicon generation function that creates the pattern and color.
 * This is the main algorithm that all other functions build upon.
 */
export function generateIdenticonData(idcode: string, size = 5, colors?: string[]): IdenticonResult {
    // Create hash similar to Python version
    const hash1 = createHash('sha512').update(idcode, 'utf8').digest('hex')
    const hash2 = createHash('sha512')
        .update(idcode + 'SEED:3.1416', 'utf8')
        .digest('hex')
    const h = hash1 + hash2

    // Convert to binary and pad to 1024 bits
    const hashbin = BigInt('0x' + h)
        .toString(2)
        .padStart(1024, '0')

    // Initialize table
    const table: number[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => 0))

    // Fill table with symmetric pattern
    // Improved algorithm for better centering at larger sizes
    const totalIterations = size * Math.ceil(size / 2)
    const hashBits = hashbin.length

    let iterationCount = 0
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < Math.ceil(size / 2); j++) {
            // Use modular arithmetic to cycle through hash bits more evenly
            // This prevents running out of bits and ensures better distribution
            const bitIndex = (24 + iterationCount * 7) % hashBits
            const bit = Number.parseInt(hashbin[bitIndex] || '0')

            const row = table[i]
            if (row && j < row.length) {
                row[j] = bit
            }
            if (row && size - 1 - j < row.length) {
                row[size - 1 - j] = bit
            }

            iterationCount++
        }
    }

    let color: [number, number, number]

    // Use custom color palette if provided, otherwise calculate color from hash
    if (colors && colors.length > 0) {
        color = selectColorFromPalette(h, colors)
    } else {
        // Calculate color from hash bits (original algorithm)
        const hue = Number.parseInt(hashbin.slice(0, 8) || '0', 2) / 256
        const sat = (Number.parseInt(hashbin.slice(8, 16) || '0', 2) / 256) * 55 + 45

        let vrange: number
        if (sat < 60) {
            vrange = ((sat - 45) / 15) * 5 + 25
        } else {
            vrange = ((100 - sat) / 40) * 15 + 15
        }

        let vbase: number
        if (sat < 70) {
            vbase = ((sat - 45) / 25) * 5 + 45
        } else if (sat > 85) {
            vbase = ((sat - 85) / 15) * 5 + 60
        } else {
            vbase = ((sat - 70) / 15) * 10 + 50
        }

        const val = (Number.parseInt(hashbin.slice(16, 24) || '0', 2) / 256) * vrange + vbase
        color = hsvToRgb(hue, sat / 100, val / 100)
    }

    return { table, color }
}

/**
 * Generate an identicon as an SVG string.
 */
export function generateIdenticonSvg(idcode: string, size = 5, pixelSize = 20, colors?: string[]): string {
    const { table, color } = generateIdenticonData(idcode, size, colors)

    // Convert RGB values (0-1) to 0-255
    const rgb = color.map((c) => Math.round(c * 255))
    const colorStr = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`

    const totalSize = size * pixelSize

    // Generate SVG
    let svg = `<svg width="${totalSize}" height="${totalSize}" xmlns="http://www.w3.org/2000/svg">`
    svg += `<rect width="${totalSize}" height="${totalSize}" fill="white"/>`

    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            const row = table[i]
            if (row && row[j] === 1) {
                const x = j * pixelSize
                const y = i * pixelSize
                svg += `<rect x="${x}" y="${y}" width="${pixelSize}" height="${pixelSize}" fill="${colorStr}"/>`
            }
        }
    }

    svg += '</svg>'
    return svg
}

/**
 * Generate an identicon as a PNG Buffer using native Node.js PNG encoding.
 */
export function generateIdenticonPngBuffer(
    idcode: string,
    size = 5,
    pixelSize = 20,
    padding = 0,
    colors?: string[]
): Buffer {
    const { table, color } = generateIdenticonData(idcode, size, colors)

    // Convert RGB values (0-1) to 0-255
    const rgb = color.map((c) => Math.round(c * 255)) as [number, number, number]

    const identiconSize = size * pixelSize
    const paddingPixels = Math.round(identiconSize * padding)
    const width = identiconSize + paddingPixels * 2
    const height = identiconSize + paddingPixels * 2

    // Create RGBA pixel data (4 bytes per pixel: R, G, B, A)
    const pixelData = Buffer.alloc(width * height * 4)

    // Fill entire canvas with white first
    for (let i = 0; i < pixelData.length; i += 4) {
        pixelData[i] = 255 // R
        pixelData[i + 1] = 255 // G
        pixelData[i + 2] = 255 // B
        pixelData[i + 3] = 255 // A (fully opaque)
    }

    // Draw the identicon pattern in the center
    for (let y = 0; y < identiconSize; y++) {
        for (let x = 0; x < identiconSize; x++) {
            const tableY = Math.floor(y / pixelSize)
            const tableX = Math.floor(x / pixelSize)
            const row = table[tableY]
            const isPixelSet = Boolean(
                row && tableY >= 0 && tableY < table.length && tableX >= 0 && tableX < row.length && row[tableX] === 1
            )

            if (isPixelSet) {
                // Calculate position in the padded canvas
                const canvasX = x + paddingPixels
                const canvasY = y + paddingPixels
                const pixelIndex = (canvasY * width + canvasX) * 4

                // Use the identicon color
                pixelData[pixelIndex] = rgb[0] // R
                pixelData[pixelIndex + 1] = rgb[1] // G
                pixelData[pixelIndex + 2] = rgb[2] // B
                pixelData[pixelIndex + 3] = 255 // A (fully opaque)
            }
        }
    }

    return encodePNG(pixelData, width, height)
}

/**
 * Encode raw RGBA pixel data as a PNG buffer
 */
function encodePNG(pixelData: Buffer, width: number, height: number): Buffer {
    // PNG signature
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

    // IHDR chunk
    const ihdrData = Buffer.alloc(13)
    ihdrData.writeUInt32BE(width, 0) // Width
    ihdrData.writeUInt32BE(height, 4) // Height
    ihdrData.writeUInt8(8, 8) // Bit depth
    ihdrData.writeUInt8(6, 9) // Color type (6 = RGBA)
    ihdrData.writeUInt8(0, 10) // Compression method
    ihdrData.writeUInt8(0, 11) // Filter method
    ihdrData.writeUInt8(0, 12) // Interlace method

    const ihdr = createChunk('IHDR', ihdrData)

    // Prepare image data with scanline filters
    const scanlineLength = width * 4 + 1 // +1 for filter byte
    const imageData = Buffer.alloc(height * scanlineLength)

    for (let y = 0; y < height; y++) {
        const scanlineStart = y * scanlineLength
        imageData[scanlineStart] = 0 // Filter type 0 (None)

        const pixelRowStart = y * width * 4
        const pixelRowEnd = pixelRowStart + width * 4
        pixelData.copy(imageData, scanlineStart + 1, pixelRowStart, pixelRowEnd)
    }

    // Compress image data
    const compressedData = deflateSync(imageData)
    const idat = createChunk('IDAT', compressedData)

    // IEND chunk
    const iend = createChunk('IEND', Buffer.alloc(0))

    return Buffer.concat([signature, ihdr, idat, iend])
}

/**
 * Create a PNG chunk with length, type, data, and CRC
 */
function createChunk(type: string, data: Buffer): Buffer {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length, 0)

    const typeBuffer = Buffer.from(type, 'ascii')
    const crc = calculateCRC(Buffer.concat([typeBuffer, data]))
    const crcBuffer = Buffer.alloc(4)
    crcBuffer.writeUInt32BE(crc, 0)

    return Buffer.concat([length, typeBuffer, data, crcBuffer])
}

/**
 * Calculate CRC32 checksum for PNG chunks
 */
function calculateCRC(data: Buffer): number {
    const crcTable = getCRCTable()
    let crc = 0xffffffff

    for (let i = 0; i < data.length; i++) {
        const dataByte = data[i]
        if (dataByte !== undefined) {
            const tableIndex = (crc ^ dataByte) & 0xff
            const tableValue = crcTable[tableIndex]
            if (tableValue !== undefined) {
                crc = tableValue ^ (crc >>> 8)
            }
        }
    }

    return (crc ^ 0xffffffff) >>> 0
}

/**
 * Generate CRC lookup table
 */
function getCRCTable(): number[] {
    const table: number[] = []

    for (let i = 0; i < 256; i++) {
        let c = i
        for (let j = 0; j < 8; j++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
        }
        table[i] = c
    }

    return table
}
