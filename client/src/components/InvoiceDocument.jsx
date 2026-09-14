import { formatINR, amountToWords } from '../utils/money';
import { formatDate } from '../utils/format';
import { lineBreakup } from '../utils/gst';

// Groups invoice lines by HSN + rate for the GST breakup table.
const buildBreakup = (invoice) => {
    const lines = lineBreakup(invoice.items, invoice.discount);
    const groups = new Map();
    invoice.items.forEach((it, i) => {
        const key = `${it.hsn || ''}|${it.gstRate || 0}`;
        const group = groups.get(key) || {
            hsn: it.hsn || '',
            gstRate: it.gstRate || 0,
            taxableValue: 0,
            tax: 0,
        };
        group.taxableValue += lines[i].taxableValue;
        group.tax += lines[i].tax;
        groups.set(key, group);
    });
    return [...groups.values()];
};

// variant="screen" keeps the glass panel; variant="print" is plain white so
// html2canvas captures it faithfully (it cannot reproduce glass or shadows).
export default function InvoiceDocument({ invoice, business, variant = 'screen' }) {
    const rootClass =
        variant === 'print'
            ? 'mx-auto max-w-3xl bg-white p-10'
            : 'glass mx-auto max-w-3xl bg-white p-10 print:p-0';

    const breakup = invoice.isGst ? buildBreakup(invoice) : [];
    const interState = invoice.isGst ? invoice.igst > 0 : false;

    return (
        <div className={rootClass}>
            <div className="flex items-start justify-between border-b border-gray-200 pb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                        {business?.name || 'My Business'}
                    </h2>
                    {business?.address && (
                        <p className="mt-1 text-sm text-gray-500">{business.address}</p>
                    )}
                    {business?.gstin && (
                        <p className="mt-1 text-sm text-gray-500">GSTIN: {business.gstin}</p>
                    )}
                </div>
                <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-gray-400">Invoice</p>
                    <p className="text-xl font-bold text-gray-900">
                        {invoice.invoiceNumber}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">{formatDate(invoice.date)}</p>
                </div>
            </div>

            {invoice.isGst && (
                <div className="mt-6 flex items-start justify-between gap-6">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-gray-400">Billed to</p>
                        <p className="font-semibold text-gray-800">
                            {invoice.buyerName || 'Walk-in customer'}
                        </p>
                        {invoice.buyerAddress && (
                            <p className="text-sm text-gray-500">{invoice.buyerAddress}</p>
                        )}
                        {invoice.buyerGstin && (
                            <p className="text-sm text-gray-500">
                                GSTIN: {invoice.buyerGstin}
                            </p>
                        )}
                    </div>
                    <div className="text-right">
                        <p className="text-xs uppercase tracking-wide text-gray-400">
                            Place of Supply
                        </p>
                        <p className="font-semibold text-gray-800">
                            {invoice.placeOfSupply || '—'}
                        </p>
                    </div>
                </div>
            )}

            {invoice.status === 'cancelled' && (
                <div className="mt-6 rounded-xl border-2 border-red-300 px-4 py-2 text-center text-sm font-bold uppercase tracking-widest text-red-600">
                    Cancelled
                </div>
            )}

            <table className="mt-6 w-full text-sm">
                <thead>
                    <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                        <th className="pb-2">#</th>
                        <th className="pb-2">Item</th>
                        {invoice.isGst && <th className="pb-2">HSN</th>}
                        <th className="pb-2 text-right">Qty</th>
                        <th className="pb-2 text-right">Rate</th>
                        {invoice.isGst && <th className="pb-2 text-right">GST</th>}
                        <th className="pb-2 text-right">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {invoice.items.map((it, i) => (
                        <tr key={i} className="border-b border-gray-100">
                            <td className="py-2 text-gray-400">{i + 1}</td>
                            <td className="py-2 font-medium text-gray-800">{it.name}</td>
                            {invoice.isGst && (
                                <td className="py-2 text-gray-500">{it.hsn || '—'}</td>
                            )}
                            <td className="py-2 text-right">{it.qty}</td>
                            <td className="py-2 text-right">{formatINR(it.rate)}</td>
                            {invoice.isGst && (
                                <td className="py-2 text-right">{it.gstRate || 0}%</td>
                            )}
                            <td className="py-2 text-right">{formatINR(it.amount)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {invoice.isGst && breakup.length > 0 && (
                <div className="mt-6">
                    <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">
                        Tax breakup
                    </p>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                                <th className="pb-2">HSN</th>
                                <th className="pb-2 text-right">Taxable value</th>
                                <th className="pb-2 text-right">Rate</th>
                                <th className="pb-2 text-right">
                                    {interState ? 'IGST' : 'CGST'}
                                </th>
                                {!interState && <th className="pb-2 text-right">SGST</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {breakup.map((g, i) => {
                                const half = Math.ceil(g.tax / 2);
                                return (
                                    <tr key={i} className="border-b border-gray-100">
                                        <td className="py-2">{g.hsn || '—'}</td>
                                        <td className="py-2 text-right">
                                            {formatINR(g.taxableValue)}
                                        </td>
                                        <td className="py-2 text-right">{g.gstRate}%</td>
                                        {interState ? (
                                            <td className="py-2 text-right">
                                                {formatINR(g.tax)}
                                            </td>
                                        ) : (
                                            <>
                                                <td className="py-2 text-right">
                                                    {formatINR(half)}
                                                </td>
                                                <td className="py-2 text-right">
                                                    {formatINR(g.tax - half)}
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="mt-4 flex justify-end">
                <div className="w-64 space-y-1 text-sm">
                    <div className="flex justify-between text-gray-600">
                        <span>Subtotal</span>
                        <span>{formatINR(invoice.subtotal)}</span>
                    </div>
                    {invoice.discount > 0 && (
                        <div className="flex justify-between text-gray-600">
                            <span>Discount</span>
                            <span>-{formatINR(invoice.discount)}</span>
                        </div>
                    )}
                    {invoice.isGst && interState && invoice.igst > 0 && (
                        <div className="flex justify-between text-gray-600">
                            <span>IGST</span>
                            <span>+{formatINR(invoice.igst)}</span>
                        </div>
                    )}
                    {invoice.isGst && !interState && invoice.cgst > 0 && (
                        <>
                            <div className="flex justify-between text-gray-600">
                                <span>CGST</span>
                                <span>+{formatINR(invoice.cgst)}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>SGST</span>
                                <span>+{formatINR(invoice.sgst)}</span>
                            </div>
                        </>
                    )}
                    {!invoice.isGst && invoice.tax > 0 && (
                        <div className="flex justify-between text-gray-600">
                            <span>Tax</span>
                            <span>+{formatINR(invoice.tax)}</span>
                        </div>
                    )}
                    <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900">
                        <span>Total</span>
                        <span>{formatINR(invoice.total)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                        <span>Payment</span>
                        <span className="uppercase">{invoice.paymentMethod}</span>
                    </div>
                </div>
            </div>
            <p className="mt-6 text-xs italic text-gray-500">
                Amount in words: {amountToWords(invoice.total)}
            </p>
            <div className="mt-8 flex items-end justify-between border-t border-dashed border-gray-200 pt-4 text-xs text-gray-400">
                <span>Thank you for your business!</span>
                <span>Scan UPI QR to pay (coming soon)</span>
            </div>
        </div>
    );
}
