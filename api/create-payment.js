const stripe = require(‘stripe’)(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
// CORS
res.setHeader(‘Access-Control-Allow-Credentials’, ‘true’);
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘GET,OPTIONS,PATCH,DELETE,POST,PUT’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version’);

if (req.method === ‘OPTIONS’) {
res.status(200).end();
return;
}

if (req.method !== ‘POST’) {
return res.status(405).json({ error: ‘Method not allowed’ });
}

try {
const { amount, email, whatsapp, alertAbove, alertBelow } = req.body;

```
if (!amount || !email || !whatsapp || !alertAbove || !alertBelow) {
  return res.status(400).json({ error: 'Missing required fields' });
}

const paymentIntent = await stripe.paymentIntents.create({
  amount: Math.round(amount),
  currency: 'brl',
  description: `Bitcoin Agora Premium - ${email}`,
  metadata: {
    email,
    whatsapp,
    alertAbove: String(alertAbove),
    alertBelow: String(alertBelow)
  }
});

return res.status(200).json({
  clientSecret: paymentIntent.client_secret,
  paymentIntentId: paymentIntent.id
});
```

} catch (error) {
console.error(‘Error:’, error);
return res.status(500).json({
error: error.message
});
}
};
