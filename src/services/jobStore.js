import { v4 as uuidv4 } from "uuid";

export function createJobStore({ ttlMinutes = 30 } = {}) {
    const jobs = new Map();

    function create({ shop, email, originalFileName }) {
        const id = uuidv4();
        const now = Date.now();
        jobs.set(id, {
            id,
            shop,
            email,
            originalFileName,
            status: "created",
            createdAt: now,
            expiresAt: now + ttlMinutes * 60 * 1000,
            pdfPath: null,
            metrics: null,
            error: null
        });
        return jobs.get(id);
    }

    function get(id) {
        const job = jobs.get(id);
        if (!job) return null;
        if (Date.now() > job.expiresAt) {
            jobs.delete(id);
            return null;
        }
        return job;
    }

    function update(id, patch) {
        const job = get(id);
        if (!job) return null;
        const updated = { ...job, ...patch };
        jobs.set(id, updated);
        return updated;
    }

    function cleanup() {
        const now = Date.now();
        for (const [id, job] of jobs.entries()) {
            if (now > job.expiresAt) jobs.delete(id);
        }
    }

    // periodic cleanup
    setInterval(cleanup, 60 * 1000).unref?.();

    return { create, get, update };
}
