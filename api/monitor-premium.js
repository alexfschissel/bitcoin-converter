const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

module.exports = async (req, res) => {
  const secret = req.headers['x-secret-key'];
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Buscar preço Bitcoin
    const priceResponse = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
    );
    const priceData = await priceResponse.json();
    const currentPrice = priceData.bitcoin.usd;

    // Buscar usuários ativos
    const { data: subscribers } = await supabase
      .from('premium_subscribers')
      .select('*')
      .eq('is_active', true)
      .eq('status', 'active')
      .eq('alerts_sent', false);

    let alertsSent = 0;

    // Verificar alertas
    for (const sub of subscribers || []) {
      if (currentPrice >= parseFloat(sub.alert_above)) {
        await twilioClient.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: `whatsapp:${sub.whatsapp_number}`,
          body: `🚨 ALERTA BITCOIN!\n\n📈 Bitcoin subiu para $${currentPrice.toFixed(2)}\nSeu alerta: $${sub.alert_above}`
        });

        await supabase
          .from('premium_subscribers')
          .update({ alerts_sent: true, alert_sent_at: new Date().toISOString(), alert_price: currentPrice })
          .eq('id', sub.id);

        alertsSent++;
      }

      if (currentPrice <= parseFloat(sub.alert_below)) {
        await twilioClient.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: `whatsapp:${sub.whatsapp_number}`,
          body: `🚨 ALERTA BITCOIN!\n\n📉 Bitcoin caiu para $${currentPrice.toFixed(2)}\nSeu alerta: $${sub.alert_below}`
        });

        await supabase
          .from('premium_subscribers')
          .update({ alerts_sent: true, alert_sent_at: new Date().toISOString(), alert_price: currentPrice })
          .eq('id', sub.id);

        alertsSent++;
      }
    }

    return res.status(200).json({
      success: true,
      currentPrice,
      alertsSent
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
