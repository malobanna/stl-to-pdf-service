export function isValidEmail(email) {
    if (!email) return false;
    const cleaned = String(email).trim().toLowerCase();
    // pragmatic email check
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned);
}

export function mbToBytes(mb) {
    return Math.max(1, Number(mb || 1)) * 1024 * 1024;
}
