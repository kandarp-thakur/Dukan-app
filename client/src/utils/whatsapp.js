// WhatsApp needs a country-coded, digits-only number.
export const toWhatsAppNumber = (phone) => {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';
    const trimmed = digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits;
    return trimmed.length === 10 ? `91${trimmed}` : trimmed;
};

export const whatsappUrl = (phone, text) =>
    `https://wa.me/${toWhatsAppNumber(phone)}?text=${encodeURIComponent(text)}`;
