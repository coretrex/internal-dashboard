const admin = require('firebase-admin');

let adminInitialized = false;
function initAdmin() {
  if (adminInitialized) return;
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!svc || !projectId) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT or FIREBASE_PROJECT_ID');
  }
  const creds = JSON.parse(svc);
  if (!creds.project_id) creds.project_id = projectId;
  admin.initializeApp({
    credential: admin.credential.cert(creds),
    projectId
  });
  adminInitialized = true;
}

function getTodayStringInTZ(tz) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const d = parts.find(p => p.type === 'day').value;
  return `${y}-${m}-${d}`; // YYYY-MM-DD
}

function normalizeAssigneeKeys(task) {
  const keys = [];
  if (Array.isArray(task.assignees) && task.assignees.length) {
    for (const a of task.assignees) {
      const email = (a && a.email) ? String(a.email).toLowerCase() : '';
      const name = (a && a.name) ? a.name : (email || a?.id || 'Unassigned');
      const key = email || name;
      keys.push({ key, display: name || email || 'Unassigned' });
    }
  } else if (task.assignee) {
    const display = task.assignee;
    keys.push({ key: display, display });
  } else {
    keys.push({ key: 'Unassigned', display: 'Unassigned' });
  }
  return keys;
}

async function buildSummary(db, tz) {
  const today = getTodayStringInTZ(tz);
  const assigneeToCounts = new Map(); // key -> { display, dueToday, overdue }

  // Query all tasks across projects
  const snap = await db.collectionGroup('tasks').get();
  snap.forEach(docSnap => {
    const data = docSnap.data() || {};
    if (data.completed) return;
    const dueDate = data.dueDate || '';
    if (!dueDate) return;
    const buckets = {
      dueToday: dueDate === today,
      overdue: dueDate < today,
    };
    if (!buckets.dueToday && !buckets.overdue) return;

    const assignees = normalizeAssigneeKeys(data);
    assignees.forEach(({ key, display }) => {
      if (!assigneeToCounts.has(key)) {
        assigneeToCounts.set(key, { display, dueToday: 0, overdue: 0 });
      }
      const rec = assigneeToCounts.get(key);
      if (buckets.dueToday) rec.dueToday += 1;
      if (buckets.overdue) rec.overdue += 1;
    });
  });

  // Sort by name
  const rows = Array.from(assigneeToCounts.values()).sort((a, b) =>
    (a.display || '').localeCompare(b.display || '')
  );

  // Totals
  const totals = rows.reduce(
    (acc, r) => ({ dueToday: acc.dueToday + r.dueToday, overdue: acc.overdue + r.overdue }),
    { dueToday: 0, overdue: 0 }
  );

  return { today, rows, totals };
}

function formatSlackMessage(summary, tz, label) {
  const lines = [];
  lines.push(`*Task Summary (${label} ${tz})*`);
  if (summary.rows.length === 0) {
    lines.push('No tasks due today or overdue.');
  } else {
    summary.rows.forEach(r => {
      // Bold assignee name on its own line, then counts on new lines
      lines.push(`- *${r.display}*\n  🟢 ${r.dueToday} due today\n  🔴 *${r.overdue}* overdue\n`);
    });
    lines.push(`\nTotals: 🟢 ${summary.totals.dueToday} due today • 🔴 *${summary.totals.overdue}* overdue`);
  }
  return lines.join('\n');
}

module.exports = async (req, res) => {
  const debug = (req.url || '').includes('debug=1');
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(204).end();
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  try {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      return res.status(500).json({ error: 'Missing SLACK_WEBHOOK_URL' });
    }
    const tz = process.env.TIMEZONE || 'America/Chicago';
    // Initialize admin with better error surfacing
    try {
      initAdmin();
    } catch (e) {
      if (debug) {
        return res.status(500).json({ error: 'Admin init failed', message: String(e && e.message || e) });
      }
      throw e;
    }
    const db = admin.firestore();

    let summary;
    try {
      summary = await buildSummary(db, tz);
    } catch (e) {
      if (debug) {
        return res.status(500).json({ error: 'Firestore query failed', message: String(e && e.message || e) });
      }
      throw e;
    }
    const now = new Date();
    const labelFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    const label = labelFmt.format(now); // e.g., 8:00 AM
    const text = formatSlackMessage(summary, 'CT', label);

    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      return res.status(502).json({ error: 'Slack webhook failed', details: errText });
    }
    return res.status(200).json({ ok: true, sentAt: now.toISOString(), summary });
  } catch (e) {
    console.error('summary-slack error', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};


