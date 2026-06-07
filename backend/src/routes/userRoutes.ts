import { Router } from 'express';
import prisma from '../db';

const router = Router();

// Get all users
router.get('/', async (req, res) => {
  try {
    let users = await prisma.user.findMany();
    
    // Seed users if none exist
    if (users.length === 0) {
      await prisma.user.createMany({
        data: [
          { name: 'Sarah Operator', role: 'OPERATOR' },
          { name: 'John Reviewer', role: 'REVIEWER' },
          { name: 'Alice Auditor', role: 'REVIEWER' }
        ]
      });
      users = await prisma.user.findMany();
    }
    
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
