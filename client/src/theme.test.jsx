import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('glass theme smoke test', () => {
  it('renders the app with glass card', () => {
    render(<App />);
    expect(screen.getByText('Acc App')).toBeInTheDocument();
  });
});
