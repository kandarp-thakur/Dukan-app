import { describe, it, expect, vi, beforeEach } from 'vitest';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { buildInvoicePdf, downloadBlob, A4_WIDTH_MM, A4_HEIGHT_MM, MAX_PDF_BYTES } from './invoicePdf';

vi.mock('html2canvas', () => ({ default: vi.fn() }));
vi.mock('jspdf', () => ({ jsPDF: vi.fn() }));

const makePdfStub = () => {
    const pdf = {
        addImage: vi.fn(),
        addPage: vi.fn(),
        output: vi.fn(() => new Blob(['pdf'], { type: 'application/pdf' })),
    };
    jsPDF.mockImplementation(() => pdf);
    return pdf;
};

describe('buildInvoicePdf', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rejects when there is no element to capture', async () => {
        await expect(buildInvoicePdf(null)).rejects.toThrow('Nothing to capture');
        expect(html2canvas).not.toHaveBeenCalled();
    });

    it('captures at 2x on a white background and emits a Blob', async () => {
        const canvas = { width: 1000, height: 1000, toDataURL: vi.fn(() => 'data:image/jpeg;base64,AAA') };
        html2canvas.mockResolvedValue(canvas);
        const pdf = makePdfStub();
        const element = document.createElement('div');

        const blob = await buildInvoicePdf(element);

        expect(html2canvas).toHaveBeenCalledWith(element, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
        });
        expect(pdf.addImage).toHaveBeenCalledTimes(1);
        expect(pdf.addPage).not.toHaveBeenCalled();
        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toBe('application/pdf');
    });

    it('slices a tall invoice across multiple A4 pages', async () => {
        // 1000 x 2000 px at 210 mm wide -> 420 mm tall -> two A4 pages.
        const canvas = { width: 1000, height: 2000, toDataURL: vi.fn(() => 'data:image/jpeg;base64,AAA') };
        html2canvas.mockResolvedValue(canvas);
        const pdf = makePdfStub();

        await buildInvoicePdf(document.createElement('div'));

        expect(pdf.addImage).toHaveBeenCalledTimes(2);
        expect(pdf.addPage).toHaveBeenCalledTimes(1);
        expect(pdf.addImage.mock.calls[0][4]).toBe(A4_WIDTH_MM);
        expect(pdf.addImage.mock.calls[1][3]).toBe(-A4_HEIGHT_MM);
    });

    it('surfaces an html2canvas failure to the caller', async () => {
        html2canvas.mockRejectedValue(new Error('canvas exploded'));
        await expect(buildInvoicePdf(document.createElement('div'))).rejects.toThrow('canvas exploded');
    });
});

describe('downloadBlob', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('URL', {
            createObjectURL: vi.fn(() => 'blob:fake'),
            revokeObjectURL: vi.fn(),
        });
    });

    it('clicks a temporary anchor and cleans up', () => {
        const click = vi.fn();
        const anchor = { href: '', download: '', click, remove: vi.fn() };
        const createElement = vi.spyOn(document, 'createElement').mockReturnValue(anchor);
        // The mocked anchor is a plain object, not a DOM Node, so short-circuit
        // the real Node.appendChild to keep it out of jsdom.
        const appendChild = vi.spyOn(document.body, 'appendChild').mockReturnValue(undefined);

        downloadBlob(new Blob(['x']), 'INV-1.pdf');

        expect(anchor.download).toBe('INV-1.pdf');
        expect(anchor.href).toBe('blob:fake');
        expect(click).toHaveBeenCalledTimes(1);
        expect(anchor.remove).toHaveBeenCalledTimes(1);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
        createElement.mockRestore();
        appendChild.mockRestore();
    });
});

describe('caps', () => {
    it('mirrors the server 5 MB attachment cap', () => {
        expect(MAX_PDF_BYTES).toBe(5 * 1024 * 1024);
    });
});
