require('dotenv').config();
const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const { MongoClient } = require('mongodb');

const hashPwd = (p) => crypto.createHash('sha256').update(p).digest('hex');
const DEFAULT_PWD_HASH = hashPwd('AnNissa2026!');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

// ── MongoDB connection cache (important for Vercel serverless) ──
let cachedDb = null;
const connectDB = async () => {
  if (cachedDb) return cachedDb;
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  cachedDb = client.db(process.env.MONGODB_DB || 'annissa');
  return cachedDb;
};
const col = async (name) => (await connectDB()).collection(name);

// ── Default settings ──
const defaultSettings = {
  company: {
    name: 'AnNissa Dev Group',
    email: 'contact@annissadevgroup.com',
    phone: '',
    address: 'Dakar, Sénégal',
    website: 'annissadevgroup.com',
    siret: '',
    taxRate: 18,
    currency: 'FCFA',
    quotePrefix: 'DEV',
    invoicePrefix: 'FACT'
  }
};

// ── Middleware ──
app.use(express.json({ limit: '10mb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'annissa-admin-7x9k2m4p',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGODB_URI, dbName: process.env.MONGODB_DB || 'annissa' }),
  cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000 }
}));

// Protect /admin pages before static files
app.use((req, res, next) => {
  const isAdmin = req.path.startsWith('/admin');
  const isPublic = req.path === '/admin/login' || req.path === '/admin/login.html';
  const isAsset = /\.(css|js|svg|png|ico|woff2?)$/.test(req.path);
  if (isAdmin && !isPublic && !isAsset && !req.session?.isAdmin) {
    return res.redirect('/admin/login');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
}));

// ── AUTH ──
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const c = await col('settings');
    let settings = await c.findOne({ _id: 'main' });
    if (!settings) { settings = { _id: 'main', ...defaultSettings }; await c.insertOne(settings); }

    const adminEmail = settings.adminEmail || settings.company?.email || 'contact@annissadevgroup.com';
    if (!settings.adminPasswordHash) {
      settings.adminPasswordHash = DEFAULT_PWD_HASH;
      await c.updateOne({ _id: 'main' }, { $set: { adminPasswordHash: DEFAULT_PWD_HASH } });
    }
    if (email === adminEmail && hashPwd(password) === settings.adminPasswordHash) {
      req.session.isAdmin = true;
      req.session.adminEmail = email;
      return res.json({ success: true });
    }
    res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/auth/check', (req, res) => {
  res.json({ authenticated: !!(req.session?.isAdmin) });
});

