"use strict";

const express = require("express");
const path = require("node:path");
const { pipeline } = require("node:stream/promises");
const { ObjectId } = require("mongodb");
const { getCurriculumBucket } = require("../config/db");
const { requireLogin } = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();

const curriculumContentTypes = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

// ========================================
// GRIDFS: UPLOAD CURRICULUM FILE
// ========================================
router.post(
  "/upload",
  requireLogin,
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "Please select a file to upload."
        });
      }

      const curriculumBucket = getCurriculumBucket();
      const userId = req.session.userId;

      const safeFilename = path
        .basename(req.file.originalname)
        .replace(/[\r\n"]/g, "_");

      const stream = curriculumBucket.openUploadStream(
        safeFilename,
        {
          contentType: req.file.mimetype,
          metadata: {
            userId,
            originalName: safeFilename,
            uploadedAt: new Date()
          }
        }
      );

      stream.on("error", next);

      stream.on("finish", () => {
        if (res.headersSent) return;

        return res.status(201).json({
          message: "Curriculum file uploaded successfully.",
          file: {
            id: stream.id.toString(),
            filename: safeFilename,
            contentType: req.file.mimetype,
            size: req.file.size
          }
        });
      });

      stream.end(req.file.buffer);
    } catch (error) {
      next(error);
    }
  }
);

// ========================================
// GRIDFS: LIST THE CURRENT USER'S FILES
// ========================================
router.get("/", requireLogin, async (req, res, next) => {
  try {
    const curriculumBucket = getCurriculumBucket();
    const files = await curriculumBucket
      .find({
        "metadata.userId": req.session.userId
      })
      .sort({ uploadDate: -1 })
      .toArray();

    return res.json({
      files: files.map(file => ({
        id: file._id.toString(),
        filename:
          file.metadata?.originalName || file.filename,
        contentType: file.contentType,
        size: file.length,
        uploadedAt:
          file.metadata?.uploadedAt || file.uploadDate
      }))
    });
  } catch (error) {
    next(error);
  }
});

// ========================================
// GRIDFS: VIEW OR DOWNLOAD A FILE
// ========================================
router.get("/:id", requireLogin, async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        message: "Invalid file ID."
      });
    }

    const fileId = new ObjectId(req.params.id);
    const curriculumBucket = getCurriculumBucket();

    const files = await curriculumBucket
      .find({
        _id: fileId,
        "metadata.userId": req.session.userId
      })
      .toArray();

    if (!files.length) {
      return res.status(404).json({
        message:
          "File not found or you do not have permission to access it."
      });
    }

    const file = files[0];

    const filename = path
      .basename(file.metadata?.originalName || file.filename)
      .replace(/[\r\n"]/g, "_");

    res.setHeader(
      "Content-Type",
      curriculumContentTypes[path.extname(filename).toLowerCase()] ||
        file.contentType ||
        "application/octet-stream"
    );

    const disposition =
      req.query.download === "1"
        ? "attachment"
        : "inline";

    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename="${filename}"`
    );

    const downloadStream =
      curriculumBucket.openDownloadStream(fileId);

    await pipeline(downloadStream, res);
  } catch (error) {
    if (res.headersSent) return;
    next(error);
  }
});

// ========================================
// GRIDFS: DELETE A FILE
// ========================================
router.delete("/:id", requireLogin, async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        message: "Invalid file ID."
      });
    }

    const fileId = new ObjectId(req.params.id);
    const curriculumBucket = getCurriculumBucket();

    const files = await curriculumBucket
      .find({
        _id: fileId,
        "metadata.userId": req.session.userId
      })
      .toArray();

    if (!files.length) {
      return res.status(404).json({
        message:
          "File not found or you do not have permission to delete it."
      });
    }

    await curriculumBucket.delete(fileId);

    return res.json({
      message: "Curriculum file deleted successfully."
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

