import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Toast from '../Toast';

describe('Toast Component', () => {
  it('should render success toast', () => {
    render(<Toast message="Success!" type="success" onClose={vi.fn()} />);
    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('should render error toast', () => {
    render(<Toast message="Error occurred" type="error" onClose={vi.fn()} />);
    expect(screen.getByText('Error occurred')).toBeInTheDocument();
    expect(screen.getByText('✗')).toBeInTheDocument();
  });

  it('should call onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<Toast message="Test" onClose={onClose} />);
    
    const closeButton = screen.getByText('×');
    closeButton.click();
    
    expect(onClose).toHaveBeenCalled();
  });

  it('should auto-close after duration', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    
    render(<Toast message="Test" onClose={onClose} duration={1000} />);
    
    vi.advanceTimersByTime(1000);
    expect(onClose).toHaveBeenCalled();
    
    vi.useRealTimers();
  });
});