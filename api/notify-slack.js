module.exports = async (req, res) => {
  // Basic CORS support (helpful if posting from a different origin)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  try {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      return res.status(500).json({ error: 'Missing SLACK_WEBHOOK_URL' });
    }
    const { text, mentions, taskTitle, podId, podName, subId, subprojectName, taskId, createdByName, createdByEmail } = req.body || {};
    if (!text || !Array.isArray(mentions) || mentions.length === 0) {
      return res.status(400).json({ error: 'Invalid payload: requires text and non-empty mentions' });
    }
    const snippet = String(text).slice(0, 300);
    const truncated = text.length > 300 ? '…' : '';
    const mentionedDisplay = mentions
      .map((m) => m?.name || m?.email || m?.id || 'User')
      .join(', ');
    const createdByDisplay = createdByName || createdByEmail || 'Unknown User';
    const capFirst = (s) => (s && typeof s === 'string' && s.length > 0) ? (s.charAt(0).toUpperCase() + s.slice(1)) : s || '';
    // Basic dashboard link (cannot deep link to drawer reliably without client code)
    const baseUrl = (process.env.DASHBOARD_BASE_URL || '').trim();
    const normalizedBase = baseUrl.replace(/\/+$/, '');
    const taskLink = normalizedBase ? `${normalizedBase}/projects#task=${encodeURIComponent(taskId || '')}` : '';
    const lines = [
      `*New comment mentioning ${mentionedDisplay}*`,
      `• Task: “${taskTitle || 'Task'}”`,
      `• By: ${createdByDisplay}`,
    ];
    const podDisplay = capFirst(podName || podId || '');
    const subDisplay = subprojectName || subId || '';
    if (podDisplay) lines.push(`• Pod: ${podDisplay}`);
    if (subDisplay) lines.push(`• Subproject: ${subDisplay}`);
    if (taskLink) lines.push(`• Link: ${taskLink}`);
    const payload = {
      text: `${lines.join('\n')}\n\n> ${snippet}${truncated}`,
    };
    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      return res.status(502).json({ error: 'Slack webhook failed', details: errText });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('notify-slack error', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};


