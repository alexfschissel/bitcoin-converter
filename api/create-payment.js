import Stripe from ‘stripe’;
import { createClient } from ‘@supabase/supabase-js’;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
// CORS
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST, OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);

if (req.method === ‘OPTIONS’) {
return res.status(200).end();
}

if (req.method !== ‘POST’) {
return res.status(405).json({ error: ‘Method not allowed’ });
}

try {
const { amount, email, whatsapp, alertAbove, alertBelow } = req.body;

```
// Validar dados
if (!amount || !email || !whatsapp || !alertAbove || !alertBelow) {
  return res.status(400).json({ error: 'Dados incompletos' });
}

// Criar Payment Intent no Stripe
const paymentIntent = await stripe.paymentIntents.create({
  amount: amount, // em centavos
  currency: 'brl',
  description: `Bitcoin Agora Premium - ${email}`,
  metadata: {
    email,
    whatsapp,
    alertAbove: alertAbove.toString(),
    alertBelow: alertBelow.toString()
  }
});

console.log(`✅ Payment Intent criado: ${paymentIntent.id}`);

// Salvar no Supabase
const { data: subscriber, error: dbError } = await supabase
  .from('premium_subscribers')
  .insert([
    {
      email,
      whatsapp_number: whatsapp,
      alert_above: alertAbove,
      alert_below: alertBelow,
      payment_intent_id: paymentIntent.id,
      status: 'pending_payment',
      is_active: false,
      created_at: new Date().toISOString()
    }
  ])
  .select();

if (dbError) {
  console.error('❌ Erro Supabase:', dbError);
  return res.status(400).json({ error: 'Erro ao salvar no banco' });
}

console.log(`✅ Subscriber salvo: ${subscriber[0].id}`);

// Retornar client secret para o frontend
return res.status(200).json({
  success: true,
  clientSecret: paymentIntent.client_secret,
  paymentIntentId: paymentIntent.id,
  subscriberId: subscriber[0].id
});
```

} catch (error) {
console.error(‘❌ Erro:’, error.message);
return res.status(500).json({
success: false,
error: error.message
});
}
}
