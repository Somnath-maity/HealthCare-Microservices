const express = require('express');
const mongoose = require('mongoose');
const Notification = require('../models/notification.model');
const { authenticate, authorize, validateInternalRequest } = require('../middleware/auth.middleware');

const router = express.Router();

// ============================================================
// POST /notifications - Create a notification (internal service calls)
// ============================================================
router.post('/', validateInternalRequest, async (req, res) => {
  try {
    const { userId, type, title, message, channel, priority, metadata, expiresAt } = req.body;

    if (!userId || !type || !title || !message) {
      return res.status(400).json({ error: 'userId, type, title, and message are required.' });
    }

    const notification = new Notification({
      userId,
      type,
      title,
      message,
      channel,
      priority,
      metadata,
      expiresAt
    });

    await notification.save();

    return res.status(201).json(notification);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ error: 'Validation failed.', details: messages });
    }
    console.error('Create notification error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ============================================================
// Routes below require user authentication
// ============================================================

// GET /notifications/unread-count - Get unread notification count
// (must be before /:id to avoid route conflict)
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.user.userId,
      isRead: false
    });

    return res.json({ count });
  } catch (error) {
    console.error('Unread count error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /notifications/read-all - Mark all notifications as read
// (must be before /:id to avoid route conflict)
router.patch('/read-all', authenticate, async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user.userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    return res.json({ modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error('Read all error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /notifications/stats - Notification stats for the user
// (must be before /:id to avoid route conflict)
router.get('/stats', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;

    const [total, unread, byType, byPriority] = await Promise.all([
      Notification.countDocuments({ userId }),
      Notification.countDocuments({ userId, isRead: false }),
      Notification.aggregate([
        { $match: { userId } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Notification.aggregate([
        { $match: { userId } },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);

    return res.json({
      total,
      unread,
      read: total - unread,
      byType: byType.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byPriority: byPriority.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Stats error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /notifications/bulk - Delete multiple notifications
// (must be before /:id to avoid route conflict)
router.delete('/bulk', authenticate, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required and must not be empty.' });
    }

    // Validate all IDs
    const invalidIds = ids.filter((id) => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({ error: 'Invalid notification IDs.', invalidIds });
    }

    // Build query: user can only delete their own, admin can delete any
    const query = { _id: { $in: ids } };
    if (req.user.role !== 'admin') {
      query.userId = req.user.userId;
    }

    const result = await Notification.deleteMany(query);

    return res.json({
      deletedCount: result.deletedCount,
      requestedCount: ids.length
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /notifications - List notifications for the authenticated user
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { userId: req.user.userId };

    // Filter by isRead
    if (req.query.isRead !== undefined) {
      filter.isRead = req.query.isRead === 'true';
    }

    // Filter by type
    if (req.query.type) {
      filter.type = req.query.type;
    }

    // Filter by priority
    if (req.query.priority) {
      filter.priority = req.query.priority;
    }

    const [notifications, total] = await Promise.all([
      Notification.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Notification.countDocuments(filter)
    ]);

    return res.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('List notifications error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /notifications/:id - Get single notification
router.get('/:id', authenticate, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid notification ID.' });
    }

    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    // Must belong to the user or user must be admin
    if (notification.userId !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    return res.json(notification);
  } catch (error) {
    console.error('Get notification error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /notifications/:id/read - Mark a notification as read
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid notification ID.' });
    }

    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    // Must belong to the user
    if (notification.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    return res.json(notification);
  } catch (error) {
    console.error('Mark read error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /notifications/:id - Delete a single notification
router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid notification ID.' });
    }

    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    // Must belong to the user or user must be admin
    if (notification.userId !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    await Notification.findByIdAndDelete(req.params.id);

    return res.json({ message: 'Notification deleted successfully.' });
  } catch (error) {
    console.error('Delete notification error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
