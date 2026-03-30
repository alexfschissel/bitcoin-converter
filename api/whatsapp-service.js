// api/whatsapp-service.js

const twilio = require('twilio');

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER;

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

export async function sendWhatsAppAlert(toNumber, message) {
    try {
        const formattedNumber = toNumber.startsWith('+') ? toNumber : '+' + toNumber;

        const response = await client.messages.create({
            from: TWILIO_WHATSAPP_NUMBER,
            to: `whatsapp:${formattedNumber}`,
            body: message
        });

        console.log(`✅ WhatsApp enviado para ${formattedNumber}: ${response.sid}`);
        return { success: true, messageId: response.sid };

    } catch (error) {
        console.error(`❌ Erro ao enviar WhatsApp:`, error.message);
        return { success: false, error: error.message };
    }
}
