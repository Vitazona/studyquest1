"use strict";

const multer = require("multer");
const path = require("node:path");

const maxFileSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB || "15", 10);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxFileSizeMB * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, callback) => {
    const allowedTypes = {
      ".pdf": ["application/pdf"],
      ".jpg": ["image/jpeg"],
      ".jpeg": ["image/jpeg"],
      ".png": ["image/png"],
      ".webp": ["image/webp"]
    };

    const extension = path.extname(file.originalname).toLowerCase();
    const allowedMimeTypes = allowedTypes[extension];

    if (
      !allowedMimeTypes ||
      !allowedMimeTypes.includes(file.mimetype)
    ) {
      const error = new Error(
        "Only PDF, JPG, JPEG, PNG, and WEBP files are allowed."
      );
      error.code = "INVALID_FILE_TYPE";
      return callback(error);
    }

    callback(null, true);
  }
});

module.exports = upload;

