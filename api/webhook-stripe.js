import Stripe from ‘stripe’;
import { createClient } from ‘@supabase/supabase-js’;
import { sendWhatsAppAlert } from ‘./whatsapp-service.js’;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
if (req.method !== ‘POST’) {
return res.status(405).json({ error: ‘Method not allowed’ });
}

const sig = req.headers[‘stripe-signature’];
const body = req.body;

try {
// Validar assinatura Stripe
const event = stripe.webhooks.constructEvent(
body,
sig,
process.env.STRIPE_WEBHOOK_SECRET
);

```
console.log(`🔔 Webhook recebido: ${event.type}`);

// ===== PAGAMENTO BEM-SUCEDIDO =====
if (event.type === 'payment_intent.succeeded') {
  const paymentIntent = event.data.object;
  const { email, whatsapp, alertAbove, alertBelow } = paymentIntent.metadata;

  console.log(`✅ Pagamento confirmado para ${email}`);

  // Buscar preço atual
  try {
    const priceResponse = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
    );
    const priceData = await priceResponse.json();
    const currentPrice = priceData.bitcoin.usd;

    // Atualizar status no banco
    const { error: updateError } = await supabase
      .from('premium_subscribers')
      .update({
        status: 'active',
        is_active: true,
        price_when_created: currentPrice,
        payment_confirmed_at: new Date().toISOString(),
        stripe_payment_id: paymentIntent.id
      })
      .eq('payment_intent_id', paymentIntent.id);

    if (updateError) {
      console.error('❌ Erro ao atualizar:', updateError);
      return res.status(400).json({ error: 'Erro ao processar' });
    }

    console.log(`✅ Assinatura ativada para ${email}`);

    // Enviar confirmação WhatsApp
    const confirmationMessage = `
```

✅ SISTEMA DE ALERTAS ATIVADO!

Bem-vindo ao Bitcoin Agora Premium! 🎉

📈 Alerta 1: Quando BTC subir para $${parseFloat(alertAbove).toLocaleString()}
📉 Alerta 2: Quando BTC cair para $${parseFloat(alertBelow).toLocaleString()}

Preço atual: $${currentPrice.toFixed(2)}

🔔 Você receberá notificações 24/7 quando um dos alertas disparar.

⚙️ Gerenciar alertas: https://bitcoin-converter-ten.vercel.app/dashboard-alertas-inteligente.html?whatsapp=${encodeURIComponent(whatsapp)}

Válido por 30 dias - Próxima cobrança: ${new Date(new Date().setDate(new Date().getDate() + 30)).toLocaleDateString(‘pt-BR’)}

Obrigado! 💰
`.trim();

```
    try {
      await sendWhatsAppAlert(whatsapp, confirmationMessage);
      console.log(`✅ WhatsApp enviado para ${whatsapp}`);
    } catch (whatsappError) {
      console.error('⚠️ Erro ao enviar WhatsApp:', whatsappError.message);
      // Não falha o webhook se WhatsApp falhar
    }

  } catch (priceError) {
    console.error('⚠️ Erro ao buscar preço:', priceError.message);
  }
}

// ===== PAGAMENTO FALHOU =====
if (event.type === 'payment_intent.payment_failed') {
  const paymentIntent = event.data.object;
  const { email, whatsapp } = paymentIntent.metadata;

  console.log(`❌ Pagamento falhou para ${email}`);

  // Deletar subscriber pendente
  await supabase
    .from('premium_subscribers')
    .delete()
    .eq('payment_intent_id', paymentIntent.id);

  // Enviar notificação
  try {
    await sendWhatsAppAlert(
      whatsapp,
      `❌ Seu pagamento foi recusado.\n\nTente novamente: https://bitcoin-converter-ten.vercel.app\n\nSe o problema persistir, contate: seu-email@seu-site.com`
    );
  } catch (whatsappError) {
    console.error('⚠️ Erro ao enviar WhatsApp:', whatsappError.message);
  }
}

return res.status(200).json({ received: true });
```

} catch (error) {
console.error(‘❌ Webhook error:’, error.message);
return res.status(400).send(`Webhook Error: ${error.message}`);
}
}
