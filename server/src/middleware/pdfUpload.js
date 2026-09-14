const multer = require('multer');

const MAX_PDF_BYTES = 5 * 1024 * 1024;

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PDF_BYTES },
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
            const err = new Error('A PDF attachment is required');
            err.status = 400;
            return cb(err);
        }
        return cb(null, true);
    },
}).single('pdf');

// Wraps multer so its errors come back in the standard { success, message } envelope.
const pdfUpload = (req, res, next) =>
    upload(req, res, (err) => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ success: false, message: 'Attachment exceeds 5 MB' });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ success: false, message: 'A PDF attachment is required' });
        }
        return res
            .status(err.status || 400)
            .json({ success: false, message: err.message || 'Upload failed' });
    });

module.exports = { pdfUpload, MAX_PDF_BYTES };
