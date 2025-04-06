import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const savePath = path.join(__dirname, '../../public/uploads');
    if (!fs.existsSync(savePath)) {
      fs.mkdirSync(savePath, { recursive: true });
    }
    cb(null, savePath);
  },
  filename: (req, file, cb) => {
    cb(
      null,
      crypto.randomBytes(16).toString('hex') + path.extname(file.originalname),
    );
  },
});

// Single upload middleware that handles both image and attachments
const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAXIMUM_UPLOAD_SIZE ?? '10', 10) * 1024 * 1024, // Limit file size to 5MB
  },
});

export default upload;