import { Receipt, FileText, Wallet, BookOpen, Truck, BarChart3 } from 'lucide-react';

const FEATURES = [
    { icon: Receipt, title: 'Sales & invoicing', text: 'Record sales and create invoices in seconds.' },
    { icon: FileText, title: 'GST invoices', text: 'HSN, tax breakup and PDF download built in.' },
    { icon: Wallet, title: 'Expenses', text: 'Track every business expense against your sales.' },
    { icon: BookOpen, title: 'Customers & khata', text: 'Udhaar balances and payments in one ledger.' },
    { icon: Truck, title: 'Suppliers & purchases', text: 'Purchase entries and supplier payments.' },
    { icon: BarChart3, title: 'Reports & dashboard', text: 'Daily profit, monthly and outstanding views.' },
];

export default function FeaturesSection() {
    return (
        <section id="features" className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-2xl font-bold text-primary sm:text-3xl">Everything your shop needs</h2>
            <p className="mt-2 text-gray-600">No spreadsheets, no scattered notebooks.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {FEATURES.map(({ icon: Icon, title, text }) => (
                    <div key={title} className="glass-card p-5">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/60">
                            <Icon size={24} className="text-primary" />
                        </span>
                        <h3 className="mt-3 font-semibold text-gray-800">{title}</h3>
                        <p className="mt-1 text-sm text-gray-600">{text}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}
