const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Dataset = require('../../models/Dataset');
const Property = require('../../models/Property');
const Prediction = require('../../models/Prediction');
const { requireAuthOrApiKey } = require('../../middleware/mlAuth');

// Consistent file size limit (10MB — aligns with requestSizeLimiter middleware)
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024;

// Allowed file extensions for dataset uploads
const ALLOWED_EXTENSIONS = ['.csv', '.json', '.xlsx', '.xls'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Accepted: ${ALLOWED_EXTENSIONS.join(', ')}`), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE }
});

router.post('/upload', requireAuthOrApiKey, upload.single('dataset'), async (req, res) => {
  try {
    const { name, description } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const dataset = new Dataset({
      name,
      description,
      file_path: file.path,
      file_size: file.size,
      format: path.extname(file.originalname).slice(1),
      uploaded_by: req.user.id
    });

    await dataset.save();
    res.json({ success: true, dataset });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
