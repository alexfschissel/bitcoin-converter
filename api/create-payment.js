const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { amount, email, whatsapp, alertAbove, alertBelow } = req.body;

    if (!amount || !email || !whatsapp || !alertAbove || !alertBelow) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount),
      currency: 'brl',
      metadata: { email, whatsapp, alertAbove: String(alertAbove), alertBelow: String(alertBelow) }
    });

    // Salvar no Supabase
    const { data } = await supabase
      .from('premium_subscribers')
      .insert([{
        email,
        whatsapp_number: whatsapp,
        alert_above: alertAbove,
        alert_below: alertBelow,
        payment_intent_id: paymentIntent.id,
        status: 'pending_payment',
        is_active: false,
        created_at: new Date().toISOString()
      }])
      .select();

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
