export async function sendWhatsAppMessage(
  to: string, 
  message: string,
  phoneNumberId?: string,
  accessToken?: string
): Promise<boolean> {
  const WHATSAPP_PHONE_NUMBER_ID = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const WHATSAPP_ACCESS_TOKEN = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;

  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    console.error('WhatsApp credentials not configured');
    return false;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v26.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: message },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to send WhatsApp message:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return false;
  }
}

export async function sendWhatsAppTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string = 'en',
  components: any[] = [],
  phoneNumberId?: string,
  accessToken?: string
): Promise<boolean> {
  const WHATSAPP_PHONE_NUMBER_ID = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const WHATSAPP_ACCESS_TOKEN = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;

  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    console.error('WhatsApp credentials not configured');
    return false;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v26.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: languageCode },
            components,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to send WhatsApp template message:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending WhatsApp template message:', error);
    return false;
  }
}

export async function markMessageAsRead(
  messageId: string,
  phoneNumberId?: string,
  accessToken?: string
): Promise<boolean> {
  const WHATSAPP_PHONE_NUMBER_ID = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const WHATSAPP_ACCESS_TOKEN = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;

  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    return false;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v26.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error('Error marking message as read:', error);
    return false;
  }
}