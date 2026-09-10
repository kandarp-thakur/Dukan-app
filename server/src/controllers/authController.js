const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Business = require('../models/Business');
const { generateAccessToken, generateRefreshToken } = require('../utils/tokens');

const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
  });
};

exports.register = async (req, res) => {
  const { businessName, name, email, password } = req.body;
  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ success: false, message: 'Email already registered' });
  }
  const business = await Business.create({ name: businessName });
  const user = await User.create({
    name,
    email,
    password,
    role: 'owner',
    businessId: business._id,
  });
  setRefreshCookie(res, generateRefreshToken(user));
  return res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: { accessToken: generateAccessToken(user), user: user.toJSON(), business: business.toJSON() },
  });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: (email || '').toLowerCase().trim() });
  if (!user || !user.comparePassword(password || '')) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }
  const business = await Business.findById(user.businessId);
  setRefreshCookie(res, generateRefreshToken(user));
  return res.json({
    success: true,
    message: 'Login successful',
    data: { accessToken: generateAccessToken(user), user: user.toJSON(), business: business.toJSON() },
  });
};

exports.refresh = async (req, res) => {
  const token = req.cookies ? req.cookies.refreshToken : undefined;
  if (!token) {
    return res.status(401).json({ success: false, message: 'No refresh token' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(payload.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User no longer exists' });
    }
    setRefreshCookie(res, generateRefreshToken(user));
    return res.json({
      success: true,
      message: 'Token refreshed',
      data: { accessToken: generateAccessToken(user) },
    });
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
};

exports.logout = (req, res) => {
  res.clearCookie('refreshToken', { path: '/api/v1/auth' });
  return res.json({ success: true, message: 'Logged out', data: null });
};

exports.me = async (req, res) => {
  const user = await User.findById(req.user.id);
  const business = await Business.findById(req.user.businessId);
  if (!user || !business) {
    return res.status(404).json({ success: false, message: 'Account not found' });
  }
  return res.json({
    success: true,
    message: 'OK',
    data: { user: user.toJSON(), business: business.toJSON() },
  });
};
