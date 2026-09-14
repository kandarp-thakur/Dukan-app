const { formatINR, amountToWords } = require('../utils/money');

// Table-based markup only: no flexbox, no external CSS, no webfonts.
const invoiceEmailHtml = ({ business, invoice, link }) => {
    const name = (business && business.name) || 'Our store';
    const address = (business && business.address) || '';
    const gstin = (business && business.gstin) || '';
    const button = link
        ? `<p style="margin:24px 0"><a href="${link}" style="background:#4f46e5;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">View invoice online</a></p>`
        : '';

    return `<!doctype html>
<html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:32px">
<tr><td>
<h1 style="margin:0;font-size:20px">${name}</h1>
${address ? `<p style="margin:4px 0;color:#6b7280;font-size:13px">${address}</p>` : ''}
${gstin ? `<p style="margin:4px 0;color:#6b7280;font-size:13px">GSTIN: ${gstin}</p>` : ''}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
<p style="margin:0 0 8px">Invoice <strong>${invoice.invoiceNumber}</strong></p>
<p style="margin:0 0 8px;color:#6b7280;font-size:13px">${new Date(invoice.date).toDateString()}</p>
<p style="margin:16px 0 0;font-size:24px;font-weight:700">${formatINR(invoice.total)}</p>
<p style="margin:4px 0 0;color:#6b7280;font-size:13px">${amountToWords(invoice.total)}</p>
${button}
<p style="margin:24px 0 0;color:#6b7280;font-size:13px">The invoice PDF is attached to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
};

module.exports = { invoiceEmailHtml };
