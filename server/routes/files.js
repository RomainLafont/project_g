const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { File, Order, User } = require('../models');
const { authenticateToken, canAccessOrder } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  // Allow specific file types for dental prosthesis
  const allowedTypes = [
    'application/pdf',
    'application/octet-stream', // STL files
    'image/jpeg',
    'image/png',
    'image/tiff',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, STL, images, and documents are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Upload file to order
router.post('/upload/:orderId', authenticateToken, canAccessOrder, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { orderId } = req.params;
    const { category, description } = req.body;

    // Determine file type based on extension
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    let fileType = 'other';
    
    if (fileExtension === '.stl') {
      fileType = 'stl';
    } else if (fileExtension === '.pdf') {
      fileType = 'pdf';
    } else if (['.jpg', '.jpeg', '.png', '.tiff', '.tif'].includes(fileExtension)) {
      fileType = 'image';
    } else if (['.doc', '.docx', '.xls', '.xlsx'].includes(fileExtension)) {
      fileType = 'document';
    }

    // TODO: Upload to cloud storage (Cloudinary, AWS S3, etc.)
    // For now, we'll just store the local path
    const fileUrl = `/uploads/${req.file.filename}`;

    const fileData = {
      orderId,
      uploadedBy: req.user.id,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileUrl,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      fileType,
      category: category || 'other',
      description
    };

    const file = await File.create(fileData);

    // Create system message for file upload
    const { ChatMessage } = require('../models');
    await ChatMessage.create({
      orderId,
      userId: req.user.id,
      message: `File uploaded: ${req.file.originalname}`,
      originalLanguage: req.user.preferredLanguage || 'fr',
      messageType: 'file',
      fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType,
      isSystemMessage: true,
      systemAction: 'file_uploaded'
    });

    res.status(201).json({
      message: 'File uploaded successfully',
      file: file.toJSON()
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ message: 'File upload failed' });
  }
});

// Get files for order
router.get('/order/:orderId', authenticateToken, canAccessOrder, async (req, res) => {
  try {
    const { category, fileType } = req.query;
    
    const whereClause = { orderId: req.params.orderId };
    if (category) whereClause.category = category;
    if (fileType) whereClause.fileType = fileType;

    const files = await File.findAll({
      where: whereClause,
      include: [
        { model: User, as: 'uploader', attributes: ['id', 'firstName', 'lastName', 'role'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({ files: files.map(file => file.toJSON()) });
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ message: 'Failed to get files' });
  }
});

// Download file
router.get('/:fileId/download', authenticateToken, async (req, res) => {
  try {
    const file = await File.findByPk(req.params.fileId, {
      include: [
        { 
          model: Order, 
          as: 'order',
          include: [
            { model: User, as: 'dentist' },
            { model: User, as: 'supplier' }
          ]
        }
      ]
    });

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Check access permissions
    const order = file.order;
    if (req.user.role === 'dentist' && order.dentistId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied to this file' });
    }
    if (req.user.role === 'supplier' && order.supplierId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied to this file' });
    }

    // Check if file is accessible
    if (!file.isAccessible()) {
      return res.status(403).json({ message: 'File access expired' });
    }

    // Increment download count
    await file.incrementDownload();

    // TODO: In production, serve from cloud storage
    // For now, serve from local filesystem
    res.download(file.filePath, file.originalName);
  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({ message: 'File download failed' });
  }
});

// Get file info
router.get('/:fileId', authenticateToken, async (req, res) => {
  try {
    const file = await File.findByPk(req.params.fileId, {
      include: [
        { 
          model: Order, 
          as: 'order',
          include: [
            { model: User, as: 'dentist' },
            { model: User, as: 'supplier' }
          ]
        },
        { model: User, as: 'uploader', attributes: ['id', 'firstName', 'lastName', 'role'] }
      ]
    });

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Check access permissions
    const order = file.order;
    if (req.user.role === 'dentist' && order.dentistId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied to this file' });
    }
    if (req.user.role === 'supplier' && order.supplierId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied to this file' });
    }

    res.json({ 
      file: {
        ...file.toJSON(),
        humanReadableSize: file.getHumanReadableSize()
      }
    });
  } catch (error) {
    console.error('Get file info error:', error);
    res.status(500).json({ message: 'Failed to get file info' });
  }
});

// Delete file
router.delete('/:fileId', authenticateToken, async (req, res) => {
  try {
    const file = await File.findByPk(req.params.fileId, {
      include: [
        { 
          model: Order, 
          as: 'order',
          include: [
            { model: User, as: 'dentist' },
            { model: User, as: 'supplier' }
          ]
        }
      ]
    });

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Check access permissions
    const order = file.order;
    if (req.user.role === 'dentist' && order.dentistId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied to this file' });
    }
    if (req.user.role === 'supplier' && order.supplierId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied to this file' });
    }

    // TODO: Delete from cloud storage
    // For now, just delete from database
    await file.destroy();

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ message: 'Failed to delete file' });
  }
});

// Generate file access token (for private files)
router.post('/:fileId/access-token', authenticateToken, async (req, res) => {
  try {
    const file = await File.findByPk(req.params.fileId, {
      include: [
        { 
          model: Order, 
          as: 'order',
          include: [
            { model: User, as: 'dentist' },
            { model: User, as: 'supplier' }
          ]
        }
      ]
    });

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Check access permissions
    const order = file.order;
    if (req.user.role === 'dentist' && order.dentistId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied to this file' });
    }
    if (req.user.role === 'supplier' && order.supplierId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied to this file' });
    }

    // Generate new access token
    const crypto = require('crypto');
    const accessToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await file.update({ accessToken, expiresAt });

    res.json({
      message: 'Access token generated',
      accessToken,
      expiresAt
    });
  } catch (error) {
    console.error('Generate access token error:', error);
    res.status(500).json({ message: 'Failed to generate access token' });
  }
});

// Download file with access token
router.get('/download/:accessToken', async (req, res) => {
  try {
    const file = await File.findOne({
      where: { accessToken: req.params.accessToken }
    });

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    if (!file.isAccessible()) {
      return res.status(403).json({ message: 'File access expired' });
    }

    // Increment download count
    await file.incrementDownload();

    res.download(file.filePath, file.originalName);
  } catch (error) {
    console.error('Download file with token error:', error);
    res.status(500).json({ message: 'File download failed' });
  }
});

module.exports = router;