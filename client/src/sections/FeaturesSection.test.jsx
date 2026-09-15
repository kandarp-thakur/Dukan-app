import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FeaturesSection from './FeaturesSection';

describe('FeaturesSection', () => {
    it('renders all six feature titles', () => {
        render(<FeaturesSection />);
        ['Sales & invoicing', 'GST invoices', 'Expenses', 'Customers & khata', 'Suppliers & purchases', 'Reports & dashboard'].forEach(
            (title) => {
                expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
            }
        );
    });
});
