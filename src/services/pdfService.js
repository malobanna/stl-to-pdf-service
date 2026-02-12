import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

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

        // ===== Brand Colors =====
        const brandBlue = "#0071CE";

        // ===== Logo =====
        const logoPath = path.resolve("./runtime/assets/logo.png");
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 50, 40, { width: 120 });
        }

        doc.moveDown(3);

        // ===== Title =====
        doc.fillColor(brandBlue)
            .fontSize(24)
            .text("STL Analysis Report");

        doc.fillColor("black");
        doc.moveDown(0.5);

        doc.fontSize(10)
            .fillColor("gray")
            .text(`Generated: ${new Date().toISOString()}`);

        doc.text(`Report generated: ${reportUrl}`);
        doc.fillColor("black");

        doc.moveDown(1.5);

        // ===== User Info =====
        doc.fontSize(12).text(`User Email: ${email}`);
        doc.text(`STL File: ${originalFileName}`);

        doc.moveDown(1.5);

        // ===== Metrics =====
        doc.fillColor(brandBlue).fontSize(16).text("Model Metrics");
        doc.fillColor("black").moveDown(0.5);

        doc.fontSize(12).text(`Triangles: ${metrics.triangleCount}`);

        if (metrics.volume !== null) {
            doc.text(`Estimated Volume (STL units³): ${metrics.volume.toFixed(3)}`);
        }

        if (metrics.bbox) {
            const { min, max, size } = metrics.bbox;

            doc.moveDown(0.5);
            doc.text("Bounding Box:");

            doc.text(`Min:  x=${min.x.toFixed(3)}  y=${min.y.toFixed(3)}  z=${min.z.toFixed(3)}`);
            doc.text(`Max:  x=${max.x.toFixed(3)}  y=${max.y.toFixed(3)}  z=${max.z.toFixed(3)}`);
            doc.text(`Size: x=${size.x.toFixed(3)}  y=${size.y.toFixed(3)}  z=${size.z.toFixed(3)}`);
        }

        doc.moveDown(1.5);

        doc.fontSize(9)
            .fillColor("gray")
            .text(
                "Note: Units depend on the STL authoring tool. For accurate print volume in mm³, confirm scale in your slicer software.",
                { align: "left" }
            );

        doc.end();
    });
}
