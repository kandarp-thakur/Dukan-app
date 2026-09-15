import { Link } from 'react-router-dom';

export default function CtaSection() {
    return (
        <section className="mx-auto max-w-4xl px-4 pb-4">
            <div className="glass p-8 text-center sm:p-12">
                <h2 className="text-2xl font-bold text-primary sm:text-3xl">Ready to tidy up your books?</h2>
                <p className="mt-2 text-gray-600">
                    Create your business account in under a minute — no card required.
                </p>
                <Link to="/register" className="btn-primary mt-6">
                    Get started
                </Link>
            </div>
        </section>
    );
}
