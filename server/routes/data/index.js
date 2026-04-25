const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Dataset = require('../../models/Dataset');
const Property = require('../../models/Property');
const Prediction = require('../../models/Prediction');
const { requireAuthOrApiKey } = require('../../middleware/mlAuth');
const { uploadLimiter } = require('../../middleware/security');
const s3Storage = require('../../utils/s3Storage');
const logger = require('../../config/logger');

// Consistent file size limit (10MB — aligns with requestSizeLimiter middleware)
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024;

// Allowed file extensions for dataset uploads
const ALLOWED_EXTENSIONS = ['.csv', '.json', '.xlsx', '.xls'];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Accepted: ${ALLOWED_EXTENSIONS.join(', ')}`), false);
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

router.post(
  '/upload',
  requireAuthOrApiKey,
  uploadLimiter,
  upload.single('dataset'),
  async (req, res) => {
    try {
      const { name, description } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      if (!s3Storage.isConfigured()) {
        logger.error('Dataset upload rejected — S3 not configured');
        return res.status(503).json({
          error:
            'File storage is not configured. Set AWS_S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY.',
        });
      }

      const key = s3Storage.buildKey(file.originalname, req.user.id);
      await s3Storage.uploadBuffer({
        buffer: file.buffer,
        key,
        contentType: file.mimetype,
      });

      const dataset = new Dataset({
        name,
        description,
        file_path: key,
        file_size: file.size,
        format: path.extname(file.originalname).slice(1),
        uploaded_by: req.user.id,
      });

      await dataset.save();
      return res.json({ success: true, dataset });
    } catch (error) {
      logger.error('Dataset upload failed', { message: error.message });
      return res.status(500).json({ error: error.message });
    }
  }
);

router.get('/summary', requireAuthOrApiKey, async (req, res) => {
  try {
    const [datasetCount, predictionCount, propertyCount] = await Promise.all([
      Dataset.countDocuments(),
      Prediction.countDocuments(),
      Property.countDocuments(),
    ]);
    res.json({
      success: true,
      summary: {
        total_datasets: datasetCount,
        total_predictions: predictionCount,
        total_properties: propertyCount,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/properties', requireAuthOrApiKey, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const properties = await Property.find().sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ success: true, properties });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
