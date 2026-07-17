import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FindFilmPage from './page';

vi.mock('next/link', () => ({ default: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a> }));

const inputs = () => screen.getAllByLabelText(/Letterboxd username \d/);
const addButton = () => screen.getByRole('button', { name: /add friend/i });
const submitButton = () => screen.getByRole('button', { name: /find our film/i });

describe('FindFilmPage', () => {
  beforeEach(() => sessionStorage.clear());

  it('starts with two username inputs, no remove buttons, submit disabled', () => {
    render(<FindFilmPage />);
    expect(inputs()).toHaveLength(2);
    expect(screen.queryByLabelText(/Remove username/)).toBeNull();
    expect(submitButton()).toBeDisabled();
  });

  it('adds rows up to six then disables Add friend; rows become removable', async () => {
    render(<FindFilmPage />);
    for (let i = 0; i < 4; i += 1) await userEvent.click(addButton());
    expect(inputs()).toHaveLength(6);
    expect(addButton()).toBeDisabled();

    await userEvent.click(screen.getAllByLabelText(/Remove username/)[0]);
    expect(inputs()).toHaveLength(5);
    expect(addButton()).toBeEnabled();
  });

  it('keeps submit disabled for duplicate usernames and enables it for two distinct ones', async () => {
    render(<FindFilmPage />);
    const [first, second] = inputs();
    await userEvent.type(first, 'semih');
    await userEvent.type(second, '@Semih ');
    expect(submitButton()).toBeDisabled();
    expect(screen.getByText(/every name has to be different/i)).toBeInTheDocument();

    await userEvent.clear(second);
    await userEvent.type(second, 'mutsuz');
    expect(submitButton()).toBeEnabled();
  });
});
