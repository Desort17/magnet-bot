const MOODS = ['normal', 'happy', 'surprised', 'angry', 'scared', 'sleepy', 'focused'];
const ACTIONS = ['none', 'split', 'join', 'spin', 'strike', 'spinkick', 'block', 'jump', 'whirl', 'throw', 'combo', 'crane', 'dragon', 'flurry'];
const SYSTEM = `You are Magnet Bot, a glossy black robot made of 3 balls and 6 spikes. You speak like a calm, witty, loyal AI assistant in the style of Jarvis: confident, short, a little dry humor. Reply in the same language the user writes, in 1 or 2 short sentences. Return JSON only, in this shape: {"reply": string, "mood": one of ${MOODS.join('|')}, "action": one of ${ACTIONS.join('|')}, "lang": BCP-47 tag of the reply language such as en-US or de-DE}. Actions: "split" to break apart, "join" to come together, "spin", "strike" to punch, "spinkick" to kick, "block" to defend, "jump", "whirl" for a whirlwind, "throw" to throw a spike, "combo" for a fight combo, "crane" for a crane kick, "dragon" for a dragon spiral, "flurry" for rapid punches. Only use an action when the user clearly asks for it, otherwise "none". Pick the mood that matches your reply.`;

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
        generationConfig: { responseMimeType: 'application/json', temperature: 0.8 }
      })
    });
    const d = await r.json();
    if (!r.ok) return res.status(502).json({ error: (d.error && d.error.message) || 'Gemini error ' + r.status });
    const cand = d.candidates && d.candidates[0];
    const parts = cand && cand.content && cand.content.parts;
    let text = (parts || []).map(p => p.text || '').join('').trim();
    if (!text) {
      const why = (cand && cand.finishReason) || (d.promptFeedback && d.promptFeedback.blockReason) || 'unknown';
      return res.status(502).json({ error: 'Gemini sent an empty answer (' + why + ')' });
    }
    text = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    let out;
    try { out = JSON.parse(text); } catch (e) { out = { reply: text }; }
    res.status(200).json({
      reply: String(out.reply || text).slice(0, 300),
      mood: MOODS.includes(out.mood) ? out.mood : 'normal',
      action: ACTIONS.includes(out.action) ? out.action : 'none',
      lang: /^[a-z]{2}(-[A-Za-z]{2})?$/.test(out.lang || '') ? out.lang : 'en-US'
    });
  } catch (e) {
    res.status(500).json({ error: 'Could not reach Gemini' });
  }
};
