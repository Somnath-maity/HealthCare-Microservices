const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const {
  authenticate,
  authorize,
  validateInternalRequest,
} = require("../middleware/auth.middleware");
const axios = require("axios");

const router = express.Router();

const generateTokens = (userId, role) => {
  const accessToken = jwt.sign({ userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRY || "1h",
  });
  const refreshToken = jwt.sign(
    { userId, role },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || "7d" }
  );
  return { accessToken, refreshToken };
};

router.post("/register", async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, specialization, licenseNumber, phone } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: "email, password, firstName, and lastName are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "Email already registered" });
    }

    if (role === "doctor" && !licenseNumber) {
      return res.status(400).json({ error: "License number is required for doctors" });
    }

    const user = new User({ email, password, firstName, lastName, role, specialization, licenseNumber, phone });
    await user.save();

    const tokens = generateTokens(user._id, user.role);
    user.refreshTokens.push(tokens.refreshToken);
    await user.save();

    if (process.env.NOTIFICATION_SERVICE_URL) {
      axios
        .post(`${process.env.NOTIFICATION_SERVICE_URL}/notifications`, {
          userId: user._id.toString(),
          type: "WELCOME",
          title: "Welcome to Healthcare Platform",
          message: `Welcome ${firstName}! Your account has been created successfully.`,
          channel: "in-app",
        }, { headers: { "x-service-key": "internal-service-communication" } })
        .catch(() => {});
    }

    res.status(201).json({
      message: "User registered successfully",
      user,
      ...tokens,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Email already registered" });
    }
    res.status(500).json({ error: "Registration failed", details: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: "Account is deactivated. Contact admin." });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const tokens = generateTokens(user._id, user.role);
    user.refreshTokens.push(tokens.refreshToken);
    await user.save();

    res.json({ message: "Login successful", user, ...tokens });
  } catch (err) {
    res.status(500).json({ error: "Login failed", details: err.message });
  }
});

router.post("/refresh-token", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token is required" });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || !user.refreshTokens.includes(refreshToken)) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    user.refreshTokens = user.refreshTokens.filter((t) => t !== refreshToken);
    const tokens = generateTokens(user._id, user.role);
    user.refreshTokens.push(tokens.refreshToken);
    await user.save();

    res.json({ message: "Tokens refreshed", ...tokens });
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

router.get("/profile", authenticate, async (req, res) => {
  res.json({ user: req.user });
});

router.put("/profile", authenticate, async (req, res) => {
  try {
    const allowedFields = ["firstName", "lastName", "phone", "specialization"];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    res.json({ message: "Profile updated", user });
  } catch (err) {
    res.status(500).json({ error: "Update failed", details: err.message });
  }
});

router.post("/change-password", authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const isMatch = await req.user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    req.user.password = newPassword;
    req.user.refreshTokens = [];
    await req.user.save();

    const tokens = generateTokens(req.user._id, req.user.role);
    req.user.refreshTokens = [tokens.refreshToken];
    await req.user.save();

    res.json({ message: "Password changed successfully", ...tokens });
  } catch (err) {
    res.status(500).json({ error: "Password change failed", details: err.message });
  }
});

router.post("/logout", authenticate, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      req.user.refreshTokens = req.user.refreshTokens.filter((t) => t !== refreshToken);
    } else {
      req.user.refreshTokens = [];
    }
    await req.user.save();
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ error: "Logout failed" });
  }
});

router.get("/users", authenticate, authorize("admin"), async (req, res) => {
  try {
    const { role, isActive, search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(filter).skip(skip).limit(parseInt(limit)).sort({ createdAt: -1 }),
      User.countDocuments(filter),
    ]);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users", details: err.message });
  }
});

router.get("/users/:id", authenticate, authorize("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user", details: err.message });
  }
});

router.patch("/users/:id/status", authenticate, authorize("admin"), async (req, res) => {
  try {
    const { isActive } = req.body;
    if (isActive === undefined) {
      return res.status(400).json({ error: "isActive field is required" });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!isActive) {
      user.refreshTokens = [];
      await user.save();
    }

    res.json({ message: `User ${isActive ? "activated" : "deactivated"}`, user });
  } catch (err) {
    res.status(500).json({ error: "Status update failed", details: err.message });
  }
});

router.get("/verify", validateInternalRequest, async (req, res) => {
  res.json({ valid: true, user: req.user });
});

router.get("/doctors", validateInternalRequest, async (req, res) => {
  try {
    const doctors = await User.find({ role: "doctor", isActive: true });
    res.json({ doctors });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch doctors" });
  }
});

module.exports = router;
