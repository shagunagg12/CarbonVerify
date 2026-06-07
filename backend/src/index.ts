import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import documentRoutes from './routes/documentRoutes';
import userRoutes from './routes/userRoutes';
import prisma from './db';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend accessibility
app.use(cors());

// Parse JSON and URL-encoded request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded document images statically
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/api/documents', documentRoutes);
app.use('/api/users', userRoutes);

// Root Status check
app.get('/status', (req, res) => {
  res.json({ status: 'OK', message: 'Carbon Credit Evidence Capture API is running.' });
});

// Seed mock users on startup
async function seedOnStartup() {
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      await prisma.user.createMany({
        data: [
          { name: 'Sarah Operator', role: 'OPERATOR' },
          { name: 'John Reviewer', role: 'REVIEWER' },
          { name: 'Alice Auditor', role: 'REVIEWER' }
        ]
      });
      console.log('Seeded initial mock users.');
    }
  } catch (err) {
    console.error('Failed to seed mock users:', err);
  }
}

// Start Server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await seedOnStartup();
});
