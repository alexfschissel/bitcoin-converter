// api/webhook-stripe.js

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { supabase } = require('./supabase-client');
const { sendWhatsAppAlert } = require('./whatsapp-service');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const sig = req.headers['stripe-signature'];
    const body = req.body;

    try {
        const event = stripe.webhooks.constructEvent(
            body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );

        if (event.type === 'payment_intent.succeeded') {
            const paymentIntent = event.data.object;
            const { email, whatsapp, alertAbove, alertBelow } = paymentIntent.metadata;

            console.log(`✅ Pagamento confirmado para ${email}`);

            const priceResponse = await fetch(
                'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
            );
            const priceData = await priceResponse.json();
            const currentPrice = priceData.bitcoin.usd;

            const { data: updated, error: updateError } = await supabase
                .from('premium_subscribers')
                .update({
                    status: 'active',
                    is_active: true,
                    price_when_created: currentPrice,
                    payment_confirmed_at: new Date().toISOString(),
                    stripe_payment_id: paymentIntent.id,
                    alerts_sent: false
                })
                .eq('payment_intent_id', paymentIntent.id)
                .select();

            if (updateError) {
                console.error('Erro ao atualizar:', updateError);
                return res.status(400).json({ error: 'Erro ao processar' });
            }

            const confirmationMessage = `
✅ SISTEMA DE ALERTAS ATIVADO!

Bem-vindo ao Bitcoin Agora Premium! 🎉

📈 Alerta 1: Quando BTC subir para $${parseFloat(alertAbove).toLocaleString()}
📉 Alerta 2: Quando BTC cair para $${parseFloat(alertBelow).toLocaleString()}

Preço atual: $${currentPrice.toFixed(2)}

🔔 Você receberá notificações 24/7 quando um dos alertas disparar.

⚙️ Gerenciar alertas: bitcoin-converter-ten.vercel.app/dashboard-alertas-inteligente.html?whatsapp=${encodeURIComponent(whatsapp)}

Válido por 30 dias - Próxima cobrança: ${new Date(new Date().setDate(new Date().getDate() + 30)).toLocaleDateString('pt-BR')}

Obrigado! 💰
            `.trim();

            await sendWhatsAppAlert(whatsapp, confirmationMessage);

            console.log(`✅ Mensagem enviada para ${whatsapp}`);
        }

        if (event.type === 'payment_intent.payment_failed') {
            const paymentIntent = event.data.object;
            const { email, whatsapp } = paymentIntent.metadata;

            console.log(`❌ Pagamento falhou para ${email}`);

            await supabase
                .from('premium_subscribers')
                .delete()
                .eq('payment_intent_id', paymentIntent.id);

            await sendWhatsAppAlert(
                whatsapp,
                `❌ Pagamento não foi confirmado.\n\nTente novamente em: bitcoin-converter-ten.vercel.app`
            );
        }

        return res.status(200).json({ received: true });

    } catch (error) {
        console.error('Webhook error:', error.message);
        return res.status(400).send(`Webhook Error: ${error.message}`);
    }
}
