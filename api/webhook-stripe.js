const stripe = require(‘stripe’)(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
if (req.method !== ‘POST’) {
return res.status(405).json({ error: ‘Method not allowed’ });
}

const sig = req.headers[‘stripe-signature’];

try {
const event = stripe.webhooks.constructEvent(
req.body,
sig,
process.env.STRIPE_WEBHOOK_SECRET
);

```
console.log(`✅ Webhook received: ${event.type}`);

// Payment succeeded
if (event.type === 'payment_intent.succeeded') {
  const paymentIntent = event.data.object;
  const { email, whatsapp, alertAbove, alertBelow } = paymentIntent.metadata;

  console.log(`✅ Payment succeeded for ${email}`);
  console.log(`Alert Above: ${alertAbove}, Alert Below: ${alertBelow}`);
}

// Payment failed
if (event.type === 'payment_intent.payment_failed') {
  const paymentIntent = event.data.object;
  const { email } = paymentIntent.metadata;

  console.log(`❌ Payment failed for ${email}`);
}

return res.status(200).json({ received: true });
```

} catch (error) {
console.error(‘Webhook error:’, error.message);
return res.status(400).send(`Webhook Error: ${error.message}`);
}
};
