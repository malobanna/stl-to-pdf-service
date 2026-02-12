import fs from "fs";
import path from "path";

export function createLocalStorage({ baseDir = "./runtime" } = {}) {
    const uploadsDir = path.join(baseDir, "uploads");
    const pdfDir = path.join(baseDir, "pdfs");
    const previewsDir = path.join(baseDir, "previews");

    // Ensure all directories exist
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.mkdirSync(pdfDir, { recursive: true });
    fs.mkdirSync(previewsDir, { recursive: true });

    function uploadPath(fileName) {
        return path.join(uploadsDir, fileName);
    }

    function pdfPath(fileName) {
        return path.join(pdfDir, fileName);
    }

    function previewPath(fileName) {
        return path.join(previewsDir, fileName);
    }

    function safeUnlink(p) {
        try {
            if (p && fs.existsSync(p)) {
                fs.unlinkSync(p);
            }
        } catch {}
    }

    return {
        baseDir,
        uploadsDir,
        pdfDir,
        previewsDir,
        uploadPath,
        pdfPath,
        previewPath,
        safeUnlink,
    };
}