// ── MESSAGES public (formulaire de contact) ──
app.post('/api/messages', async (req, res) => {
  try {
    const c = await col('messages');
    const msg = { id: uuidv4(), ...req.body, read: false, createdAt: new Date().toISOString() };
    await c.insertOne(msg);
    res.json(msg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── AUTH REQUIRED for all routes below ──
app.use('/api', (req, res, next) => {
  if (req.session?.isAdmin) return next();
  res.status(401).json({ error: 'Non autorisé — Veuillez vous connecter' });
});

// ── CLIENTS ──
app.get('/api/clients', async (req, res) => {
  try { res.json(await (await col('clients')).find({}).sort({ createdAt: 1 }).toArray()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/clients', async (req, res) => {
  try {
    const client = { id: uuidv4(), ...req.body, createdAt: new Date().toISOString() };
    await (await col('clients')).insertOne(client);
    res.status(201).json(client);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/clients/:id', async (req, res) => {
  try {
    const c = await col('clients');
    const updated = { ...req.body, updatedAt: new Date().toISOString() };
    const result = await c.findOneAndUpdate({ id: req.params.id }, { $set: updated }, { returnDocument: 'after' });
    if (!result) return res.status(404).json({ error: 'Client introuvable' });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/clients/:id', async (req, res) => {
  try { await (await col('clients')).deleteOne({ id: req.params.id }); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PROJECTS ──
app.get('/api/projects', async (req, res) => {
  try { res.json(await (await col('projects')).find({}).sort({ createdAt: 1 }).toArray()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/projects', async (req, res) => {
  try {
    const project = { id: uuidv4(), ...req.body, createdAt: new Date().toISOString() };
    await (await col('projects')).insertOne(project);
    res.status(201).json(project);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/projects/:id', async (req, res) => {
  try {
    const updated = { ...req.body, updatedAt: new Date().toISOString() };
    const result = await (await col('projects')).findOneAndUpdate({ id: req.params.id }, { $set: updated }, { returnDocument: 'after' });
    if (!result) return res.status(404).json({ error: 'Projet introuvable' });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/projects/:id', async (req, res) => {
  try { await (await col('projects')).deleteOne({ id: req.params.id }); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── QUOTES (Devis) ──
app.get('/api/quotes', async (req, res) => {
  try { res.json(await (await col('quotes')).find({}).sort({ createdAt: 1 }).toArray()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/quotes', async (req, res) => {
  try {
    const c = await col('quotes');
    const settings = await (await col('settings')).findOne({ _id: 'main' }) || defaultSettings;
    const prefix = settings.company?.quotePrefix || 'DEV';
    const count = await c.countDocuments();
    const quote = {
      id: uuidv4(),
      number: `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
      ...req.body,
      status: 'draft',
      createdAt: new Date().toISOString()
    };
    await c.insertOne(quote);
    res.status(201).json(quote);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/quotes/:id', async (req, res) => {
  try {
    const updated = { ...req.body, updatedAt: new Date().toISOString() };
    const result = await (await col('quotes')).findOneAndUpdate({ id: req.params.id }, { $set: updated }, { returnDocument: 'after' });
    if (!result) return res.status(404).json({ error: 'Devis introuvable' });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/quotes/:id', async (req, res) => {
  try { await (await col('quotes')).deleteOne({ id: req.params.id }); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Convert quote to invoice
app.post('/api/quotes/:id/convert', async (req, res) => {
  try {
    const quotes = await col('quotes');
    const invoices = await col('invoices');
    const settings = await (await col('settings')).findOne({ _id: 'main' }) || defaultSettings;

    const quote = await quotes.findOne({ id: req.params.id });
    if (!quote) return res.status(404).json({ error: 'Devis introuvable' });

    const prefix = settings.company?.invoicePrefix || 'FACT';
    const count = await invoices.countDocuments();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const invoice = {
      id: uuidv4(),
      number: `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
      quoteId: quote.id,
      clientId: quote.clientId,
      projectId: quote.projectId,
      clientName: quote.clientName,
      projectName: quote.projectName,
      items: quote.items,
      taxRate: quote.taxRate,
      subtotal: quote.subtotal,
      taxAmount: quote.taxAmount,
      total: quote.total,
      status: 'sent',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: dueDate.toISOString().split('T')[0],
      notes: quote.notes || '',
      createdAt: new Date().toISOString()
    };

    await invoices.insertOne(invoice);
    await quotes.updateOne({ id: req.params.id }, { $set: { status: 'accepted', updatedAt: new Date().toISOString() } });

    res.status(201).json(invoice);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── INVOICES (Factures) ──
app.get('/api/invoices', async (req, res) => {
  try { res.json(await (await col('invoices')).find({}).sort({ createdAt: 1 }).toArray()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/invoices', async (req, res) => {
  try {
    const c = await col('invoices');
    const settings = await (await col('settings')).findOne({ _id: 'main' }) || defaultSettings;
    const prefix = settings.company?.invoicePrefix || 'FACT';
    const count = await c.countDocuments();
    const invoice = {
      id: uuidv4(),
      number: `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
      ...req.body,
      createdAt: new Date().toISOString()
    };
    await c.insertOne(invoice);
    res.status(201).json(invoice);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/invoices/:id', async (req, res) => {
  try {
    const updated = { ...req.body, updatedAt: new Date().toISOString() };
    const result = await (await col('invoices')).findOneAndUpdate({ id: req.params.id }, { $set: updated }, { returnDocument: 'after' });
    if (!result) return res.status(404).json({ error: 'Facture introuvable' });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/invoices/:id', async (req, res) => {
  try { await (await col('invoices')).deleteOne({ id: req.params.id }); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SEND EMAIL (Brevo) ──
const buildEmailHTML = (data, type, settings) => {
  const co = settings.company || {};
  const cur = co.currency || 'FCFA';
  const fmt = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const isQuote = type === 'quote';
  const label = isQuote ? 'Devis' : 'Facture';
  const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

  const itemsRows = (data.items || []).map((i, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#fff' : '#f8f9fe'}">
      <td style="padding:11px 14px;border-bottom:1px solid #e8ecf8;font-size:13px;color:#1c2360;line-height:1.4">${i.description}</td>
      <td style="padding:11px 14px;border-bottom:1px solid #e8ecf8;text-align:center;font-size:13px;color:#64748b;white-space:nowrap">${i.quantity}</td>
      <td style="padding:11px 14px;border-bottom:1px solid #e8ecf8;text-align:right;font-size:13px;color:#64748b;white-space:nowrap">${fmt(i.unitPrice)} ${cur}</td>
      <td style="padding:11px 14px;border-bottom:1px solid #e8ecf8;text-align:right;font-size:13px;font-weight:700;color:#0d1347;white-space:nowrap">${fmt(i.quantity * i.unitPrice)} ${cur}</td>
    </tr>`).join('');

  const dateInfo = isQuote
    ? `<span style="background:rgba(240,180,41,.15);color:#b8860b;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px">Valable jusqu'au ${fmtDate(data.validUntil)}</span>`
    : `<span style="background:rgba(240,180,41,.15);color:#b8860b;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px">Échéance : ${fmtDate(data.dueDate)}</span>`;

  const acompteBlock = data.acompte > 0 ? `
    <tr>
      <td colspan="3" style="padding:10px 14px;text-align:right;font-size:13px;color:#10b981;font-weight:600">Acompte versé</td>
      <td style="padding:10px 14px;text-align:right;font-size:13px;color:#10b981;font-weight:700;white-space:nowrap">- ${fmt(data.acompte)} ${cur}</td>
    </tr>
    <tr style="background:#10b981">
      <td colspan="3" style="padding:12px 14px;text-align:right;font-size:12px;color:#fff;font-weight:700;text-transform:uppercase">Reste à payer</td>
      <td style="padding:12px 14px;text-align:right;font-size:16px;color:#fff;font-weight:800;white-space:nowrap">${fmt(data.reste ?? (data.total - data.acompte))} ${cur}</td>
    </tr>` : '';

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#eef0f8;font-family:'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f8;padding:32px 16px"><tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%">
  <tr><td style="background:linear-gradient(135deg,#0d1347 0%,#1a2a7a 100%);padding:36px 40px;border-radius:12px 12px 0 0">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><div style="font-size:24px;font-weight:800;color:#f0b429">${co.name || 'AnNissa Dev Group'}</div></td>
      <td align="right"><div style="background:rgba(240,180,41,.12);border:1px solid rgba(240,180,41,.3);border-radius:8px;padding:10px 16px;display:inline-block">
        <div style="font-size:11px;color:rgba(255,255,255,.5);text-transform:uppercase">${label}</div>
        <div style="font-size:18px;font-weight:800;color:#f0b429">${data.number}</div>
      </div></td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#f0b429;height:3px;font-size:0">&nbsp;</td></tr>
  <tr><td style="background:#fff;padding:20px 40px;border-bottom:1px solid #e8ecf8">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><div style="font-size:15px;font-weight:700;color:#0d1347">${data.clientName || '—'}</div>
        ${data.projectName ? `<div style="font-size:12px;color:#64748b">Projet : ${data.projectName}</div>` : ''}</td>
      <td align="right">${dateInfo}</td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#fff;padding:24px 40px 0">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e8ecf8">
      <thead><tr style="background:#0d1347">
        <th style="padding:12px 14px;text-align:left;color:#f0b429;font-size:10px;text-transform:uppercase">Prestation</th>
        <th style="padding:12px 14px;text-align:center;color:#f0b429;font-size:10px;text-transform:uppercase">Qté</th>
        <th style="padding:12px 14px;text-align:right;color:#f0b429;font-size:10px;text-transform:uppercase">Prix unit.</th>
        <th style="padding:12px 14px;text-align:right;color:#f0b429;font-size:10px;text-transform:uppercase">Total</th>
      </tr></thead>
      <tbody>${itemsRows}</tbody>
      <tfoot>
        <tr style="background:#0d1347">
          <td colspan="3" style="padding:14px;text-align:right;font-size:12px;color:rgba(255,255,255,.6);text-transform:uppercase">Total général</td>
          <td style="padding:14px;text-align:right;font-size:18px;font-weight:800;color:#f0b429;white-space:nowrap">${fmt(data.total)} ${cur}</td>
        </tr>
        ${acompteBlock}
      </tfoot>
    </table>
  </td></tr>
  ${data.notes ? `<tr><td style="background:#fff;padding:20px 40px 0">
    <div style="background:#f8f9fe;border-left:3px solid #f0b429;padding:14px 18px">
      <div style="font-size:10px;font-weight:700;color:#f0b429;text-transform:uppercase;margin-bottom:6px">Notes &amp; Conditions</div>
      <div style="font-size:12px;color:#64748b;line-height:1.8">${data.notes.replace(/\n/g, '<br>')}</div>
    </div>
  </td></tr>` : ''}
  <tr><td style="background:#fff;padding:28px 40px">
    <p style="margin:0;font-size:14px;font-weight:700;color:#0d1347">${co.name || 'AnNissa Dev Group'}</p>
    <p style="margin:3px 0 0;font-size:12px;color:#64748b">${[co.phone, co.email, co.website].filter(Boolean).join(' · ')}</p>
  </td></tr>
  <tr><td style="background:linear-gradient(135deg,#0d1347 0%,#1a2a7a 100%);padding:20px 40px;border-radius:0 0 12px 12px">
    <span style="font-size:13px;font-weight:700;color:#f0b429">${co.name || 'AnNissa Dev Group'}</span>
    <span style="font-size:10px;color:rgba(255,255,255,.3);margin-left:8px">© ${new Date().getFullYear()}</span>
  </td></tr>
</table></td></tr></table></body></html>`;
};

app.post('/api/send-email', async (req, res) => {
  try {
    const { to, pdfBase64, filename, quoteId, invoiceId } = req.body;
    const settings = await (await col('settings')).findOne({ _id: 'main' }) || defaultSettings;
    const apiKey = settings.apiKey;
    const senderEmail = settings.smtp?.from || settings.smtp?.user || '';
    const companyName = settings.company?.name || 'AnNissa Dev Group';

    if (!apiKey) return res.status(400).json({ error: 'Clé API Brevo non configurée.' });

    const type = quoteId ? 'quote' : 'invoice';
    const data = quoteId
      ? await (await col('quotes')).findOne({ id: quoteId })
      : await (await col('invoices')).findOne({ id: invoiceId });

    if (!data) return res.status(404).json({ error: 'Document introuvable.' });

    const label = type === 'quote' ? 'Devis' : 'Facture';
    const htmlContent = buildEmailHTML(data, type, settings);

    const payload = {
      sender: { name: companyName, email: senderEmail },
      to: [{ email: to }],
      subject: `${label} ${data.number} — ${companyName}`,
      htmlContent
    };

    if (pdfBase64) {
      const cleanBase64 = pdfBase64.replace(/^data:.*?;base64,\s*/, '').replace(/\s/g, '');
      payload.attachment = [{ content: cleanBase64, name: filename || `${label}_${data.number}.pdf` }];
    }

    const body = JSON.stringify(payload);
    const https = require('https');
    const request = https.request({
      hostname: 'api.brevo.com', path: '/v3/smtp/email', method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (response) => {
      let d = '';
      response.on('data', chunk => d += chunk);
      response.on('end', async () => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          if (quoteId) {
            const q = await (await col('quotes')).findOne({ id: quoteId });
            if (q && q.status === 'draft') {
              await (await col('quotes')).updateOne({ id: quoteId }, { $set: { status: 'sent', updatedAt: new Date().toISOString() } });
            }
          }
          res.json({ success: true });
        } else {
          let parsed; try { parsed = JSON.parse(d); } catch(e) { parsed = {}; }
          res.status(response.statusCode).json({ error: parsed.message || d });
        }
      });
    });
    request.on('error', err => res.status(500).json({ error: err.message }));
    request.write(body);
    request.end();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── MESSAGES ──
app.get('/api/messages', async (req, res) => {
  try { res.json(await (await col('messages')).find({}).sort({ createdAt: -1 }).toArray()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/messages/:id/read', async (req, res) => {
  try {
    const result = await (await col('messages')).findOneAndUpdate({ id: req.params.id }, { $set: { read: true } }, { returnDocument: 'after' });
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/messages/:id', async (req, res) => {
  try { await (await col('messages')).deleteOne({ id: req.params.id }); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SETTINGS ──
app.get('/api/settings', async (req, res) => {
  try {
    const c = await col('settings');
    let settings = await c.findOne({ _id: 'main' });
    if (!settings) { settings = { _id: 'main', ...defaultSettings }; await c.insertOne(settings); }
    res.json(settings);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/settings', async (req, res) => {
  try {
    const data = { _id: 'main', ...req.body };
    await (await col('settings')).replaceOne({ _id: 'main' }, data, { upsert: true });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── STATS ──
app.get('/api/stats', async (req, res) => {
  try {
    const [clients, projects, quotes, invoices] = await Promise.all([
      (await col('clients')).find({}).toArray(),
      (await col('projects')).find({}).toArray(),
      (await col('quotes')).find({}).toArray(),
      (await col('invoices')).find({}).toArray()
    ]);
    res.json({
      clients: clients.length,
      projects: projects.length,
      activeProjects: projects.filter(p => p.status === 'in-progress').length,
      quotes: quotes.length,
      pendingQuotes: quotes.filter(q => q.status === 'sent').length,
      invoices: invoices.length,
      totalRevenue: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0),
      pendingRevenue: invoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + (i.total || 0), 0)
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SPA routes ──
app.get('/admin/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html')));
app.get('/admin*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html')));

// ── Start server (local) / export (Vercel) ──
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`\n✅ AnNissa Dev Group — http://localhost:${PORT}`);
    console.log(`   Admin : http://localhost:${PORT}/admin\n`);
  });
}

module.exports = app;
