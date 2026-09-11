const Business = require('../models/Business');

// Static v1 plan catalog. Prices in paise.
const PLANS = [
    {
        id: 'free',
        name: 'Free',
        priceMonthly: 0,
        features: [
            'Up to 1 user (owner)',
            'Unlimited sales & expenses',
            'Customer khata',
            'Basic reports (daily)',
        ],
    },
    {
        id: 'pro',
        name: 'Pro',
        priceMonthly: 19900,
        features: [
            'Owner + staff accounts',
            'Everything in Free',
            'Monthly & outstanding reports',
            'Invoice customization',
            'Priority support',
        ],
    },
];

exports.listPlans = async (req, res) => {
    return res.json({ success: true, message: 'OK', data: { plans: PLANS } });
};

exports.requestUpgrade = async (req, res) => {
    const { plan } = req.body;
    if (!['free', 'pro'].includes(plan)) {
        return res.status(400).json({ success: false, message: 'Plan must be free or pro' });
    }
    const business = await Business.findById(req.businessId);
    if (business.plan === plan) {
        return res
            .status(400)
            .json({ success: false, message: `Business is already on the ${plan} plan` });
    }
    // v1: no payment gateway. Log the intent and return a pending request.
    console.log(`[upgrade-request] business=${business.name} (${req.businessId}) wants plan=${plan}`);
    return res.status(202).json({
        success: true,
        message: 'Upgrade request received. Our team will contact you.',
        data: {
            request: {
                businessId: req.businessId,
                plan,
                status: 'pending',
                requestedAt: new Date().toISOString(),
            },
        },
    });
};
