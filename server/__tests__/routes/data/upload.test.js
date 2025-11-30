/**
 * Tests for Dataset Upload Routes
 *
 * Tests cover:
 * - File upload functionality
 * - Input validation
 * - File size limits
 * - File format validation
 * - Database persistence
 * - Error handling
 */

const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const Dataset = require('../../../models/Dataset');
const User = require('../../../models/User');
const dataRoutes = require('../../../routes/data');
const jwt = require('jsonwebtoken');

// Setup Express app for testing
const app = express();
app.use(express.json());
app.use('/api/data', dataRoutes);

// Set up environment
process.env.JWT_SECRET = 'test-secret-key-for-testing';

describe('Dataset Upload Routes', () => {
  let authToken;
  let testUser;
  const testUploadDir = path.join(__dirname, '../../../uploads');

  beforeAll(async () => {
    // Create test user
    testUser = await User.create({
      username: 'datauser',
      email: 'data@example.com',
      password: 'password123',
      role: 'user'
    });

    // Generate auth token
    authToken = jwt.sign(
      { id: testUser._id, role: testUser.role },
      process.env.JWT_SECRET
    );

    // Ensure uploads directory exists
    try {
      await fs.mkdir(testUploadDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  });

  afterAll(async () => {
    // Clean up test uploads
    try {
      const files = await fs.readdir(testUploadDir);
      for (const file of files) {
        if (file.startsWith('test-')) {
          await fs.unlink(path.join(testUploadDir, file));
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  afterEach(async () => {
    // Clean up uploaded files after each test
    const datasets = await Dataset.find({});
    for (const dataset of datasets) {
      if (dataset.file_path) {
        try {
          await fs.unlink(dataset.file_path);
        } catch (error) {
          // File might not exist
        }
      }
    }
  });

  describe('POST /api/data/upload', () => {
    describe('File Upload Success', () => {
      it('should upload a CSV file successfully', async () => {
        const csvContent = 'name,age,city\nJohn,30,NYC\nJane,25,LA';
        const testFile = Buffer.from(csvContent);

        const response = await request(app)
          .post('/api/data/upload')
          .attach('dataset', testFile, 'test-data.csv')
          .field('name', 'Test Dataset')
          .field('description', 'A test CSV dataset')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.dataset).toBeDefined();
        expect(response.body.dataset.name).toBe('Test Dataset');
        expect(response.body.dataset.format).toBe('csv');
        expect(response.body.dataset.file_size).toBeGreaterThan(0);
      });

      it('should upload a JSON file successfully', async () => {
        const jsonContent = JSON.stringify([
          { name: 'John', age: 30 },
          { name: 'Jane', age: 25 }
        ]);
        const testFile = Buffer.from(jsonContent);

        const response = await request(app)
          .post('/api/data/upload')
          .attach('dataset', testFile, 'test-data.json')
          .field('name', 'JSON Dataset')
          .field('description', 'A test JSON dataset')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.dataset.format).toBe('json');
      });

      it('should store dataset metadata in database', async () => {
        const csvContent = 'a,b,c\n1,2,3';
        const testFile = Buffer.from(csvContent);

        const response = await request(app)
          .post('/api/data/upload')
          .attach('dataset', testFile, 'metadata-test.csv')
          .field('name', 'Metadata Test')
          .field('description', 'Testing metadata storage')
          .expect(200);

        const savedDataset = await Dataset.findById(response.body.dataset._id);
        expect(savedDataset).toBeDefined();
        expect(savedDataset.name).toBe('Metadata Test');
        expect(savedDataset.description).toBe('Testing metadata storage');
        expect(savedDataset.file_path).toBeDefined();
        expect(savedDataset.file_size).toBeGreaterThan(0);
      });

      it('should save file to disk', async () => {
        const csvContent = 'x,y,z\n1,2,3\n4,5,6';
        const testFile = Buffer.from(csvContent);

        const response = await request(app)
          .post('/api/data/upload')
          .attach('dataset', testFile, 'disk-test.csv')
          .field('name', 'Disk Test')
          .expect(200);

        const filePath = response.body.dataset.file_path;
        const fileExists = await fs.access(filePath)
          .then(() => true)
          .catch(() => false);

        expect(fileExists).toBe(true);
      });
    });

    describe('Input Validation', () => {
      it('should require dataset name', async () => {
        const csvContent = 'a,b,c\n1,2,3';
        const testFile = Buffer.from(csvContent);

        const response = await request(app)
          .post('/api/data/upload')
          .attach('dataset', testFile, 'no-name.csv')
          .field('description', 'Missing name')
          .expect(500);

        expect(response.body.error).toBeDefined();
      });

      it('should require a file to be uploaded', async () => {
        const response = await request(app)
          .post('/api/data/upload')
          .field('name', 'No File Dataset')
          .field('description', 'No file attached')
          .expect(500);

        expect(response.body.error).toBeDefined();
      });

      it('should accept dataset without description', async () => {
        const csvContent = 'a,b\n1,2';
        const testFile = Buffer.from(csvContent);

        const response = await request(app)
          .post('/api/data/upload')
          .attach('dataset', testFile, 'no-desc.csv')
          .field('name', 'No Description Dataset')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.dataset.description).toBeUndefined();
      });
    });

    describe('File Format Validation', () => {
      it('should accept CSV files', async () => {
        const testFile = Buffer.from('a,b\n1,2');

        const response = await request(app)
          .post('/api/data/upload')
          .attach('dataset', testFile, 'test.csv')
          .field('name', 'CSV Test')
          .expect(200);

        expect(response.body.dataset.format).toBe('csv');
      });

      it('should accept JSON files', async () => {
        const testFile = Buffer.from('[]');

        const response = await request(app)
          .post('/api/data/upload')
          .attach('dataset', testFile, 'test.json')
          .field('name', 'JSON Test')
          .expect(200);

        expect(response.body.dataset.format).toBe('json');
      });

      it('should detect file format from extension', async () => {
        const testFile = Buffer.from('data');

        const formats = [
          { ext: 'csv', file: 'test.csv' },
          { ext: 'json', file: 'test.json' },
          { ext: 'parquet', file: 'test.parquet' }
        ];

        for (const format of formats) {
          const response = await request(app)
            .post('/api/data/upload')
            .attach('dataset', testFile, format.file)
            .field('name', `${format.ext} Test`)
            .expect(200);

          expect(response.body.dataset.format).toBe(format.ext);
        }
      });
    });

    describe('File Size Limits', () => {
      it('should reject files larger than 100MB', async () => {
        // Create a buffer larger than 100MB (100 * 1024 * 1024 bytes)
        const largeFileSize = 101 * 1024 * 1024;
        const largeFile = Buffer.alloc(largeFileSize);

        const response = await request(app)
          .post('/api/data/upload')
          .attach('dataset', largeFile, 'large-file.csv')
          .field('name', 'Large File');

        // Multer returns 500 on file size errors
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.body.error || response.body.message || response.error).toBeDefined();
      });

      it('should accept files under 100MB', async () => {
        // Create a 1KB file
        const smallFile = Buffer.alloc(1024);

        const response = await request(app)
          .post('/api/data/upload')
          .attach('dataset', smallFile, 'small-file.csv')
          .field('name', 'Small File')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.dataset.file_size).toBeLessThanOrEqual(100 * 1024 * 1024);
      });

      it('should store correct file size', async () => {
        const content = 'a,b,c\n1,2,3';
        const testFile = Buffer.from(content);
        const expectedSize = Buffer.byteLength(content);

        const response = await request(app)
          .post('/api/data/upload')
          .attach('dataset', testFile, 'size-test.csv')
          .field('name', 'Size Test')
          .expect(200);

        expect(response.body.dataset.file_size).toBe(expectedSize);
      });
    });

    describe('Error Handling', () => {
      it('should handle database save errors', async () => {
        // Mock Dataset.save to throw error
        const mockSave = jest.spyOn(Dataset.prototype, 'save');
        mockSave.mockRejectedValue(new Error('Database connection failed'));

        const testFile = Buffer.from('a,b\n1,2');

        const response = await request(app)
          .post('/api/data/upload')
          .attach('dataset', testFile, 'db-error.csv')
          .field('name', 'DB Error Test')
          .expect(500);

        expect(response.body.error).toContain('Database connection failed');

        mockSave.mockRestore();
      });

      it('should handle missing file gracefully', async () => {
        const response = await request(app)
          .post('/api/data/upload')
          .field('name', 'No File')
          .expect(500);

        expect(response.body.error).toBeDefined();
      });

      it('should handle invalid multipart data', async () => {
        const response = await request(app)
          .post('/api/data/upload')
          .send({ invalid: 'data' })
          .expect(500);

        expect(response.body.error).toBeDefined();
      });
    });

    describe('Response Format', () => {
      it('should return success flag in response', async () => {
        const testFile = Buffer.from('a,b\n1,2');

        const response = await request(app)
          .post('/api/data/upload')
          .attach('dataset', testFile, 'format-test.csv')
          .field('name', 'Format Test')
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should return complete dataset object', async () => {
        const testFile = Buffer.from('a,b\n1,2');

        const response = await request(app)
          .post('/api/data/upload')
          .attach('dataset', testFile, 'complete-test.csv')
          .field('name', 'Complete Test')
          .field('description', 'Complete dataset test')
          .expect(200);

        expect(response.body.dataset).toMatchObject({
          name: 'Complete Test',
          description: 'Complete dataset test',
          format: 'csv'
        });
        expect(response.body.dataset._id).toBeDefined();
        expect(response.body.dataset.file_path).toBeDefined();
        expect(response.body.dataset.file_size).toBeDefined();
      });

      it('should include timestamps', async () => {
        const testFile = Buffer.from('a,b\n1,2');

        const response = await request(app)
          .post('/api/data/upload')
          .attach('dataset', testFile, 'timestamp-test.csv')
          .field('name', 'Timestamp Test')
          .expect(200);

        expect(response.body.dataset.createdAt).toBeDefined();
        expect(response.body.dataset.updatedAt).toBeDefined();
      });
    });

    describe('Concurrent Uploads', () => {
      it('should handle multiple simultaneous uploads', async () => {
        const uploads = [];

        for (let i = 0; i < 5; i++) {
          const testFile = Buffer.from(`data${i},value${i}\n1,2`);

          uploads.push(
            request(app)
              .post('/api/data/upload')
              .attach('dataset', testFile, `concurrent-${i}.csv`)
              .field('name', `Concurrent Upload ${i}`)
          );
        }

        const responses = await Promise.all(uploads);

        responses.forEach((response, index) => {
          expect(response.status).toBe(200);
          expect(response.body.success).toBe(true);
          expect(response.body.dataset.name).toBe(`Concurrent Upload ${index}`);
        });

        // Verify all were saved
        const savedDatasets = await Dataset.find({
          name: /^Concurrent Upload \d$/
        });
        expect(savedDatasets.length).toBe(5);
      });
    });
  });
});
