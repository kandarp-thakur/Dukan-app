import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
// Mirrors the server-side multer cap so the client can reject before uploading.
export const MAX_PDF_BYTES = 5 * 1024 * 1024;

// The single PDF seam. The element must be laid out (not display:none) for
// html2canvas to measure it.
export const buildInvoicePdf = async (element) => {
    if (!element) throw new Error('Nothing to capture');

    const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
    });

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const imageHeight = (canvas.height * A4_WIDTH_MM) / canvas.width;

    // One tall image per page, offset upward each time. jsPDF clips the rest.
    let offset = 0;
    pdf.addImage(dataUrl, 'JPEG', 0, offset, A4_WIDTH_MM, imageHeight);
    let remaining = imageHeight - A4_HEIGHT_MM;
    while (remaining > 0) {
        offset -= A4_HEIGHT_MM;
        pdf.addPage();
        pdf.addImage(dataUrl, 'JPEG', 0, offset, A4_WIDTH_MM, imageHeight);
        remaining -= A4_HEIGHT_MM;
    }

    return pdf.output('blob');
};

export const downloadBlob = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
};
