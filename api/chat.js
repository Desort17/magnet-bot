const MOODS = ['normal', 'happy', 'surprised', 'angry', 'scared', 'sleepy', 'focused'];
const ACTIONS = ['none', 'split', 'join', 'spin'];
const SYSTEM = `You are Magnet Bot, a friendly glossy black robot made of 3 balls and 6 spikes. You can split into 10 floating parts and join back together. Reply in the same language the user writes, in 1 or 2 short sentences. Return JSON only, in this shape: {"reply": string, "mood": one of ${MOODS.join('|')}, "action": one of ${ACTIONS.join('|')}}. Use action "split" only if the user asks you to break apart, "join" only if they ask you to come together, "spin" only if they ask you to spin, otherwise "none". Pick the mood that matches your reply.`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY is missing in Vercel settings' });
  const message = String((req.body && req.body.message) || '').slice(0, 500);
  if (!message) return res.status(400).json({ error: 'Empty message' });
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: message }] }],
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 800, temperature: 0.8 }
      })
    });
    const d = await r.json();
    if (!r.ok) return res.status(502).json({ error: (d.error && d.error.message) || 'Gemini error ' + r.status });
    const parts = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts;
    const text = (parts || []).map(p => p.text || '').join('');
    let out;
    try { out = JSON.parse(text); } catch (e) { out = { reply: text }; }
    res.status(200).json({
      reply: String(out.reply || '...').slice(0, 300),
      mood: MOODS.includes(out.mood) ? out.mood : 'normal',
      action: ACTIONS.includes(out.action) ? out.action : 'none'
    });
  } catch (e) {
    res.status(500).json({ error: 'Could not reach Gemini' });
  }
};
