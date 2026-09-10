const jwt = require('jsonwebtoken');

exports.generateAccessToken = (user) =>
  jwt.sign(
    {
      id: user._id.toString(),
      businessId: user.businessId.toString(),
      role: user.role,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );

exports.generateRefreshToken = (user) =>
  jwt.sign({ id: user._id.toString() }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
