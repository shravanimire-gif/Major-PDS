// eslint-disable-next-line no-unused-vars -- JSX below compiles to React.createElement in this test/build pipeline
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import Card from './Card';

afterEach(() => {
  cleanup();
});

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Panel content</Card>);
    expect(screen.getByText('Panel content')).toBeInTheDocument();
  });

  it('applies surface, border, and radius classes with no shadow', () => {
    render(<Card>Content</Card>);
    const card = screen.getByText('Content');
    expect(card).toHaveClass('bg-ds-surface', 'border', 'border-ds-subtle', 'rounded-ds-lg', 'p-5');
    expect(card.className).not.toMatch(/shadow/);
  });

  it('merges custom className', () => {
    render(<Card className="custom-card">Content</Card>);
    expect(screen.getByText('Content')).toHaveClass('custom-card', 'bg-ds-surface');
  });

  it('spreads additional props such as onClick', async () => {
    const user = userEvent.setup();
    let clicked = false;
    render(
      <Card onClick={() => (clicked = true)} data-testid="clickable-card">
        Click me
      </Card>
    );
    await user.click(screen.getByTestId('clickable-card'));
    expect(clicked).toBe(true);
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Card>Accessible content</Card>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
