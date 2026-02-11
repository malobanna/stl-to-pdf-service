import fs from "fs";
import path from "path";

export function createLocalStorage({ baseDir = "./runtime" } = {}) {
    const uploadsDir = path.join(baseDir, "uploads");
    const pdfDir = path.join(baseDir, "pdfs");

    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.mkdirSync(pdfDir, { recursive: true });

    function uploadPath(fileName) {
        return path.join(uploadsDir, fileName);
    }

    function pdfPath(fileName) {
        return path.join(pdfDir, fileName);
    }

    function safeUnlink(p) {
        try { fs.unlinkSync(p); } catch {}
    }

    return { uploadPath, pdfPath, safeUnlink, uploadsDir, pdfDir };
}
