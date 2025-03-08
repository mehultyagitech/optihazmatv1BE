import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'node:crypto';
import fs from 'fs';

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage with more secure filenames
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log(
      `Storing file in ${uploadDir}: ${file.originalname} (${file.fieldname})`,
    );
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Use crypto for more secure random names
    const uniqueSuffix = crypto.randomBytes(8).toString('hex');
    const originalName = file.originalname.replace(/\s/g, '_').split('.')[0];
    const originalExt = path.extname(file.originalname);
    cb(null, `${originalName}_${uniqueSuffix}${originalExt}`);
  },
});

// Configure multer to use .any() to accept all fields
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Log each file processed
    console.log(
      `Processing file: ${file.originalname}, fieldname: ${file.fieldname}`,
    );
    cb(null, true);
  },
}).any();

// Wrap the upload middleware to handle errors
const handleFileUpload = (req: Request, res: Response, next: NextFunction) => {
  upload(req, res, function (err) {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({
        success: false,
        message: 'File upload error',
        error: err.message,
      });
    }
    console.log('File upload successful, proceeding to next middleware');
    next();
  });
};

export default handleFileUpload;