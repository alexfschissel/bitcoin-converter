// api/create-payment.js

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { supabase } = require('./supabase-client');

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { amount, email, whatsapp, alertAbove, alertBelow } = req.body;

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'brl',
            metadata: {
                email,
                whatsapp,
                alertAbove,
                alertBelow
            }
        });

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
                    price_when_created: null,
                    is_active: false,
                    created_at: new Date()
                }
            ])
            .select();

        if (dbError) {
            console.error('Erro ao salvar:', dbError);
            return res.status(400).json({ error: 'Erro ao processar' });
        }

        return res.status(200).json({
            clientSecret: paymentIntent.client_secret,
            subscriberId: subscriber[0]?.id
        });

    } catch (error) {
        console.error('Erro Stripe:', error);
        return res.status(500).json({ error: error.message });
    }
}
