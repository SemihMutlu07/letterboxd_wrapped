import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---- OrientationToggle -------------------------------------------------------

import OrientationToggle from '@/components/share/OrientationToggle';

describe('OrientationToggle', () => {
  it('renders both orientation buttons', () => {
    render(<OrientationToggle orientation="horizontal" onChange={() => {}} />);
    expect(screen.getByText('Horizontal')).toBeInTheDocument();
    expect(screen.getByText('Vertical')).toBeInTheDocument();
  });

  it('calls onChange with "vertical" when Vertical is clicked', async () => {
    const onChange = vi.fn();
    render(<OrientationToggle orientation="horizontal" onChange={onChange} />);
    await userEvent.click(screen.getByText('Vertical'));
    expect(onChange).toHaveBeenCalledWith('vertical');
  });

  it('calls onChange with "horizontal" when Horizontal is clicked', async () => {
    const onChange = vi.fn();
    render(<OrientationToggle orientation="vertical" onChange={onChange} />);
    await userEvent.click(screen.getByText('Horizontal'));
    expect(onChange).toHaveBeenCalledWith('horizontal');
  });

  it('applies active style to the selected orientation', () => {
    const { rerender } = render(
      <OrientationToggle orientation="horizontal" onChange={() => {}} />,
    );
    const horizontalBtn = screen.getByText('Horizontal').closest('button')!;
    expect(horizontalBtn.className).toMatch(/bg-gradient-to-r/);

    rerender(<OrientationToggle orientation="vertical" onChange={() => {}} />);
    const verticalBtn = screen.getByText('Vertical').closest('button')!;
    expect(verticalBtn.className).toMatch(/bg-gradient-to-r/);
  });
});

// ---- UploadZone --------------------------------------------------------------

import UploadZone from '@/components/landing/UploadZone';

describe('UploadZone', () => {
  it('renders upload prompt text', () => {
    render(<UploadZone onFiles={() => {}} />);
    expect(screen.getByText(/Begin Your Cinema Reveal/i)).toBeInTheDocument();
    expect(screen.getByText(/Drag your Letterboxd export/i)).toBeInTheDocument();
  });

  it('has an accessible region label', () => {
    render(<UploadZone onFiles={() => {}} />);
    expect(screen.getByRole('region', { name: /upload your letterboxd data/i })).toBeInTheDocument();
  });

  it('calls onFiles with dropped files', () => {
    const onFiles = vi.fn();
    render(<UploadZone onFiles={onFiles} />);
    const region = screen.getByRole('region', { name: /upload your letterboxd data/i });
    const dropZone = region.querySelector('[role="button"]') as HTMLElement;

    const file = new File(['content'], 'export.zip', { type: 'application/zip' });
    const dataTransfer = { files: [file] as unknown as FileList };

    fireEvent.drop(dropZone, { dataTransfer });
    expect(onFiles).toHaveBeenCalledWith(dataTransfer.files);
  });

  it('has a hidden file input that accepts zip and csv', () => {
    render(<UploadZone onFiles={() => {}} />);
    const input = document.getElementById('upload-zone-input') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.accept).toContain('.zip');
    expect(input.accept).toContain('.csv');
  });
});
