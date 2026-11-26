import multer from 'multer';

function fileFilter(req, file, callback) {
  const allowedTypes = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]);

  if (!allowedTypes.has(file.mimetype)) {
    callback(new Error('Only PDF, PNG, JPG, and WEBP documents are allowed.'));
    return;
  }

  callback(null, true);
}

export const researcherVerificationUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 8 * 1024 * 1024
  }
}).fields([
  { name: 'nationalIdDocument', maxCount: 1 },
  { name: 'certificationDocument', maxCount: 1 }
]);
