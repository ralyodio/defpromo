import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CostTracker from '../CostTracker';
import * as apiCost from '../../services/apiCost';

// Mock the apiCost service
vi.mock('../../services/apiCost', () => ({
  getProjectCost: vi.fn(),
  getCostByProject: vi.fn(),
}));

// Mock chrome runtime API
global.chrome = {
  runtime: {
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    sendMessage: vi.fn(),
  },
};

describe('CostTracker Component', () => {
  const mockProjects = [
    { id: 'proj-1', name: 'Project Alpha' },
    { id: 'proj-2', name: 'Project Beta' },
    { id: 'proj-3', name: 'Project Gamma' },
  ];

  const mockActiveProject = mockProjects[0];

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    apiCost.getProjectCost.mockResolvedValue(0);
    apiCost.getCostByProject.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial Rendering', () => {
    it('should show loading state initially', () => {
      render(<CostTracker activeProject={mockActiveProject} projects={mockProjects} />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should load and display project cost', async () => {
      apiCost.getProjectCost.mockResolvedValue(0.0156);
      apiCost.getCostByProject.mockResolvedValue({
        'proj-1': 0.0156,
      });

      render(<CostTracker activeProject={mockActiveProject} projects={mockProjects} />);

      await waitFor(() => {
        expect(screen.getByText('Project:')).toBeInTheDocument();
        // Cost is displayed with 4 decimal places
        expect(screen.getByText('$0.0156')).toBeInTheDocument();
      });
    });

    it('should display total cost when no active project', async () => {
      apiCost.getCostByProject.mockResolvedValue({
        'proj-1': 0.0156,
        'proj-2': 0.0234,
      });

      render(<CostTracker activeProject={null} projects={mockProjects} />);

      await waitFor(() => {
        expect(screen.getByText('Total:')).toBeInTheDocument();
        // Total: 0.0156 + 0.0234 = 0.0390
        expect(screen.getByText('$0.0390')).toBeInTheDocument();
      });
    });
  });

  describe('Cost Formatting', () => {
    it('should display $0.0000 for zero cost', async () => {
      apiCost.getProjectCost.mockResolvedValue(0);
      apiCost.getCostByProject.mockResolvedValue({ 'proj-1': 0 });

      render(<CostTracker activeProject={mockActiveProject} projects={mockProjects} />);

      await waitFor(() => {
        expect(screen.getByText('$0.0000')).toBeInTheDocument();
      });
    });

    it('should display 4 decimal places for costs under $0.01', async () => {
      apiCost.getProjectCost.mockResolvedValue(0.0003);
      apiCost.getCostByProject.mockResolvedValue({ 'proj-1': 0.0003 });

      render(<CostTracker activeProject={mockActiveProject} projects={mockProjects} />);

      await waitFor(() => {
        expect(screen.getByText('$0.0003')).toBeInTheDocument();
      });
    });

    it('should display 4 decimal places for all costs', async () => {
      apiCost.getProjectCost.mockResolvedValue(0.15);
      apiCost.getCostByProject.mockResolvedValue({ 'proj-1': 0.15 });

      render(<CostTracker activeProject={mockActiveProject} projects={mockProjects} />);

      await waitFor(() => {
        expect(screen.getByText('$0.1500')).toBeInTheDocument();
      });
    });

    it('should handle very small costs correctly', async () => {
      apiCost.getProjectCost.mockResolvedValue(0.0001);
      apiCost.getCostByProject.mockResolvedValue({ 'proj-1': 0.0001 });

      render(<CostTracker activeProject={mockActiveProject} projects={mockProjects} />);

      await waitFor(() => {
        expect(screen.getByText('$0.0001')).toBeInTheDocument();
      });
    });
  });

  describe('Cost Details Dropdown', () => {
    it('should toggle details dropdown on button click', async () => {
      apiCost.getProjectCost.mockResolvedValue(0.05);
      apiCost.getCostByProject.mockResolvedValue({
        'proj-1': 0.05,
        'proj-2': 0.03,
      });

      render(<CostTracker activeProject={mockActiveProject} projects={mockProjects} />);

      await waitFor(() => {
        expect(screen.getByText('$0.0500')).toBeInTheDocument();
      });

      // Click to open dropdown
      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('API Cost Breakdown')).toBeInTheDocument();
        expect(screen.getByText('Total Spent (All Projects)')).toBeInTheDocument();
      });

      // Click to close dropdown
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.queryByText('API Cost Breakdown')).not.toBeInTheDocument();
      });
    });

    it('should display all projects in breakdown', async () => {
      apiCost.getProjectCost.mockResolvedValue(0.05);
      apiCost.getCostByProject.mockResolvedValue({
        'proj-1': 0.05,
        'proj-2': 0.03,
        'proj-3': 0.02,
      });

      render(<CostTracker activeProject={mockActiveProject} projects={mockProjects} />);

      await waitFor(() => {
        expect(screen.getByText('$0.0500')).toBeInTheDocument();
      });

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument();
        expect(screen.getByText('Project Beta')).toBeInTheDocument();
        expect(screen.getByText('Project Gamma')).toBeInTheDocument();
      });
    });

    it('should highlight active project in breakdown', async () => {
      apiCost.getProjectCost.mockResolvedValue(0.05);
      apiCost.getCostByProject.mockResolvedValue({
        'proj-1': 0.05,
        'proj-2': 0.03,
      });

      render(<CostTracker activeProject={mockActiveProject} projects={mockProjects} />);

      await waitFor(() => {
        expect(screen.getByText('$0.0500')).toBeInTheDocument();
      });

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        // Find the parent div that contains the project name and has the bg-primary-50 class
        const activeProjectElement = screen.getByText('Project Alpha').closest('.bg-primary-50');
        expect(activeProjectElement).toBeInTheDocument();
        expect(activeProjectElement).toHaveClass('bg-primary-50', 'border', 'border-primary-200');
      });
    });

    it('should close dropdown when clicking backdrop', async () => {
      apiCost.getProjectCost.mockResolvedValue(0.05);
      apiCost.getCostByProject.mockResolvedValue({ 'proj-1': 0.05 });

      render(<CostTracker activeProject={mockActiveProject} projects={mockProjects} />);

      await waitFor(() => {
        expect(screen.getByText('$0.0500')).toBeInTheDocument();
      });

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('API Cost Breakdown')).toBeInTheDocument();
      });

      // Click backdrop
      const backdrop = document.querySelector('.fixed.inset-0');
      fireEvent.click(backdrop);

      await waitFor(() => {
        expect(screen.queryByText('API Cost Breakdown')).not.toBeInTheDocument();
      });
    });
  });

  describe('Chrome Message Listener', () => {
    it('should register message listener on mount', async () => {
      render(<CostTracker activeProject={mockActiveProject} projects={mockProjects} />);

      await waitFor(() => {
        expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
      });
    });

    it('should remove message listener on unmount', async () => {
      const { unmount } = render(
        <CostTracker activeProject={mockActiveProject} projects={mockProjects} />
      );

      await waitFor(() => {
        expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
      });

      unmount();

      expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalled();
    });

    it('should reload costs when COST_UPDATED message received', async () => {
      apiCost.getProjectCost.mockResolvedValue(0.05);
      apiCost.getCostByProject.mockResolvedValue({ 'proj-1': 0.05 });

      render(<CostTracker activeProject={mockActiveProject} projects={mockProjects} />);

      await waitFor(() => {
        expect(apiCost.getProjectCost).toHaveBeenCalledTimes(1);
      });

      // Simulate receiving a COST_UPDATED message
      const messageHandler = chrome.runtime.onMessage.addListener.mock.calls[0][0];
      
      // Update mock to return new cost
      apiCost.getProjectCost.mockResolvedValue(0.08);
      apiCost.getCostByProject.mockResolvedValue({ 'proj-1': 0.08 });

      messageHandler({ type: 'COST_UPDATED', data: { projectId: 'proj-1', cost: 0.03 } });

      await waitFor(() => {
        expect(apiCost.getProjectCost).toHaveBeenCalledTimes(2);
      });
    });

    it('should ignore non-COST_UPDATED messages', async () => {
      apiCost.getProjectCost.mockResolvedValue(0.05);
      apiCost.getCostByProject.mockResolvedValue({ 'proj-1': 0.05 });

      render(<CostTracker activeProject={mockActiveProject} projects={mockProjects} />);

      await waitFor(() => {
        expect(apiCost.getProjectCost).toHaveBeenCalledTimes(1);
      });

      const messageHandler = chrome.runtime.onMessage.addListener.mock.calls[0][0];
      messageHandler({ type: 'OTHER_MESSAGE', data: {} });

      // Should not trigger additional cost load
      await waitFor(() => {
        expect(apiCost.getProjectCost).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Refresh Key Updates', () => {
    it('should reload costs when refreshKey changes', async () => {
      apiCost.getProjectCost.mockResolvedValue(0.05);
      apiCost.getCostByProject.mockResolvedValue({ 'proj-1': 0.05 });

      const { rerender } = render(
        <CostTracker activeProject={mockActiveProject} projects={mockProjects} refreshKey={0} />
      );

      await waitFor(() => {
        expect(apiCost.getProjectCost).toHaveBeenCalledTimes(1);
      });

      // Update refreshKey
      rerender(
        <CostTracker activeProject={mockActiveProject} projects={mockProjects} refreshKey={1} />
      );

      await waitFor(() => {
        expect(apiCost.getProjectCost).toHaveBeenCalledTimes(2);
      });
    });

    it('should reload costs when active project changes', async () => {
      apiCost.getProjectCost.mockResolvedValue(0.05);
      apiCost.getCostByProject.mockResolvedValue({ 'proj-1': 0.05 });

      const { rerender } = render(
        <CostTracker activeProject={mockActiveProject} projects={mockProjects} />
      );

      await waitFor(() => {
        expect(apiCost.getProjectCost).toHaveBeenCalledWith('proj-1');
      });

      // Change active project
      apiCost.getProjectCost.mockResolvedValue(0.03);
      rerender(<CostTracker activeProject={mockProjects[1]} projects={mockProjects} />);

      await waitFor(() => {
        expect(apiCost.getProjectCost).toHaveBeenCalledWith('proj-2');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      apiCost.getProjectCost.mockRejectedValue(new Error('API Error'));
      apiCost.getCostByProject.mockRejectedValue(new Error('API Error'));

      render(<CostTracker activeProject={mockActiveProject} projects={mockProjects} />);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          'Failed to load costs:',
          expect.any(Error)
        );
      });

      consoleError.mockRestore();
    });

    it('should display $0.0000 when API fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiCost.getProjectCost.mockRejectedValue(new Error('API Error'));
      apiCost.getCostByProject.mockRejectedValue(new Error('API Error'));

      render(<CostTracker activeProject={mockActiveProject} projects={mockProjects} />);

      await waitFor(() => {
        expect(screen.getByText('$0.0000')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty projects array', async () => {
      apiCost.getProjectCost.mockResolvedValue(0);
      apiCost.getCostByProject.mockResolvedValue({});

      render(<CostTracker activeProject={null} projects={[]} />);

      await waitFor(() => {
        expect(screen.getByText('$0.0000')).toBeInTheDocument();
      });
    });

    it('should handle missing chrome runtime API', async () => {
      const originalChrome = global.chrome;
      global.chrome = undefined;

      apiCost.getProjectCost.mockResolvedValue(0.05);
      apiCost.getCostByProject.mockResolvedValue({ 'proj-1': 0.05 });

      render(<CostTracker activeProject={mockActiveProject} projects={mockProjects} />);

      await waitFor(() => {
        expect(screen.getByText('$0.0500')).toBeInTheDocument();
      });

      global.chrome = originalChrome;
    });

    it('should calculate total cost correctly with multiple projects', async () => {
      apiCost.getCostByProject.mockResolvedValue({
        'proj-1': 0.0123,
        'proj-2': 0.0456,
        'proj-3': 0.0789,
      });

      render(<CostTracker activeProject={null} projects={mockProjects} />);

      await waitFor(() => {
        // Total should be 0.0123 + 0.0456 + 0.0789 = 0.1368
        expect(screen.getByText('$0.1368')).toBeInTheDocument();
      });
    });
  });
});