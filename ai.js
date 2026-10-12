// Fungsi server untuk Vercel: menyimpan kunci Gemini di server, bukan di halaman web.
//
// Cara memakai:
// 1. Taruh file ini di folder "api" pada proyek Vercel Anda (api/ai.js), sejajar dengan Walig_Pro.html.
// 2. Di dashboard Vercel: Settings > Environment Variables, tambahkan GEMINI_API_KEY berisi kunci BARU
//    dari https://aistudio.google.com/app/apikey (kunci lama harus dicabut, lihat catatan di bawah).
// 3. Deploy ulang. Halaman otomatis memakai /api/ai; tidak ada pengaturan lain.
//
// Catatan: batasi pemakaian kunci di Google AI Studio dan aktifkan pembatas laju (rate limit)
// di Vercel agar kuota tidak dihabiskan orang lain.

const MODELS = ['gemini-3.5-flash', 'gemini-flash-latest'];

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metode tidak diizinkan' });

  // Hanya terima permintaan dari situs sendiri
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'Asal permintaan tidak diizinkan' });
    } catch { return res.status(403).json({ error: 'Asal permintaan tidak valid' }); }
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: 'AI belum dikonfigurasi' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const system = String((body && body.system) || '').slice(0, 2000);
  const prompt = String((body && body.prompt) || '').slice(0, 1500);
  if (!prompt) return res.status(400).json({ error: 'Permintaan kosong' });

  for (const model of MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        }),
      });
      if (!r.ok) continue;
      const data = await r.json();
      const text = ((data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [])
        .map(p => p.text || '').join('').trim();
      if (text) return res.status(200).json({ text });
    } catch { /* coba model berikutnya */ }
  }
  return res.status(502).json({ error: 'AI tidak merespons' });
};
