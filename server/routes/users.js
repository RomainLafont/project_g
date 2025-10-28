const express = require('express');
const { User } = require('../models');
const { authenticateToken, requireAdmin, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all users (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { role, isActive, page = 1, limit = 10 } = req.query;
    
    const whereClause = {};
    if (role) whereClause.role = role;
    if (isActive !== undefined) whereClause.isActive = isActive === 'true';

    const users = await User.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      users: users.rows.map(user => user.toJSON()),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: users.count,
        pages: Math.ceil(users.count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Failed to get users' });
  }
});

// Get user by ID (admin only)
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: user.toJSON() });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Failed to get user' });
  }
});

// Get dentists (for admin to assign to suppliers)
router.get('/dentists/available', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const dentists = await User.findAll({
      where: { 
        role: 'dentist',
        isActive: true 
      },
      attributes: ['id', 'firstName', 'lastName', 'email', 'practiceName', 'city', 'country'],
      order: [['lastName', 'ASC']]
    });

    res.json({ dentists: dentists.map(dentist => dentist.toJSON()) });
  } catch (error) {
    console.error('Get dentists error:', error);
    res.status(500).json({ message: 'Failed to get dentists' });
  }
});

// Get suppliers (for admin to assign to dentists)
router.get('/suppliers/available', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const suppliers = await User.findAll({
      where: { 
        role: 'supplier',
        isActive: true 
      },
      attributes: ['id', 'firstName', 'lastName', 'email', 'companyName', 'city', 'country'],
      order: [['companyName', 'ASC']]
    });

    res.json({ suppliers: suppliers.map(supplier => supplier.toJSON()) });
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ message: 'Failed to get suppliers' });
  }
});

// Update user status (admin only)
router.put('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { isActive, isVerified } = req.body;
    const user = await User.findByPk(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updateData = {};
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isVerified !== undefined) updateData.isVerified = isVerified;

    await user.update(updateData);

    res.json({
      message: 'User status updated successfully',
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ message: 'Failed to update user status' });
  }
});

// Delete user (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Soft delete - deactivate user instead of hard delete
    await user.update({ isActive: false });

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

// Get user statistics (admin only)
router.get('/stats/overview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const totalUsers = await User.count();
    const activeUsers = await User.count({ where: { isActive: true } });
    const dentists = await User.count({ where: { role: 'dentist', isActive: true } });
    const suppliers = await User.count({ where: { role: 'supplier', isActive: true } });
    const verifiedUsers = await User.count({ where: { isVerified: true } });

    res.json({
      totalUsers,
      activeUsers,
      dentists,
      suppliers,
      verifiedUsers,
      inactiveUsers: totalUsers - activeUsers
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ message: 'Failed to get user statistics' });
  }
});

module.exports = router;