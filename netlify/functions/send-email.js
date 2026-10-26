// File: netlify/functions/send-email.js
exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
        return { statusCode: 503, body: JSON.stringify({ error: 'RESEND_API_KEY not configured yet' }) };
    }
    try {
        const { to, bcc, replyTo, subject, text, html } = JSON.parse(event.body || '{}');
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: process.env.FROM_EMAIL || 'Ashton at Honeysuckle Hub <onboarding@resend.dev>',
                to: Array.isArray(to) ? to : [to],
                bcc: bcc,
                reply_to: replyTo || 'contacthoneysuckleandco@gmail.com',
                subject,
                text,
                html
            })
        });
        const data = await response.json();
        return { statusCode: response.ok ? 200 : 400, body: JSON.stringify(data) };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};