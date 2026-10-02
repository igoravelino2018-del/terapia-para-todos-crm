export default function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'CRM environment is not configured' });
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ url, key });
}
