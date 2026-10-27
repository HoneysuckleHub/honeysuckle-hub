// File path: netlify/functions/gemini-scan.js
exports.handler = async function(event) {
    const rawKey = process.env.GEMINI_API_KEY || '';
    const apiKey = rawKey.trim().replace(/^["']|["']$/g, '');

    if (!apiKey) {
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Missing GEMINI_API_KEY in Netlify Environment Variables.' })
        };
    }

    // Helper that discovers active models on your API key if standard names change
    async function getModelsToTry() {
        const defaults = [
            'gemini-2.5-flash',
            'gemini-flash-latest',
            'gemini-2.5-flash-lite',
            'gemini-2.0-flash',
            'gemini-1.5-flash-latest'
        ];
        try {
            const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
                headers: { 'Referer': 'https://honeysucklehub.com/' }
            });
            const listData = await listRes.json();
            if (listRes.ok && Array.isArray(listData.models)) {
                const available = listData.models
                    .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
                    .map(m => m.name.replace(/^models\//, ''))
                    .filter(name => name.includes('flash') && !name.includes('tts') && !name.includes('image'));
                if (available.length > 0) {
                    return [...new Set([...defaults.filter(d => available.includes(d)), ...available])];
                }
            }
        } catch (e) {}
        return defaults;
    }

    // Live Browser Diagnostic Check: Visit https://honeysucklehub.com/.netlify/functions/gemini-scan
    if (event.httpMethod === 'GET') {
        try {
            const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
                headers: { 'Referer': 'https://honeysucklehub.com/' }
            });
            const listData = await listRes.json();
            if (!listRes.ok) {
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        status: 'API_KEY_ERROR',
                        message: listData?.error?.message || `Google returned HTTP ${listRes.status}`,
                        fix: 'Check your GEMINI_API_KEY in Google AI Studio / Netlify Environment Variables.'
                    }, null, 2)
                };
            }
            const models = await getModelsToTry();
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'OK',
                    message: 'Honeysuckle Hub Gemini Scanner is live and connected!',
                    activeModelsFound: models.slice(0, 6)
                }, null, 2)
            };
        } catch (err) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'ERROR', error: err.message })
            };
        }
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { prompt, imageBase64, mimeType } = JSON.parse(event.body || '{}');
        if (!prompt) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Missing prompt text.' })
            };
        }

        const cleanBase64 = imageBase64
            ? String(imageBase64).replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').trim()
            : '';

        const parts = [{ text: prompt }];
        if (cleanBase64 && cleanBase64 !== 'NONE') {
            parts.push({
                inline_data: {
                    mime_type: mimeType || 'image/jpeg',
                    data: cleanBase64
                }
            });
        }

        const modelsToTry = await getModelsToTry();
        let lastError = 'Scanner request failed';

        for (const modelName of modelsToTry) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Referer': 'https://honeysucklehub.com/'
                },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: {
                        temperature: 0.2
                    }
                })
            });

            const data = await response.json();
            const textOut = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
            if (response.ok && textOut) {
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ resultText: textOut, modelUsed: modelName })
                };
            }
            lastError = data?.error?.message || `HTTP ${response.status} on ${modelName}`;
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
