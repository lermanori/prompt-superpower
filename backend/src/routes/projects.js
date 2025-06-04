const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { authenticateToken } = require('../middleware/auth');
const { 
  createProject, 
  getProjects, 
  uploadImages, 
  generatePrompts, 
  getPrompts,
  updatePrompt,
  deletePrompt,
  deleteProject,
  getProjectById,
  updateProject,
  getProjectImages,
  generateImages,
  getResults,
  updateResult,
  exportProjectResults
} = require('../controllers/projects');

// Configure multer for file uploads
const tempUploadDir = path.join(__dirname, '..', '..', 'uploads', 'temp');
fs.ensureDirSync(tempUploadDir); // Ensure temp directory exists

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempUploadDir); // Use temp directory for initial upload
  },
  filename: (req, file, cb) => {
    // Keep original extension, use unique name
    cb(null, Date.now() + '-' + Math.random().toString(36).substring(7) + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Project routes
router.get('/', authenticateToken, getProjects);
router.post('/', authenticateToken, createProject);
router.get('/:projectId', authenticateToken, getProjectById);
router.put('/:projectId', authenticateToken, updateProject);
router.delete('/:projectId', authenticateToken, deleteProject);

// Image upload route
router.get('/:projectId/images', authenticateToken, getProjectImages);
router.post('/:projectId/images', 
  authenticateToken, 
  upload.array('images', 10), // Use multer middleware
  uploadImages
);

// Prompt generation route
router.post('/:projectId/generate-prompts', authenticateToken, generatePrompts);

// Get prompts for a project route
router.get('/:projectId/prompts', authenticateToken, getPrompts);

// Prompt update route
router.put('/:projectId/prompts/:promptId', authenticateToken, updatePrompt);

// Prompt delete route
router.delete('/:projectId/prompts/:promptId', authenticateToken, deletePrompt);

// Image generation route
router.post('/:projectId/generate-images', authenticateToken, generateImages);

// Result route
router.get('/:projectId/results', authenticateToken, getResults);
router.put('/:projectId/results/:resultId', authenticateToken, updateResult);

// Export route
router.get('/:projectId/export', authenticateToken, exportProjectResults);

module.exports = router; 