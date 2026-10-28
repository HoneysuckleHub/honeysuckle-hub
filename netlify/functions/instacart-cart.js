// Optional File path: netlify/functions/instacart-cart.js
exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const apiKey = (process.env.INSTACART_API_KEY || '').trim();
    if (!apiKey) {
        return {
            statusCode: 501,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'INSTACART_API_KEY not configured yet.' })
        };
    }

    try {
        const { items } = JSON.parse(event.body || '{}');
        const lineItems = (items || []).map(it => ({
            name: it.name,
            display_text: `${it.qtyUnit || ''} ${it.name}`.trim()
        }));

        const response = await fetch('https://connect.instacart.com/idp/v1/products/products_link', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                title: 'Honeysuckle Hub Weekly Whole-Food Shopping List',
                line_items: lineItems
            })
        });

        const data = await response.json();
        if (response.ok && data?.products_link_url) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cartUrl: data.products_link_url })
            };
        }
        return { statusCode: 500, body: JSON.stringify({ error: 'Could not create cart link' }) };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};