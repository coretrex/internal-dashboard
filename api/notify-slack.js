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
    const taskLink = normalizedBase
      ? `${normalizedBase}/projects#pod=${encodeURIComponent(podId || '')}&sub=${encodeURIComponent(subId || '')}&task=${encodeURIComponent(taskId || '')}`
      : '';
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
    // Optionally send DMs to mentioned users if a bot token is available
    const botToken = process.env.SLACK_BOT_TOKEN;
    if (botToken) {
      // Build mapping from env or default hardcoded
      let idMap = {};
      try {
        if (process.env.SLACK_DM_ID_MAP) {
          idMap = JSON.parse(process.env.SLACK_DM_ID_MAP);
        }
      } catch (_) {}
      // Fallback map (names -> Slack user IDs)
      const fallback = {
        "Bobby Browning": "U05FHUK9FJA",
        "Brandon Reichert": "U03KSK78YLR",
        "Darcie Fullington": "U01AHPVCHD0",
        "Moe Malugen": "U09H2FPPUDR",
        "Noah Mrok": "U05LS042YTE",
        "Robby Asbery": "U06GZSEUU1H",
        "Stephen Fullington": "USED2J6HE"
      };
      const mergedMap = { ...fallback, ...idMap };
      const normalize = (s) => (s || '').trim().toLowerCase();
      // Prepare DM text
      const dmLines = [
        `*You were mentioned by ${createdByDisplay}*`,
        `• Task: “${taskTitle || 'Task'}”`,
      ];
      if (podDisplay) dmLines.push(`• Pod: ${podDisplay}`);
      if (subDisplay) dmLines.push(`• Subproject: ${subDisplay}`);
      if (taskLink) dmLines.push(`• Link: ${taskLink}`);
      dmLines.push('', `> ${snippet}${truncated}`);
      const dmText = dmLines.join('\n');
      // For each mention, find an ID by name or email
      const uniqueUserIds = new Set();
      for (const m of mentions) {
        const name = m?.name || '';
        const email = (m?.email || '').toLowerCase();
        const byName = mergedMap[name] || mergedMap[name?.trim()] || mergedMap[name?.toUpperCase()] || mergedMap[name?.toLowerCase()];
        const byEmail = mergedMap[email];
        const userId = byName || byEmail;
        if (userId) uniqueUserIds.add(userId);
      }
      // Open DM and send message
      for (const userId of uniqueUserIds) {
        try {
          // Open conversation (IM) to get channel id
          const openResp = await fetch('https://slack.com/api/conversations.open', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Authorization': `Bearer ${botToken}`
            },
            body: JSON.stringify({ users: userId })
          });
          const openJson = await openResp.json();
          const channelId = openJson?.channel?.id;
          if (channelId) {
            await fetch('https://slack.com/api/chat.postMessage', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Authorization': `Bearer ${botToken}`
              },
              body: JSON.stringify({ channel: channelId, text: dmText })
            });
          }
        } catch (_) {}
      }
    }
    return res.status(200).json({ ok: true, dmAttempted: !!process.env.SLACK_BOT_TOKEN });
  } catch (e) {
    console.error('notify-slack error', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};


