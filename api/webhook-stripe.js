const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sig = req.headers['stripe-signature'];

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const { email, whatsapp, alertAbove, alertBelow } = paymentIntent.metadata;

      // Atualizar Supabase
      await supabase
        .from('premium_subscribers')
        .update({
          status: 'active',
          is_active: true,
          stripe_payment_id: paymentIntent.id,
          payment_confirmed_at: new Date().toISOString()
        })
        .eq('payment_intent_id', paymentIntent.id);

      // Enviar WhatsApp
      try {
        await twilioClient.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: `whatsapp:${whatsapp}`,
          body: `✅ Sistema Premium Ativado!\n\n📈 Alerta: $${alertAbove}\n📉 Alerta: $${alertBelow}\n\nAcesse: https://bitcoin-converter-ten.vercel.app/dashboard-alertas-inteligente.html?whatsapp=${encodeURIComponent(whatsapp)}`
        });
      } catch (e) {
        console.error('WhatsApp error:', e);
      }
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(400).send(`Error: ${error.message}`);
  }
};
