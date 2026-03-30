// api/monitor-premium.js

import { supabase } from './supabase-client.js';
import { sendWhatsAppAlert } from './whatsapp-service.js';

const API_URL = 'https://api.coingecko.com/api/v3';

export default async function handler(req, res) {
    const secret = req.headers['x-secret-key'];
    if (secret !== process.env.CRON_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('🕐 Monitor Premium iniciado...');

    try {
        const priceResponse = await fetch(
            `${API_URL}/simple/price?ids=bitcoin&vs_currencies=usd`
        );
        const priceData = await priceResponse.json();
        const currentPrice = priceData.bitcoin.usd;

        console.log(`💰 Preço atual: $${currentPrice.toFixed(2)}`);

        const { data: subscribers, error: fetchError } = await supabase
            .from('premium_subscribers')
            .select('*')
            .eq('is_active', true)
            .eq('status', 'active')
            .eq('alerts_sent', false);

        if (fetchError) {
            console.error('Erro ao buscar:', fetchError);
            return res.status(500).json({ error: 'Erro ao buscar dados' });
        }

        console.log(`👥 ${subscribers?.length || 0} usuários premium ativos`);

        let alertsSent = 0;

        if (subscribers && subscribers.length > 0) {
            for (const subscriber of subscribers) {
                const { whatsapp_number, alert_above, alert_below, id } = subscriber;

                console.log(`\n📊 Usuário: ${whatsapp_number}`);
                console.log(`   Alert ACIMA: $${parseFloat(alert_above).toFixed(2)}`);
                console.log(`   Alert ABAIXO: $${parseFloat(alert_below).toFixed(2)}`);
                console.log(`   Preço atual: $${currentPrice.toFixed(2)}`);

                let shouldSendAlert = false;
                let alertType = '';

                if (currentPrice >= parseFloat(alert_above)) {
                    shouldSendAlert = true;
                    alertType = 'ACIMA';
                    console.log(`   ✅ ALERTA ACIMA DISPARADO!`);
                }

                if (currentPrice <= parseFloat(alert_below)) {
                    shouldSendAlert = true;
                    alertType = 'ABAIXO';
                    console.log(`   ✅ ALERTA ABAIXO DISPARADO!`);
                }

                if (shouldSendAlert) {
                    const message = `
🚨 ALERTA BITCOIN DISPARADO!

Preço Atual: $${currentPrice.toFixed(2)}

${alertType === 'ACIMA' ? '📈 Bitcoin subiu para o valor que você definiu!' : '📉 Bitcoin caiu para o valor que você definiu!'}

Acesse: bitcoin-converter-ten.vercel.app
                    `.trim();

                    const alertResult = await sendWhatsAppAlert(whatsapp_number, message);

                    if (alertResult.success) {
                        await supabase
                            .from('premium_subscribers')
                            .update({
                                alerts_sent: true,
                                alert_sent_at: new Date(),
                                alert_price: currentPrice
                            })
                            .eq('id', id);

                        alertsSent++;
                        console.log(`   ✅ Alerta enviado com sucesso`);
                    } else {
                        console.log(`   ❌ Erro ao enviar: ${alertResult.error}`);
                    }
                }
            }
        }

        await supabase
            .from('monitor_logs')
            .insert([
                {
                    current_price: currentPrice,
                    subscribers_checked: subscribers?.length || 0,
                    alerts_sent: alertsSent,
                    type: 'premium',
                    executed_at: new Date()
                }
            ]);

        console.log(`\n✅ Monitor Premium concluído. Alertas enviados: ${alertsSent}`);

        return res.status(200).json({
            success: true,
            currentPrice,
            subscribersChecked: subscribers?.length || 0,
            alertsSent
        });

    } catch (error) {
        console.error('❌ Erro fatal:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
