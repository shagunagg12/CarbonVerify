import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../db';
import { getFileHash } from '../utils/hash';
import { processOCR } from '../services/ocrService';

const router = Router();

// Configure Multer for local file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/i;
    const ext = allowedTypes.test(path.extname(file.originalname));
    const mime = allowedTypes.test(file.mimetype);
    if (ext && mime) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPG, PNG, WEBP) are allowed.'));
    }
  }
});

// Helper function to run OCR asynchronously without blocking response
async function runAsyncOCR(documentId: string, filePath: string) {
  try {
    const result = await processOCR(filePath);

    // Save Extracted Fields
    await prisma.extractedField.create({
      data: {
        documentId,
        weight: result.weight.value,
        weightConf: result.weight.confidence,
        weightBox: result.weight.box ? JSON.stringify(result.weight.box) : null,
        weightSource: 'OCR',

        vehicleNum: result.vehicleNum.value,
        vehicleNumConf: result.vehicleNum.confidence,
        vehicleNumBox: result.vehicleNum.box ? JSON.stringify(result.vehicleNum.box) : null,
        vehicleNumSource: 'OCR',

        date: result.date.value,
        dateConf: result.date.confidence,
        dateBox: result.date.box ? JSON.stringify(result.date.box) : null,
        dateSource: 'OCR',

        driverName: result.driverName.value,
        driverNameConf: result.driverName.confidence,
        driverNameBox: result.driverName.box ? JSON.stringify(result.driverName.box) : null,
        driverNameSource: 'OCR',
      }
    });

    // Update status to PENDING
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'PENDING' }
    });

    // Write system audit logs for extraction
    const fields = [
      { name: 'weight', value: result.weight.value?.toString() },
      { name: 'vehicleNum', value: result.vehicleNum.value },
      { name: 'date', value: result.date.value },
      { name: 'driverName', value: result.driverName.value }
    ];

    for (const f of fields) {
      if (f.value) {
        await prisma.auditLog.create({
          data: {
            documentId,
            action: 'OCR_EXTRACT',
            field: f.name,
            newValue: f.value,
          }
        });
      }
    }
  } catch (err: any) {
    console.error('OCR Background Error:', err);
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'PENDING',
        ocrLog: err.message || 'OCR processing failed'
      }
    });

    await prisma.auditLog.create({
      data: {
        documentId,
        action: 'OCR_FAILED',
        oldValue: null,
        newValue: err.message || 'OCR failed'
      }
    });
  }
}

