import { Router, Response, NextFunction } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../auth/middleware';
import { AdminDatabase } from './database';

const router = Router();

// Middleware: Verify Admin Role
const requireAdmin = (req: any, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied: Administrator credentials required' });
  }
  next();
};

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/v1/admin/stats - Platform metrics
router.get('/stats', async (_req, res: Response) => {
  try {
    const stats = await AdminDatabase.getStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error('Failed to get admin stats:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve stats' });
  }
});

// GET /api/v1/admin/users - User management list with search & filters
router.get('/users', async (req, res: Response) => {
  try {
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const role = req.query.role as string | undefined;
    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '20');

    const result = await AdminDatabase.getUsers({ search, status, role, page, limit });
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Failed to get users list:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve users' });
  }
});

// POST /api/v1/admin/users - Create user directly
router.post('/users', async (req, res: Response) => {
  try {
    const { username, email, password, role, bio } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Username, email, and password are required' });
    }

    const newUser = await AdminDatabase.createUser({
      username,
      email,
      password,
      role: role || 'user',
      bio: bio || '',
    });

    res.status(201).json({ success: true, data: newUser, message: 'User created successfully' });
  } catch (error: any) {
    console.error('Failed to create user:', error);
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'A user with this username or email already exists' });
    }
    res.status(500).json({ success: false, message: error.message || 'Failed to create user' });
  }
});

// PUT /api/v1/admin/users/:id - Edit user profile/role
router.put('/users/:id', async (req, res: Response) => {
  try {
    const { id } = req.params;
    const { username, email, role, bio } = req.body;

    const updated = await AdminDatabase.updateUser(id, { username, email, role, bio });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: updated, message: 'User updated successfully' });
  } catch (error: any) {
    console.error('Failed to update user:', error);
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
});

// PATCH /api/v1/admin/users/:id/restriction - Toggle user restriction
router.patch('/users/:id/restriction', async (req, res: Response) => {
  try {
    const { id } = req.params;
    const { isRestricted } = req.body;

    if (typeof isRestricted !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isRestricted boolean is required' });
    }

    const updated = await AdminDatabase.setUserRestriction(id, isRestricted);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const message = isRestricted ? 'User account has been restricted' : 'User account restriction removed';
    res.json({ success: true, data: updated, message });
  } catch (error: any) {
    console.error('Failed to update user restriction:', error);
    res.status(500).json({ success: false, message: 'Failed to change restriction status' });
  }
});

// DELETE /api/v1/admin/users/:id - Delete user
router.delete('/users/:id', async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    if (req.user?.userId === id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own admin account' });
    }

    const success = await AdminDatabase.deleteUser(id);
    if (!success) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'User deleted permanently' });
  } catch (error: any) {
    console.error('Failed to delete user:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
});

// GET /api/v1/admin/features - Fetch dynamic feature flags
router.get('/features', async (_req, res: Response) => {
  try {
    const features = await AdminDatabase.getFeatures();
    res.json({ success: true, data: features });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to get feature flags' });
  }
});

// PUT /api/v1/admin/features - Update feature flags
router.put('/features', async (req, res: Response) => {
  try {
    const features = await AdminDatabase.updateFeatures(req.body);
    res.json({ success: true, data: features, message: 'Feature settings saved' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update features' });
  }
});

// GET /api/v1/admin/settings - Fetch platform settings
router.get('/settings', async (_req, res: Response) => {
  try {
    const settings = await AdminDatabase.getSettings();
    res.json({ success: true, data: settings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to get platform settings' });
  }
});

// PUT /api/v1/admin/settings - Update platform settings
router.put('/settings', async (req, res: Response) => {
  try {
    const settings = await AdminDatabase.updateSettings(req.body);
    res.json({ success: true, data: settings, message: 'Platform settings saved' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update platform settings' });
  }
});

// GET /api/v1/admin/moderation/reports - Flagged items
router.get('/moderation/reports', async (_req, res: Response) => {
  try {
    const reports = await AdminDatabase.getReports();
    res.json({ success: true, data: reports });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to get reports' });
  }
});

// POST /api/v1/admin/moderation/reports/:id/resolve - Resolve report
router.post('/moderation/reports/:id/resolve', async (req, res: Response) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'dismiss' | 'delete_target'
    await AdminDatabase.resolveReport(id, action || 'dismiss');
    res.json({ success: true, message: 'Report resolved successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to resolve report' });
  }
});

export default router;
