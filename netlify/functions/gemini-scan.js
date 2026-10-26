// File path: netlify/functions/gemini-scan.js
exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Missing GEMINI_API_KEY in Netlify Environment Variables.' })
        };
    }

    try {
        const { prompt, imageBase64, mimeType } = JSON.parse(event.body || '{}');
        if (!imageBase64) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'No image data received.' })
            };
        }

        // Strip any data URL prefix if present
        const cleanBase64 = String(imageBase64).replace(/^data:image\/\w+;base64,/, '');

        // Use current active models
        const modelsToTry = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash'];
        let lastError = 'Scanner request failed';

        for (const modelName of modelsToTry) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            { inline_data: { mime_type: mimeType || 'image/jpeg', data: cleanBase64 } }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.2,
                        responseMimeType: 'application/json'
                    }
                })
            });

            const data = await response.json();
            if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ resultText: data.candidates[0].content.parts[0].text })
                };
            }
            lastError = data?.error?.message || `Status ${response.status}`;
        }

        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: lastError })
        };
    } catch (err) {
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: err.message })
        };
    }
};