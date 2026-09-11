import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PlaceholderPage from './components/PlaceholderPage';

describe('theme wiring smoke test', () => {
  it('renders a themed placeholder page', () => {
    render(<PlaceholderPage title="Smoke Test" />);
    expect(screen.getByRole('heading', { name: 'Smoke Test' })).toBeInTheDocument();
  });
});
