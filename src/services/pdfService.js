import PDFDocument from "pdfkit";
import fs from "fs";

export async function generatePdfReport({
                                            outputPath,
                                            email,
                                            originalFileName,
                                            reportUrl,
                                            metrics
                                        }) {
    await new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", margin: 50 });
        const stream = fs.createWriteStream(outputPath);

        stream.on("finish", resolve);
        stream.on("error", reject);

        doc.pipe(stream);

        // ===== Header =====
        doc.fontSize(22).text("STL → PDF Report", { align: "left" });
        doc.moveDown(0.5);

        doc.fontSize(10).fillColor("gray")
            .text(`Generated: ${new Date().toISOString()}`);
        doc.text(`Report generated: ${reportUrl}`);
        doc.fillColor("black");

        doc.moveDown(1);

        // ===== User Info =====
        doc.fontSize(12).text(`User Email: ${email}`);
        doc.text(`STL File: ${originalFileName}`);

        doc.moveDown(1);

        // ===== Metrics Section =====
        doc.fontSize(16).text("Model Metrics");
        doc.moveDown(0.5);

        doc.fontSize(12).text(`Triangles: ${metrics.triangleCount}`);

        if (metrics.bbox) {
            const { min, max, size } = metrics.bbox;

            doc.moveDown(0.5);
            doc.text("Bounding Box (STL units):");

            doc.moveDown(0.3);
            doc.text(`Min:  x=${min.x.toFixed(3)}  y=${min.y.toFixed(3)}  z=${min.z.toFixed(3)}`);
            doc.text(`Max:  x=${max.x.toFixed(3)}  y=${max.y.toFixed(3)}  z=${max.z.toFixed(3)}`);
            doc.text(`Size: x=${size.x.toFixed(3)}  y=${size.y.toFixed(3)}  z=${size.z.toFixed(3)}`);
        } else {
            doc.moveDown(0.5);
            doc.text("Bounding box: not available (no facets detected).");
        }

        doc.moveDown(1);

        // ===== Footer Note =====
        doc.fontSize(9).fillColor("gray").text(
            "Note: Units depend on the STL authoring tool. For print-ready millimeters, confirm scale in your slicer software.",
            { align: "left" }
        );

        doc.end();
    });
}
