export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  console.log('ML notification:', JSON.stringify(req.body));
  
  // TODO: process notifications (orders, items, shipments, stock)
  // For now, just acknowledge receipt
  res.status(200).json({ ok: true });
}
