import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DataUploadInterface from './DataUploadInterface';
import { apiService } from '../services/api';

// Mock the api service
jest.mock('../services/api', () => ({
  apiService: {
    uploadData: jest.fn(),
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    makePrediction: jest.fn(),
    getPropertyData: jest.fn(),
    getPredictionHistory: jest.fn(),
    getDataSummary: jest.fn(),
  },
  tokenManager: {
    getToken: jest.fn(() => null),
    setToken: jest.fn(),
    clearToken: jest.fn(),
  },
}));

describe('DataUploadInterface', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders upload zone with instructions', () => {
    render(<DataUploadInterface />);
    expect(screen.getByText(/drag & drop your file here/i)).toBeInTheDocument();
    expect(screen.getByText(/click to browse files/i)).toBeInTheDocument();
    expect(screen.getByText(/supported formats: csv, json, excel/i)).toBeInTheDocument();
  });

  it('renders data format requirements section', () => {
    render(<DataUploadInterface />);
    expect(screen.getByText('Required Columns')).toBeInTheDocument();
    expect(screen.getByText('Optional Columns')).toBeInTheDocument();
    expect(screen.getByText('File Specifications')).toBeInTheDocument();
  });

  it('shows error for invalid file type', async () => {
    const { container } = render(<DataUploadInterface />);

    const file = new File(['invalid content'], 'test.txt', { type: 'text/plain' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
    });
  });

  it('shows error for oversized file', async () => {
    const { container } = render(<DataUploadInterface />);

    // Create a mock file larger than 10MB
    const largeContent = new ArrayBuffer(11 * 1024 * 1024);
    const file = new File([largeContent], 'large.csv', { type: 'text/csv' });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/file size too large/i)).toBeInTheDocument();
    });
  });

  it('uploads valid CSV file and shows success', async () => {
    (apiService.uploadData as jest.Mock).mockResolvedValue({
      recordsProcessed: 150,
      fileSize: '2.5 KB',
      processingTime: '0.3s',
      validation: {
        validRecords: 148,
        invalidRecords: 2,
        duplicates: 0,
      },
    });

    const { container } = render(<DataUploadInterface />);

    const csvContent = 'bedrooms,bathrooms,sqft,actual_price\n3,2,1500,450000';
    const file = new File([csvContent], 'properties.csv', { type: 'text/csv' });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/upload successful/i)).toBeInTheDocument();
    });

    expect(apiService.uploadData).toHaveBeenCalledWith(file);
  });

  it('shows upload error when API fails', async () => {
    (apiService.uploadData as jest.Mock).mockRejectedValue(new Error('Server error'));

    const { container } = render(<DataUploadInterface />);

    const file = new File(['data'], 'test.csv', { type: 'text/csv' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument();
    });
  });

  it('allows downloading sample data', () => {
    render(<DataUploadInterface />);

    const downloadButton = screen.getByText(/download sample data format/i);
    expect(downloadButton).toBeInTheDocument();

    // Mock URL.createObjectURL and revokeObjectURL
    const mockUrl = 'blob:test';
    global.URL.createObjectURL = jest.fn(() => mockUrl);
    global.URL.revokeObjectURL = jest.fn();

    fireEvent.click(downloadButton);

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(mockUrl);
  });

  it('handles drag events on upload zone', () => {
    const { container } = render(<DataUploadInterface />);

    const uploadZone = container.querySelector('.upload-zone') as HTMLElement;

    fireEvent.dragEnter(uploadZone, {
      dataTransfer: { files: [] },
    });

    // The zone should get the drag-active class
    expect(uploadZone).toHaveClass('drag-active');

    fireEvent.dragLeave(uploadZone, {
      dataTransfer: { files: [] },
    });
  });
});
