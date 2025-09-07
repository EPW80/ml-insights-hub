import React, { useState, useRef, ChangeEvent, DragEvent } from 'react';
import './DataUploadInterface.css';

interface UploadState {
    uploading: boolean;
    progress: number;
    success: boolean;
    error: string | null;
    result: any;
}

const DataUploadInterface: React.FC = () => {
    const [uploadState, setUploadState] = useState<UploadState>({
        uploading: false,
        progress: 0,
        success: false,
        error: null,
        result: null,
    });

    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetUploadState = () => {
        setUploadState({
            uploading: false,
            progress: 0,
            success: false,
            error: null,
            result: null,
        });
    };

    const handleFileSelect = (file: File) => {
        if (!file) return;

        // Validate file type
        const allowedTypes = ['.csv', '.json', '.xlsx'];
        const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

        if (!allowedTypes.includes(fileExtension)) {
            setUploadState(prev => ({
                ...prev,
                error: `Invalid file type. Please upload ${allowedTypes.join(', ')} files only.`,
            }));
            return;
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            setUploadState(prev => ({
                ...prev,
                error: 'File size too large. Maximum size is 10MB.',
            }));
            return;
        }

        uploadFile(file);
    };

    const uploadFile = async (file: File) => {
        resetUploadState();
        setUploadState(prev => ({ ...prev, uploading: true }));

        try {
            // Simulate progress for demo (replace with real progress tracking)
            const progressInterval = setInterval(() => {
                setUploadState(prev => ({
                    ...prev,
                    progress: Math.min(prev.progress + Math.random() * 20, 90),
                }));
            }, 500);

            // For demo purposes, we'll simulate a successful upload
            // In real implementation, uncomment the line below:
            // const result = await apiService.uploadData(file);

            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 2000));

            clearInterval(progressInterval);

            // Demo result
            const demoResult = {
                success: true,
                message: 'File uploaded successfully',
                recordsProcessed: Math.floor(Math.random() * 1000) + 100,
                fileSize: (file.size / 1024).toFixed(2) + ' KB',
                processingTime: (Math.random() * 5 + 1).toFixed(2) + 's',
                validation: {
                    validRecords: Math.floor(Math.random() * 900) + 800,
                    invalidRecords: Math.floor(Math.random() * 50),
                    duplicates: Math.floor(Math.random() * 20),
                }
            };

            setUploadState({
                uploading: false,
                progress: 100,
                success: true,
                error: null,
                result: demoResult,
            });

        } catch (error) {
            setUploadState({
                uploading: false,
                progress: 0,
                success: false,
                error: error instanceof Error ? error.message : 'Upload failed',
                result: null,
            });
        }
    };

    const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    const handleDragEnter = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
    };

    const handleDragLeave = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
    };

    const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleFileSelect(files[0]);
        }
    };

    const openFileDialog = () => {
        fileInputRef.current?.click();
    };

    const generateSampleData = () => {
        const sampleData = {
            filename: 'sample_properties.csv',
            format: 'CSV',
            description: 'Sample real estate data with required columns',
            columns: [
                'bedrooms', 'bathrooms', 'sqft', 'year_built',
                'lot_size', 'school_rating', 'crime_rate',
                'walkability_score', 'actual_price', 'location_zipcode'
            ],
            sampleRows: [
                '3,2,1500,2000,6000,7.5,3.2,75,450000,90210',
                '4,3,2200,1995,7500,8.1,2.8,82,650000,90211',
                '2,1,900,2010,4000,6.8,4.1,68,320000,90212'
            ]
        };

        const csvContent = [
            sampleData.columns.join(','),
            ...sampleData.sampleRows
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = sampleData.filename;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="upload-container">
            <div className="upload-header">
                <h2>📤 Data Upload Interface</h2>
                <p>Upload your property data in CSV, JSON, or Excel format</p>
            </div>

            <div className="upload-section">
                <div
                    className={`upload-zone ${dragActive ? 'drag-active' : ''} ${uploadState.uploading ? 'uploading' : ''}`}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={openFileDialog}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.json,.xlsx,.xls"
                        onChange={handleFileInputChange}
                        style={{ display: 'none' }}
                    />

                    {!uploadState.uploading && !uploadState.success && (
                        <div className="upload-content">
                            <div className="upload-icon">📁</div>
                            <h3>Drag & drop your file here</h3>
                            <p>or click to browse files</p>
                            <div className="supported-formats">
                                <span>Supported formats: CSV, JSON, Excel</span>
                            </div>
                        </div>
                    )}

                    {uploadState.uploading && (
                        <div className="upload-progress">
                            <div className="progress-icon">⏳</div>
                            <h3>Uploading...</h3>
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${uploadState.progress}%` }}
                                ></div>
                            </div>
                            <p>{uploadState.progress.toFixed(0)}% complete</p>
                        </div>
                    )}

                    {uploadState.success && uploadState.result && (
                        <div className="upload-success">
                            <div className="success-icon">✅</div>
                            <h3>Upload Successful!</h3>
                            <div className="result-details">
                                <div className="result-item">
                                    <span className="label">Records Processed:</span>
                                    <span className="value">{uploadState.result.recordsProcessed}</span>
                                </div>
                                <div className="result-item">
                                    <span className="label">File Size:</span>
                                    <span className="value">{uploadState.result.fileSize}</span>
                                </div>
                                <div className="result-item">
                                    <span className="label">Processing Time:</span>
                                    <span className="value">{uploadState.result.processingTime}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {uploadState.error && (
                    <div className="error-message">
                        <span>❌ {uploadState.error}</span>
                        <button onClick={resetUploadState} className="close-error">×</button>
                    </div>
                )}

                {uploadState.success && uploadState.result?.validation && (
                    <div className="validation-results">
                        <h4>📊 Data Validation Results</h4>
                        <div className="validation-grid">
                            <div className="validation-item valid">
                                <div className="validation-number">{uploadState.result.validation.validRecords}</div>
                                <div className="validation-label">Valid Records</div>
                            </div>
                            <div className="validation-item invalid">
                                <div className="validation-number">{uploadState.result.validation.invalidRecords}</div>
                                <div className="validation-label">Invalid Records</div>
                            </div>
                            <div className="validation-item duplicate">
                                <div className="validation-number">{uploadState.result.validation.duplicates}</div>
                                <div className="validation-label">Duplicates Found</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="help-section">
                <h3>📋 Data Format Requirements</h3>
                <div className="requirements-grid">
                    <div className="requirement-card">
                        <h4>Required Columns</h4>
                        <ul>
                            <li>bedrooms (integer)</li>
                            <li>bathrooms (decimal)</li>
                            <li>sqft (integer)</li>
                            <li>actual_price (decimal)</li>
                        </ul>
                    </div>
                    <div className="requirement-card">
                        <h4>Optional Columns</h4>
                        <ul>
                            <li>year_built (integer)</li>
                            <li>lot_size (integer)</li>
                            <li>school_rating (decimal)</li>
                            <li>crime_rate (decimal)</li>
                            <li>walkability_score (integer)</li>
                        </ul>
                    </div>
                    <div className="requirement-card">
                        <h4>File Specifications</h4>
                        <ul>
                            <li>Maximum size: 10MB</li>
                            <li>Encoding: UTF-8</li>
                            <li>CSV delimiter: comma</li>
                            <li>Headers required</li>
                        </ul>
                    </div>
                </div>

                <div className="sample-section">
                    <button onClick={generateSampleData} className="sample-button">
                        📥 Download Sample Data Format
                    </button>
                </div>
            </div>

            {uploadState.success && (
                <div className="action-section">
                    <button onClick={resetUploadState} className="upload-another-button">
                        📤 Upload Another File
                    </button>
                </div>
            )}
        </div>
    );
};

export default DataUploadInterface;
