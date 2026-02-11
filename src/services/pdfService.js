import PDFDocument from "pdfkit";
import fs from "fs";

export async function generatePdfReport({
                                            outputPath,
                                            email,
                                            originalFileName,
                                            shop,
                                            metrics
                                        }) {
    await new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", margin: 50 });
        const stream = fs.createWriteStream(outputPath);

        stream.on("finish", resolve);
        stream.on("error", reject);

        doc.pipe(stream);

        doc.fontSize(20).text("STL Report", { align: "left" });
        doc.moveDown(0.5);
        doc.fontSize(10).text(`Generated: ${new Date().toISOString()}`);
        if (shop) doc.text(`Shop: ${shop}`);
        doc.text(`User Email: ${email}`);
        doc.text(`STL File: ${originalFileName}`);
        doc.moveDown();

        doc.fontSize(14).text("Model Metrics");
        doc.moveDown(0.5);

        doc.fontSize(12).text(`Triangles: ${metrics.triangleCount}`);

        if (metrics.bbox) {
            const { min, max, size } = metrics.bbox;
            doc.moveDown(0.5);
            doc.text("Bounding Box (STL units):");
            doc.text(`Min:  x=${min.x.toFixed(3)}  y=${min.y.toFixed(3)}  z=${min.z.toFixed(3)}`);
            doc.text(`Max:  x=${max.x.toFixed(3)}  y=${max.y.toFixed(3)}  z=${max.z.toFixed(3)}`);
            doc.text(`Size: x=${size.x.toFixed(3)}  y=${size.y.toFixed(3)}  z=${size.z.toFixed(3)}`);
        } else {
            doc.moveDown(0.5);
            doc.text("Bounding box: not available (no facets detected).");
        }

        doc.moveDown();
        doc.fontSize(10).text(
            "Note: Units depend on the STL authoring tool. For print-ready mm, confirm scale in your slicer."
        );

        doc.end();
    });
}