// 1. Upload Document API (with Duplicate Detection)
router.post('/upload', upload.single('image'), async (req, res): Promise<any> => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const operatorId = req.body.userId; // Mock operator ID from frontend
    const filePath = req.file.path;
    const filename = req.file.originalname;

    // Calculate MD5 hash for duplicate detection
    const fileHash = await getFileHash(filePath);

    // Check if document already exists
    const duplicate = await prisma.document.findUnique({
      where: { fileHash },
      include: { extractedData: true }
    });

    if (duplicate) {
      // Remove uploaded duplicate file to save space
      fs.unlinkSync(filePath);
      return res.status(409).json({
        error: 'Duplicate document detected (same file contents).',
        document: duplicate
      });
    }

    // Create Document in db with PROCESSING state
    const document = await prisma.document.create({
      data: {
        filename,
        fileHash,
        filePath: `/uploads/${path.basename(filePath)}`,
        status: 'PROCESSING'
      }
    });

    // Log upload in Audit Log
    await prisma.auditLog.create({
      data: {
        documentId: document.id,
        userId: operatorId || null,
        action: 'UPLOAD',
        newValue: filename
      }
    });

    // Run OCR asynchronously
    runAsyncOCR(document.id, filePath);

    res.status(202).json({
      message: 'File uploaded successfully. OCR processing started.',
      document
    });

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Metrics / Dashboard API
router.get('/metrics', async (req, res) => {
  try {
    const counts = await prisma.document.groupBy({
      by: ['status'],
      _count: { id: true }
    });

    const metrics = {
      PROCESSING: 0,
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
      TOTAL: 0
    };

    counts.forEach((c) => {
      if (c.status in metrics) {
        metrics[c.status as keyof typeof metrics] = c._count.id;
      }
    });

    metrics.TOTAL = await prisma.document.count();

    res.json(metrics);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Search / List Documents API
router.get('/', async (req, res) => {
  try {
    const { vehicleNum, status, minWeight, maxWeight, startDate, endDate } = req.query;

    const filters: any = {};

    if (status) {
      filters.status = status;
    }

    if (vehicleNum) {
      filters.extractedData = {
        vehicleNum: {
          contains: vehicleNum as string,
          mode: 'insensitive'
        }
      };
    }

    if (minWeight || maxWeight) {
      filters.extractedData = {
        ...filters.extractedData,
        weight: {
          gte: minWeight ? parseFloat(minWeight as string) : undefined,
          lte: maxWeight ? parseFloat(maxWeight as string) : undefined
        }
      };
    }

    if (startDate || endDate) {
      filters.uploadedAt = {
        gte: startDate ? new Date(startDate as string) : undefined,
        lte: endDate ? new Date(endDate as string) : undefined
      };
    }

    const documents = await prisma.document.findMany({
      where: filters,
      include: {
        extractedData: true
      },
      orderBy: {
        uploadedAt: 'desc'
      }
    });

    res.json(documents);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Get Single Document with Extracted Fields and Audit Logs
router.get('/:id', async (req, res): Promise<any> => {
  try {
    const { id } = req.params;
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        extractedData: true,
        auditLogs: {
          include: {
            user: true
          },
          orderBy: {
            timestamp: 'desc'
          }
        }
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Parse boxes from strings back to JSON structures for SQLite compatibility
    if (document.extractedData) {
      const ext = document.extractedData as any;
      if (ext.weightBox) ext.weightBox = JSON.parse(ext.weightBox);
      if (ext.vehicleNumBox) ext.vehicleNumBox = JSON.parse(ext.vehicleNumBox);
      if (ext.dateBox) ext.dateBox = JSON.parse(ext.dateBox);
      if (ext.driverNameBox) ext.driverNameBox = JSON.parse(ext.driverNameBox);
    }

    res.json(document);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Review Workflow API (Approve, Reject, or Edit values)
router.post('/:id/review', async (req, res): Promise<any> => {
  try {
    const { id } = req.params;
    const { status, weight, vehicleNum, date, driverName, userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required for review action' });
    }

    const document = await prisma.document.findUnique({
      where: { id },
      include: { extractedData: true }
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const logs: any[] = [];
    const fieldsToUpdate: any = {};

    // Helper to log changes and track if source is manual
    const checkAndLogChange = (fieldName: string, currentVal: any, newVal: any) => {
      // Handle weights (numbers) specifically
      if (fieldName === 'weight') {
        const currentNum = currentVal !== null ? parseFloat(currentVal) : null;
        const newNum = newVal !== '' && newVal !== null && newVal !== undefined ? parseFloat(newVal) : null;
        
        if (currentNum !== newNum) {
          logs.push({
            documentId: id,
            userId,
            action: 'EDIT_FIELD',
            field: fieldName,
            oldValue: currentNum?.toString() || null,
            newValue: newNum?.toString() || null
          });
          fieldsToUpdate.weight = newNum;
          fieldsToUpdate.weightSource = 'MANUAL';
        }
        return;
      }

      // Handle text/date fields
      const currentStr = currentVal !== null ? String(currentVal) : null;
      const newStr = newVal !== undefined ? (newVal === '' ? null : String(newVal)) : null;

      if (currentStr !== newStr) {
        logs.push({
          documentId: id,
          userId,
          action: 'EDIT_FIELD',
          field: fieldName,
          oldValue: currentStr,
          newValue: newStr
        });
        fieldsToUpdate[fieldName] = newStr;
        fieldsToUpdate[`${fieldName}Source`] = 'MANUAL';
      }
    };

    if (document.extractedData) {
      checkAndLogChange('weight', document.extractedData.weight, weight);
      checkAndLogChange('vehicleNum', document.extractedData.vehicleNum, vehicleNum);
      checkAndLogChange('date', document.extractedData.date, date);
      checkAndLogChange('driverName', document.extractedData.driverName, driverName);
    } else {
      // If no extraction data existed (e.g. OCR failed completely), initialize them
      fieldsToUpdate.weight = weight ? parseFloat(weight) : null;
      fieldsToUpdate.weightSource = 'MANUAL';
      fieldsToUpdate.vehicleNum = vehicleNum || null;
      fieldsToUpdate.vehicleNumSource = 'MANUAL';
      fieldsToUpdate.date = date || null;
      fieldsToUpdate.dateSource = 'MANUAL';
      fieldsToUpdate.driverName = driverName || null;
      fieldsToUpdate.driverNameSource = 'MANUAL';

      logs.push({
        documentId: id,
        userId,
        action: 'EDIT_FIELD',
        field: 'ALL',
        oldValue: null,
        newValue: 'Initialized manually after OCR omission'
      });
    }

    // Process Status change
    let statusChanged = false;
    if (document.status !== status) {
      logs.push({
        documentId: id,
        userId,
        action: status,
        field: 'status',
        oldValue: document.status,
        newValue: status
      });
      statusChanged = true;
    }

    // Update DB inside transaction
    await prisma.$transaction(async (tx) => {
      // 1. Update extracted fields
      if (Object.keys(fieldsToUpdate).length > 0) {
        await tx.extractedField.upsert({
          where: { documentId: id },
          create: { documentId: id, ...fieldsToUpdate },
          update: fieldsToUpdate
        });
      }

      // 2. Update status
      if (statusChanged) {
        await tx.document.update({
          where: { id },
          data: { status }
        });
      }

      // 3. Write logs
      if (logs.length > 0) {
        await tx.auditLog.createMany({
          data: logs
        });
      }
    });

    res.json({ message: 'Document review completed successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
