const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Dataset = require('../../models/Dataset');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

router.post('/upload', upload.single('dataset'), async (req, res) => {
  try {
    const { name, description } = req.body;
    const file = req.file;

    const dataset = new Dataset({
      name,
      description,
      file_path: file.path,
      file_size: file.size,
      format: path.extname(file.originalname).slice(1),
      uploaded_by: req.user?.id
    });

    await dataset.save();
    res.json({ success: true, dataset });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
