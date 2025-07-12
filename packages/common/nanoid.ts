const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

export const nanoid = (length = 8) => {
    let result = ''
    const alphabetLength = ALPHABET.length
    for (let i = 0; i < length; i++) {
        result += ALPHABET.charAt(Math.floor(Math.random() * alphabetLength))
    }
    return result
}
