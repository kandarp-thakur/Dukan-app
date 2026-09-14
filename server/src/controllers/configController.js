const { isEmailConfigured } = require('../services/emailService');

exports.getFeatures = async (req, res) => {
    return res.json({
        success: true,
        message: 'OK',
        data: { email: isEmailConfigured() },
    });
};
