// ===== STATE =====
let state = {
  clients: [], projects: [], quotes: [], invoices: [], settings: {}, messages: [],
  currentPage: 'dashboard'
};

// ===== API =====
let lastOwnWrite = 0, syncVersion = '';

const api = {
  async get(url) { const r = await fetch(url); return r.json(); },
  async post(url, data) { lastOwnWrite = Date.now(); const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); return r.json(); },
  async put(url, data)  { lastOwnWrite = Date.now(); const r = await fetch(url, { method: 'PUT',  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); return r.json(); },
  async del(url)        { lastOwnWrite = Date.now(); const r = await fetch(url, { method: 'DELETE' }); return r.json(); }
};

// ===== UTILS =====
const fmt = {
  currency: (n, cur = 'FCFA') => {
    if (!n && n !== 0) return '—';
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ' + cur;
  },
  date: (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—',
  dateInput: (d) => d ? new Date(d).toISOString().split('T')[0] : '',
  initials: (name) => name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?'
};

const statusLabel = {
  draft: 'Brouillon', sent: 'Envoyé', accepted: 'Accepté', rejected: 'Refusé',
  paid: 'Payé', overdue: 'En retard', pending: 'En attente',
  'in-progress': 'En cours', completed: 'Terminé', cancelled: 'Annulé'
};

const toast = (msg, type = 'success') => {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast toast-${type} show`;
  setTimeout(() => el.className = 'toast', 3000);
};

// ===== MODAL =====
const openModal = (title, bodyHTML, size = '') => {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHTML;
  const m = document.getElementById('modal');
  m.className = `modal ${size}`;
  document.getElementById('modalOverlay').classList.add('open');
};
const closeModal = () => document.getElementById('modalOverlay').classList.remove('open');
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });

// ===== CONFIRM DIALOG =====
let confirmResolve = null;
const openConfirm = (title, msg) => new Promise(resolve => {
  confirmResolve = resolve;
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').textContent = msg;
  document.getElementById('confirmOverlay').style.display = 'flex';
  document.getElementById('confirmBtn').onclick = () => {
    document.getElementById('confirmOverlay').style.display = 'none';
    confirmResolve = null;
    resolve(true);
  };
});
const closeConfirm = () => {
  document.getElementById('confirmOverlay').style.display = 'none';
  if (confirmResolve) { confirmResolve(false); confirmResolve = null; }
};

// ===== REAL-TIME SYNC (polling 3s) =====
const silentRefresh = async () => {
  try {
    if (document.getElementById('modalOverlay')?.classList.contains('open')) return;
    const [clients, projects, quotes, invoices, messages] = await Promise.all([
      api.get('/api/clients'), api.get('/api/projects'),
      api.get('/api/quotes'), api.get('/api/invoices'), api.get('/api/messages')
    ]);
    state = { ...state, clients, projects, quotes, invoices, messages };
    updateBadges();
    renderPage(state.currentPage);
  } catch {}
};

const syncPoll = async () => {
  try {
    const { version } = await fetch('/api/events/version').then(r => r.json());
    if (version !== syncVersion && Date.now() - lastOwnWrite > 3000) {
      await silentRefresh();
    }
    syncVersion = version;
  } catch {}
};

// ===== LOAD ALL DATA =====
const loadAll = async () => {
  const [clients, projects, quotes, invoices, settings, messages] = await Promise.all([
    api.get('/api/clients'), api.get('/api/projects'),
    api.get('/api/quotes'), api.get('/api/invoices'), api.get('/api/settings'), api.get('/api/messages')
  ]);
  state = { ...state, clients, projects, quotes, invoices, settings, messages };
  updateBadges();
};

const updateBadges = () => {
  document.getElementById('clientsBadge').textContent = state.clients.length;
  document.getElementById('projectsBadge').textContent = state.projects.length;
  document.getElementById('quotesBadge').textContent = state.quotes.length;
  document.getElementById('invoicesBadge').textContent = state.invoices.length;
  const unread = state.messages.filter(m => !m.read).length;
  const badge = document.getElementById('messagesBadge');
  if (badge) { badge.textContent = unread; badge.style.display = unread > 0 ? '' : 'none'; }
};

// ===== NAVIGATION =====
const navigate = (page) => {
  state.currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  const titles = {
    dashboard: ['Dashboard', 'Vue d\'ensemble'],
    clients: ['Clients', 'Gestion des clients'],
    projects: ['Projets', 'Suivi des projets'],
    quotes: ['Devis', 'Gestion des devis'],
    invoices: ['Factures', 'Gestion de la facturation'],
    settings: ['Paramètres', 'Configuration de l\'entreprise'],
    messages: ['Messages', 'Demandes reçues depuis le site']
  };
  const [title, sub] = titles[page] || ['Admin', ''];
  document.getElementById('pageTitle').textContent = title;
  document.getElementById('pageSubtitle').textContent = sub;
  renderPage(page);
  // Close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');
};

document.querySelectorAll('.nav-item[data-page]').forEach(el => {
  el.addEventListener('click', (e) => { e.preventDefault(); navigate(el.dataset.page); });
});

// ===== SIDEBAR MOBILE =====
document.getElementById('sidebarOpen').addEventListener('click', () => document.getElementById('sidebar').classList.add('open'));
document.getElementById('sidebarClose').addEventListener('click', () => document.getElementById('sidebar').classList.remove('open'));

// ===== RENDER PAGE =====
const renderPage = (page) => {
  const main = document.getElementById('adminMain');
  main.innerHTML = '';
  const pages = { dashboard: renderDashboard, clients: renderClients, projects: renderProjects, quotes: renderQuotes, invoices: renderInvoices, settings: renderSettings, messages: renderMessages };
  if (pages[page]) pages[page](main);
};

// ===== DASHBOARD =====
const renderDashboard = (main) => {
  const cur = state.settings.company?.currency || 'FCFA';
  const revenue = state.invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0);
  const activeInvoices = state.invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
  const totalFacture = activeInvoices.reduce((s, i) => s + (i.total || 0), 0);
  const acompteRecu = activeInvoices.filter(i => (i.acompte || 0) > 0).reduce((s, i) => s + (i.acompte || 0), 0);
  const resteAEncaisser = activeInvoices.reduce((s, i) => s + (i.reste ?? Math.max(0, (i.total || 0) - (i.acompte || 0))), 0);
  const activeProjects = state.projects.filter(p => p.status === 'in-progress').length;
  const invoicesAvecAcompte = activeInvoices.filter(i => (i.acompte || 0) > 0);

  main.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon stat-icon-gold">👥</div>
        <div class="stat-content">
          <div class="stat-value">${state.clients.length}</div>
          <div class="stat-label">Clients</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon-blue">📦</div>
        <div class="stat-content">
          <div class="stat-value">${activeProjects}</div>
          <div class="stat-label">Projets actifs</div>
          <div class="stat-trend trend-neutral">${state.projects.length} au total</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon-green">💰</div>
        <div class="stat-content">
          <div class="stat-value" style="font-size:1.1rem">${fmt.currency(revenue, cur)}</div>
          <div class="stat-label">Chiffre d'affaires</div>
        </div>
      </div>
      <div class="stat-card" style="border-color:rgba(16,185,129,0.3)">
        <div class="stat-icon stat-icon-green">💵</div>
        <div class="stat-content">
          <div class="stat-value" style="font-size:1.1rem;color:var(--success)">${fmt.currency(acompteRecu, cur)}</div>
          <div class="stat-label">Acomptes reçus</div>
          <div class="stat-trend trend-neutral">${invoicesAvecAcompte.length} facture${invoicesAvecAcompte.length > 1 ? 's' : ''}</div>
        </div>
      </div>
      <div class="stat-card" style="border-color:rgba(168,85,247,0.3)">
        <div class="stat-icon stat-icon-purple">⏳</div>
        <div class="stat-content">
          <div class="stat-value" style="font-size:1.1rem">${fmt.currency(resteAEncaisser, cur)}</div>
          <div class="stat-label">Reste à encaisser</div>
          <div class="stat-trend trend-neutral">sur ${fmt.currency(totalFacture, cur)}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon-gold">📋</div>
        <div class="stat-content">
          <div class="stat-value">${state.quotes.filter(q => q.status === 'sent').length}</div>
          <div class="stat-label">Devis en attente</div>
          <div class="stat-trend trend-neutral">${state.quotes.length} au total</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon-red">🧾</div>
        <div class="stat-content">
          <div class="stat-value">${state.invoices.filter(i => i.status === 'overdue').length}</div>
          <div class="stat-label">Factures en retard</div>
        </div>
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Dernières factures</span>
          <button class="btn-admin btn-admin-outline btn-admin-sm" onclick="navigate('invoices')">Voir tout</button>
        </div>
        <div class="recent-list" id="recentInvoices"></div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title" style="color:var(--success)">💵 Acomptes en cours</span>
          <button class="btn-admin btn-admin-outline btn-admin-sm" onclick="navigate('invoices')">Voir factures</button>
        </div>
        <div class="recent-list" id="acomptesList"></div>
      </div>
    </div>
  `;

  const recentInvoices = [...state.invoices].reverse().slice(0, 5);
  document.getElementById('recentInvoices').innerHTML = recentInvoices.length ? recentInvoices.map(inv => `
    <div class="recent-item">
      <div class="recent-avatar">${inv.number?.slice(-4) || '##'}</div>
      <div class="recent-info">
        <div class="recent-name">${inv.clientName || '—'}</div>
        <div class="recent-meta">${inv.number} · ${fmt.date(inv.issueDate)}</div>
      </div>
      <div style="text-align:right">
        <span class="badge badge-${inv.status}">${statusLabel[inv.status] || inv.status}</span>
        ${(inv.acompte || 0) > 0 ? `<div style="font-size:11px;color:var(--success);margin-top:3px">Acompte : ${fmt.currency(inv.acompte, cur)}</div>` : ''}
      </div>
    </div>
  `).join('') : '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:24px">Aucune facture</p>';

  document.getElementById('acomptesList').innerHTML = invoicesAvecAcompte.length ? invoicesAvecAcompte.map(inv => {
    const taux = inv.acompteTaux || Math.round((inv.acompte / inv.total) * 100) || 0;
    const reste = inv.reste ?? Math.max(0, (inv.total || 0) - (inv.acompte || 0));
    const pct = Math.round((inv.acompte / inv.total) * 100);
    return `
    <div class="recent-item" style="flex-direction:column;align-items:stretch;gap:8px;padding:14px 16px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:700;color:var(--text)">${inv.clientName || '—'}</div>
          <div style="font-size:12px;color:var(--text-muted)">${inv.number} · ${fmt.date(inv.issueDate)}</div>
        </div>
        <span class="badge badge-${inv.status}">${statusLabel[inv.status] || inv.status}</span>
      </div>
      <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:8px;padding:10px 12px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div style="text-align:center">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">Total facture</div>
          <div style="font-weight:700;font-size:13px">${fmt.currency(inv.total, cur)}</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">Acompte reçu (${taux}%)</div>
          <div style="font-weight:700;font-size:13px;color:var(--success)">+ ${fmt.currency(inv.acompte, cur)}</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">Reste à encaisser</div>
          <div style="font-weight:700;font-size:13px;color:var(--gold)">${fmt.currency(reste, cur)}</div>
        </div>
      </div>
      <div style="background:rgba(255,255,255,0.05);border-radius:4px;height:6px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--success),#34d399);border-radius:4px;transition:width .5s"></div>
      </div>
    </div>`;
  }).join('') : '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:24px">Aucun acompte en cours</p>';
};

// ===== CLIENTS =====
const renderClients = (main) => {
  main.innerHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Liste des clients (${state.clients.length})</span>
        <button class="btn-admin btn-admin-primary" onclick="openClientForm()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nouveau client
        </button>
      </div>
      <div class="table-toolbar">
        <input class="search-input" placeholder="Rechercher un client..." id="clientSearch" oninput="filterClients()">
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Client</th><th>Email</th><th>Téléphone</th><th>Entreprise</th><th>Ajouté le</th><th>Actions</th>
          </tr></thead>
          <tbody id="clientsBody"></tbody>
        </table>
      </div>
    </div>
  `;
  renderClientsTable(state.clients);
};

const renderClientsTable = (clients) => {
  const tbody = document.getElementById('clientsBody');
  if (!tbody) return;
  if (!clients.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      <h3>Aucun client</h3><p>Ajoutez votre premier client pour commencer</p>
      <button class="btn-admin btn-admin-primary" onclick="openClientForm()">Ajouter un client</button>
    </div></td></tr>`;
    return;
  }
  tbody.innerHTML = clients.map(c => `
    <tr>
      <td><div style="display:flex;align-items:center;gap:10px">
        <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--gold),var(--gold-dark));display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--navy);flex-shrink:0">${fmt.initials(c.name)}</div>
        <strong>${c.name}</strong>
      </div></td>
      <td style="color:var(--text-light)">${c.email || '—'}</td>
      <td style="color:var(--text-light)">${c.phone || '—'}</td>
      <td style="color:var(--text-light)">${c.company || '—'}</td>
      <td style="color:var(--text-muted)">${fmt.date(c.createdAt)}</td>
      <td><div class="table-actions">
        <button class="btn-admin-icon" title="Modifier" onclick="openClientForm('${c.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-admin-icon" title="Nouveau devis" onclick="openQuoteForm(null,'${c.id}')" style="color:var(--gold)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
        </button>
        <button class="btn-admin-icon" title="Supprimer" onclick="deleteClient('${c.id}')" style="color:var(--danger)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div></td>
    </tr>
  `).join('');
};

const filterClients = () => {
  const q = document.getElementById('clientSearch')?.value.toLowerCase() || '';
  renderClientsTable(state.clients.filter(c =>
    c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q)
  ));
};

const openClientForm = (id = null) => {
  const client = id ? state.clients.find(c => c.id === id) : {};
  openModal(id ? 'Modifier le client' : 'Nouveau client', `
    <div class="form-grid">
      <div class="form-group form-full">
        <label>Nom complet *</label>
        <input id="cf_name" value="${client.name || ''}" placeholder="Jean Dupont" required>
      </div>
      <div class="form-group">
        <label>Email *</label>
        <input id="cf_email" type="email" value="${client.email || ''}" placeholder="jean@exemple.com">
      </div>
      <div class="form-group">
        <label>Téléphone</label>
        <input id="cf_phone" value="${client.phone || ''}" placeholder="+221 XX XXX XX XX">
      </div>
      <div class="form-group">
        <label>Entreprise</label>
        <input id="cf_company" value="${client.company || ''}" placeholder="Nom de l'entreprise">
      </div>
      <div class="form-group">
        <label>Pays</label>
        <input id="cf_country" value="${client.country || ''}" placeholder="Sénégal">
      </div>
      <div class="form-group form-full">
        <label>Adresse</label>
        <input id="cf_address" value="${client.address || ''}" placeholder="Adresse complète">
      </div>
      <div class="form-group form-full">
        <label>Notes</label>
        <textarea id="cf_notes" rows="2">${client.notes || ''}</textarea>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn-admin btn-admin-outline" onclick="closeModal()">Annuler</button>
      <button class="btn-admin btn-admin-primary" onclick="saveClient('${id || ''}')">
        ${id ? 'Enregistrer' : 'Créer le client'}
      </button>
    </div>
  `);
};

const saveClient = async (id) => {
  const data = {
    name: document.getElementById('cf_name')?.value?.trim(),
    email: document.getElementById('cf_email')?.value?.trim(),
    phone: document.getElementById('cf_phone')?.value?.trim(),
    company: document.getElementById('cf_company')?.value?.trim(),
    country: document.getElementById('cf_country')?.value?.trim(),
    address: document.getElementById('cf_address')?.value?.trim(),
    notes: document.getElementById('cf_notes')?.value?.trim()
  };
  if (!data.name) { toast('Le nom est obligatoire', 'error'); return; }
  if (id) {
    const updated = await api.put(`/api/clients/${id}`, data);
    state.clients = state.clients.map(c => c.id === id ? updated : c);
    toast('Client mis à jour');
  } else {
    const created = await api.post('/api/clients', data);
    state.clients.push(created);
    toast('Client créé');
  }
  closeModal(); updateBadges(); renderPage('clients');
};

const deleteClient = async (id) => {
  const ok = await openConfirm('Supprimer le client', 'Cette action est irréversible. Le client sera définitivement supprimé.');
  if (!ok) return;
  await api.del(`/api/clients/${id}`);
  state.clients = state.clients.filter(c => c.id !== id);
  updateBadges(); toast('Client supprimé'); renderPage('clients');
};

// ===== PROJECTS =====
const renderProjects = (main) => {
  main.innerHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Projets (${state.projects.length})</span>
        <button class="btn-admin btn-admin-primary" onclick="openProjectForm()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nouveau projet
        </button>
      </div>
      <div class="table-toolbar">
        <input class="search-input" placeholder="Rechercher un projet..." id="projSearch" oninput="filterProjects()">
        <select class="filter-select" id="projStatusFilter" onchange="filterProjects()">
          <option value="">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="in-progress">En cours</option>
          <option value="completed">Terminé</option>
          <option value="cancelled">Annulé</option>
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Projet</th><th>Client</th><th>Type</th><th>Statut</th><th>Budget</th><th>Début</th><th>Actions</th>
          </tr></thead>
          <tbody id="projectsBody"></tbody>
        </table>
      </div>
    </div>
  `;
  renderProjectsTable(state.projects);
};

const renderProjectsTable = (projects) => {
  const tbody = document.getElementById('projectsBody');
  if (!tbody) return;
  const cur = state.settings.company?.currency || 'FCFA';
  if (!projects.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
      <h3>Aucun projet</h3><p>Créez votre premier projet</p>
      <button class="btn-admin btn-admin-primary" onclick="openProjectForm()">Créer un projet</button>
    </div></td></tr>`;
    return;
  }
  const typeLabels = { web: 'Web', mobile: 'Mobile', ai: 'IA', consulting: 'Conseil', other: 'Autre' };
  tbody.innerHTML = projects.map(p => {
    const client = state.clients.find(c => c.id === p.clientId);
    return `<tr>
      <td><strong>${p.name}</strong><br><span style="font-size:11px;color:var(--text-muted)">${p.description?.slice(0, 50) || ''}${p.description?.length > 50 ? '...' : ''}</span></td>
      <td>${client ? `<span style="color:var(--text-light)">${client.name}</span>` : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td><span class="badge badge-sent">${typeLabels[p.type] || p.type || '—'}</span></td>
      <td><span class="badge badge-${p.status}">${statusLabel[p.status] || p.status}</span></td>
      <td style="color:var(--gold)">${fmt.currency(p.budget, cur)}</td>
      <td style="color:var(--text-muted)">${fmt.date(p.startDate)}</td>
      <td><div class="table-actions">
        <button class="btn-admin-icon" onclick="openProjectForm('${p.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-admin-icon" onclick="deleteProject('${p.id}')" style="color:var(--danger)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div></td>
    </tr>`;
  }).join('');
};

const filterProjects = () => {
  const q = document.getElementById('projSearch')?.value.toLowerCase() || '';
  const s = document.getElementById('projStatusFilter')?.value || '';
  renderProjectsTable(state.projects.filter(p =>
    (!q || p.name?.toLowerCase().includes(q)) && (!s || p.status === s)
  ));
};

const openProjectForm = (id = null) => {
  const p = id ? state.projects.find(x => x.id === id) : {};
  projectItems = p.services ? JSON.parse(JSON.stringify(p.services)) : [];
  const cur = state.settings.company?.currency || 'FCFA';
  const clientOptions = state.clients.map(c => `<option value="${c.id}" ${p.clientId === c.id ? 'selected' : ''}>${c.name}</option>`).join('');
  openModal(id ? 'Modifier le projet' : 'Nouveau projet', `
    <div class="form-grid">
      <div class="form-group form-full">
        <label>Nom du projet *</label>
        <input id="pf_name" value="${p.name || ''}" placeholder="Ex: Site e-commerce XYZ">
      </div>
      <div class="form-group">
        <label>Client</label>
        <select id="pf_client"><option value="">Sélectionner...</option>${clientOptions}</select>
      </div>
      <div class="form-group">
        <label>Type</label>
        <select id="pf_type">
          ${['web','mobile','ai','consulting','other'].map(t =>
            `<option value="${t}" ${p.type===t?'selected':''}>${{web:'Web',mobile:'Mobile',ai:'Intelligence Artificielle',consulting:'Conseil IT',other:'Autre'}[t]}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Statut</label>
        <select id="pf_status">
          ${['pending','in-progress','completed','cancelled'].map(s =>
            `<option value="${s}" ${p.status===s?'selected':''}>${statusLabel[s]}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Budget (${cur})</label>
        <input id="pf_budget" type="number" value="${p.budget || ''}" placeholder="0">
      </div>
      <div class="form-group">
        <label>Date de début</label>
        <input id="pf_start" type="date" value="${fmt.dateInput(p.startDate)}">
      </div>
      <div class="form-group">
        <label>Date de fin prévue</label>
        <input id="pf_end" type="date" value="${fmt.dateInput(p.endDate)}">
      </div>
      <div class="form-group form-full">
        <label>Description</label>
        <textarea id="pf_desc" rows="3">${p.description || ''}</textarea>
      </div>
    </div>
    <div style="margin:20px 0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <label style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">Prestations du projet</label>
        <button class="btn-admin btn-admin-outline btn-admin-sm" onclick="addProjectItem()">+ Ajouter une prestation</button>
      </div>
      <div class="table-wrap" style="border:1px solid var(--card-border);border-radius:var(--radius-sm)">
        <table class="items-table">
          <thead><tr><th>Description</th><th>Qté</th><th>Prix unitaire (${cur})</th><th></th></tr></thead>
          <tbody id="projectItemsBody"></tbody>
        </table>
      </div>
      <p style="font-size:11px;color:var(--text-muted);margin-top:8px">Ces prestations seront auto-remplies lors de la création d'un devis pour ce projet.</p>
    </div>
    <div class="form-actions">
      <button class="btn-admin btn-admin-outline" onclick="closeModal()">Annuler</button>
      <button class="btn-admin btn-admin-primary" onclick="saveProject('${id || ''}')">
        ${id ? 'Enregistrer' : 'Créer le projet'}
      </button>
    </div>
  `);
  renderProjectItems();
};

const saveProject = async (id) => {
  const data = {
    name: document.getElementById('pf_name')?.value?.trim(),
    clientId: document.getElementById('pf_client')?.value,
    type: document.getElementById('pf_type')?.value,
    status: document.getElementById('pf_status')?.value,
    budget: parseFloat(document.getElementById('pf_budget')?.value) || 0,
    startDate: document.getElementById('pf_start')?.value,
    endDate: document.getElementById('pf_end')?.value,
    description: document.getElementById('pf_desc')?.value?.trim(),
    services: projectItems.filter(i => i.description.trim())
  };
  const client = state.clients.find(c => c.id === data.clientId);
  data.clientName = client?.name || '';
  if (!data.name) { toast('Le nom du projet est obligatoire', 'error'); return; }
  if (id) {
    const updated = await api.put(`/api/projects/${id}`, data);
    state.projects = state.projects.map(p => p.id === id ? updated : p);
    toast('Projet mis à jour');
  } else {
    const created = await api.post('/api/projects', data);
    state.projects.push(created);
    toast('Projet créé');
  }
  closeModal(); updateBadges(); renderPage('projects');
};

const deleteProject = async (id) => {
  const ok = await openConfirm('Supprimer le projet', 'Ce projet sera définitivement supprimé.');
  if (!ok) return;
  await api.del(`/api/projects/${id}`);
  state.projects = state.projects.filter(p => p.id !== id);
  updateBadges(); toast('Projet supprimé'); renderPage('projects');
};

// ===== QUOTES =====
const renderQuotes = (main) => {
  main.innerHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Devis (${state.quotes.length})</span>
        <button class="btn-admin btn-admin-primary" onclick="openQuoteForm()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nouveau devis
        </button>
      </div>
      <div class="table-toolbar">
        <input class="search-input" placeholder="Rechercher..." id="quoteSearch" oninput="filterQuotes()">
        <select class="filter-select" id="quoteStatusFilter" onchange="filterQuotes()">
          <option value="">Tous les statuts</option>
          <option value="draft">Brouillon</option>
          <option value="sent">Envoyé</option>
          <option value="accepted">Accepté</option>
          <option value="rejected">Refusé</option>
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Numéro</th><th>Client</th><th>Projet</th><th>Montant TTC</th><th>Date</th><th>Statut</th><th>Actions</th>
          </tr></thead>
          <tbody id="quotesBody"></tbody>
        </table>
      </div>
    </div>
  `;
  renderQuotesTable(state.quotes);
};

const renderQuotesTable = (quotes) => {
  const tbody = document.getElementById('quotesBody');
  if (!tbody) return;
  const cur = state.settings.company?.currency || 'FCFA';
  if (!quotes.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <h3>Aucun devis</h3><p>Créez votre premier devis</p>
      <button class="btn-admin btn-admin-primary" onclick="openQuoteForm()">Créer un devis</button>
    </div></td></tr>`;
    return;
  }
  tbody.innerHTML = [...quotes].reverse().map(q => `
    <tr>
      <td><strong style="color:var(--gold)">${q.number}</strong></td>
      <td>${q.clientName || '—'}</td>
      <td style="color:var(--text-muted)">${q.projectName || '—'}</td>
      <td><strong>${fmt.currency(q.total, cur)}</strong></td>
      <td style="color:var(--text-muted)">${fmt.date(q.date)}</td>
      <td><span class="badge badge-${q.status}">${statusLabel[q.status] || q.status}</span></td>
      <td><div class="table-actions">
        <button class="btn-admin-icon" title="Aperçu" onclick="previewDocument('quote','${q.id}')" style="color:var(--gold)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button class="btn-admin-icon" title="Modifier" onclick="openQuoteForm('${q.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-admin-icon" title="Télécharger PDF" onclick="downloadQuotePDF('${q.id}')" style="color:var(--info)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <button class="btn-admin-icon" title="Envoyer par email" onclick="sendByEmail('quote','${q.id}')" style="color:var(--success)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        </button>
        ${q.status !== 'accepted' ? `<button class="btn-admin-icon" title="Changer statut" onclick="changeQuoteStatus('${q.id}')" style="color:var(--gold)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
        </button>` : ''}
        ${q.status === 'accepted' ? `<button class="btn-admin btn-admin-sm btn-admin-success" onclick="convertToInvoice('${q.id}')">→ Facture</button>` : ''}
        <button class="btn-admin-icon" title="Supprimer" onclick="deleteQuote('${q.id}')" style="color:var(--danger)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div></td>
    </tr>
  `).join('');
};

const filterQuotes = () => {
  const q = document.getElementById('quoteSearch')?.value.toLowerCase() || '';
  const s = document.getElementById('quoteStatusFilter')?.value || '';
  renderQuotesTable(state.quotes.filter(x =>
    (!q || x.number?.toLowerCase().includes(q) || x.clientName?.toLowerCase().includes(q)) && (!s || x.status === s)
  ));
};

// Project line items (prestations)
let projectItems = [];
const addProjectItem = () => {
  projectItems.push({ description: '', quantity: 1, unitPrice: 0 });
  renderProjectItems();
};
const removeProjectItem = (i) => { projectItems.splice(i, 1); renderProjectItems(); };
const renderProjectItems = () => {
  const tbody = document.getElementById('projectItemsBody');
  const cur = state.settings.company?.currency || 'FCFA';
  if (!tbody) return;
  tbody.innerHTML = projectItems.map((item, i) => `
    <tr>
      <td><input value="${item.description}" placeholder="Description du service..." oninput="projectItems[${i}].description=this.value"></td>
      <td><input type="number" value="${item.quantity}" min="1" style="width:70px;text-align:center" oninput="projectItems[${i}].quantity=parseFloat(this.value)||1"></td>
      <td><input type="number" value="${item.unitPrice}" min="0" style="width:120px;text-align:right" oninput="projectItems[${i}].unitPrice=parseFloat(this.value)||0"></td>
      <td><button class="item-remove-btn" onclick="removeProjectItem(${i})">✕</button></td>
    </tr>
  `).join('');
};

// Quote line items
let quoteItems = [];
const addQuoteItem = () => {
  quoteItems.push({ description: '', quantity: 1, unitPrice: 0 });
  renderQuoteItems();
};
const removeQuoteItem = (i) => { quoteItems.splice(i, 1); renderQuoteItems(); };

const renderQuoteItems = () => {
  const tbody = document.getElementById('quoteItemsBody');
  const cur = state.settings.company?.currency || 'FCFA';
  if (!tbody) return;
  tbody.innerHTML = quoteItems.map((item, i) => `
    <tr>
      <td><input value="${item.description}" placeholder="Description du service..." oninput="quoteItems[${i}].description=this.value;calcTotals()"></td>
      <td><input type="number" value="${item.quantity}" min="1" style="width:70px;text-align:center" oninput="quoteItems[${i}].quantity=parseFloat(this.value)||1;calcTotals()"></td>
      <td><input type="number" value="${item.unitPrice}" min="0" style="width:120px;text-align:right" oninput="quoteItems[${i}].unitPrice=parseFloat(this.value)||0;calcTotals()"></td>
      <td style="text-align:right;color:var(--gold);font-weight:600">${fmt.currency(item.quantity * item.unitPrice, cur)}</td>
      <td><button class="item-remove-btn" onclick="removeQuoteItem(${i})">✕</button></td>
    </tr>
  `).join('');
  calcTotals();
};

const calcTotals = () => {
  const subtotal = quoteItems.reduce((s, i) => s + (i.quantity * i.unitPrice), 0);
  const cur = state.settings.company?.currency || 'FCFA';
  const el = (id) => document.getElementById(id);
  if (el('q_total')) el('q_total').textContent = fmt.currency(subtotal, cur);
};

const onProjectChange = (projectId) => {
  if (!projectId) return;
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return;

  // Pré-remplir le client si vide
  const clientSel = document.getElementById('qf_client');
  if (clientSel && !clientSel.value && project.clientId) clientSel.value = project.clientId;

  // Auto-remplir les prestations depuis le projet
  if (project.services && project.services.length > 0) {
    quoteItems = JSON.parse(JSON.stringify(project.services));
    renderQuoteItems();
    toast(`${quoteItems.length} prestation(s) importée(s) depuis "${project.name}"`);
    return;
  }

  // Fallback : dernier devis lié à ce projet
  const linked = state.quotes.filter(q => q.projectId === projectId);
  if (linked.length > 0) {
    const last = linked.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    quoteItems = JSON.parse(JSON.stringify(last.items));
    renderQuoteItems();
    toast(`Prestations importées depuis le devis ${last.number}`);
  }
};

const openQuoteForm = (id = null, preClientId = null) => {
  const q = id ? state.quotes.find(x => x.id === id) : {};
  quoteItems = q.items ? JSON.parse(JSON.stringify(q.items)) : [{ description: '', quantity: 1, unitPrice: 0 }];
  const clientOptions = state.clients.map(c =>
    `<option value="${c.id}" ${(q.clientId || preClientId) === c.id ? 'selected' : ''}>${c.name}</option>`
  ).join('');
  const projectOptions = state.projects.map(p =>
    `<option value="${p.id}" ${q.projectId === p.id ? 'selected' : ''}>${p.name}</option>`
  ).join('');
  const cur = state.settings.company?.currency || 'FCFA';
  const today = new Date().toISOString().split('T')[0];
  const validUntil = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  const isFormation = q.type === 'formation';

  openModal(id ? `Devis ${q.number}` : 'Nouveau devis', `
    <div class="form-grid">
      <div class="form-group">
        <label>Client *</label>
        <select id="qf_client"><option value="">Sélectionner...</option>${clientOptions}</select>
      </div>
      <div class="form-group">
        <label>Projet lié</label>
        <select id="qf_project" onchange="onProjectChange(this.value)"><option value="">Aucun</option>${projectOptions}</select>
      </div>
      <div class="form-group">
        <label>Date</label>
        <input id="qf_date" type="date" value="${q.date || today}">
      </div>
      <div class="form-group">
        <label>Valide jusqu'au</label>
        <input id="qf_valid" type="date" value="${q.validUntil || validUntil}">
      </div>
    </div>
    <div style="margin:0 0 18px;display:flex;gap:20px;align-items:center;padding:10px 14px;background:rgba(240,180,41,0.05);border:1px solid rgba(240,180,41,0.15);border-radius:8px">
      <span style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">Type</span>
      <label style="cursor:pointer;display:flex;align-items:center;gap:6px;font-size:13px">
        <input type="radio" name="qf_type" id="qf_type_standard" value="standard" ${!isFormation ? 'checked' : ''} onchange="toggleFormationType('q','standard')">
        Standard
      </label>
      <label style="cursor:pointer;display:flex;align-items:center;gap:6px;font-size:13px;color:var(--gold);font-weight:600">
        <input type="radio" name="qf_type" id="qf_type_formation" value="formation" ${isFormation ? 'checked' : ''} onchange="toggleFormationType('q','formation')">
        Formation
      </label>
    </div>
    <div id="q_formation_panel" style="display:${isFormation ? 'block' : 'none'};margin:0 0 20px;padding:16px;background:rgba(240,180,41,0.05);border:1px solid rgba(240,180,41,0.25);border-radius:10px">
      <div class="form-group" style="margin-bottom:14px">
        <label>Nom de la formation</label>
        <input id="qf_formation_name" value="${q.formationName || ''}" placeholder="Ex : Formation Gestion E-commerce..." oninput="calcFormationQ()">
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>Frais d'inscription (${cur})</label>
          <input id="qf_inscription" type="number" min="0" value="${q.inscription || 0}" oninput="calcFormationQ()">
        </div>
        <div class="form-group">
          <label>Mensualité — montant/mois (${cur})</label>
          <input id="qf_mensualite" type="number" min="0" value="${q.mensualite || 0}" oninput="calcFormationQ()">
        </div>
        <div class="form-group">
          <label>Nombre de mensualités</label>
          <input id="qf_nb_mois" type="number" min="0" value="${q.nbMois || 1}" oninput="calcFormationQ()">
        </div>
      </div>
      <div id="q_formation_totals" class="totals-box" style="margin-top:12px"></div>
    </div>
    <div id="q_standard_panel" style="display:${isFormation ? 'none' : 'block'};margin:20px 0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <label style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">Prestations</label>
        <button class="btn-admin btn-admin-outline btn-admin-sm" onclick="addQuoteItem()">+ Ajouter une ligne</button>
      </div>
      <div class="table-wrap" style="border:1px solid var(--card-border);border-radius:var(--radius-sm)">
        <table class="items-table">
          <thead><tr><th>Description</th><th>Qté</th><th>Prix unitaire (${cur})</th><th>Total</th><th></th></tr></thead>
          <tbody id="quoteItemsBody"></tbody>
        </table>
      </div>
    </div>
    <div id="q_std_total" class="totals-box" style="display:${isFormation ? 'none' : 'block'}">
      <div class="total-row final"><span>TOTAL</span><span id="q_total">—</span></div>
    </div>
    <div class="form-group" style="margin-top:16px">
      <label>Notes / Conditions de paiement</label>
      <textarea id="qf_notes" rows="3">${q.notes || 'Devis valable 30 jours à compter de la date d\'émission.\nConditions de paiement : 50% à l\'inscription, puis mensualités selon planning.'}</textarea>
    </div>
    <div class="form-actions">
      <button class="btn-admin btn-admin-outline" onclick="closeModal()">Annuler</button>
      <button class="btn-admin btn-admin-primary" onclick="saveQuote('${id || ''}')">
        ${id ? 'Enregistrer' : 'Créer le devis'}
      </button>
    </div>
  `, 'modal-lg');
  setTimeout(() => { renderQuoteItems(); if (isFormation) calcFormationQ(); }, 10);
};

const saveQuote = async (id) => {
  const clientId = document.getElementById('qf_client')?.value;
  const client = state.clients.find(c => c.id === clientId);
  const projectId = document.getElementById('qf_project')?.value;
  const project = state.projects.find(p => p.id === projectId);

  if (!clientId) { toast('Veuillez sélectionner un client', 'error'); return; }

  const isFormation = document.getElementById('qf_type_formation')?.checked;
  let items, total, extraData;

  if (isFormation) {
    const formationName = document.getElementById('qf_formation_name')?.value?.trim() || 'Formation';
    const inscription = parseFloat(document.getElementById('qf_inscription')?.value) || 0;
    const mensualite = parseFloat(document.getElementById('qf_mensualite')?.value) || 0;
    const nbMois = parseInt(document.getElementById('qf_nb_mois')?.value) || 0;
    items = [];
    if (inscription > 0) items.push({ description: `Frais d'inscription — ${formationName}`, quantity: 1, unitPrice: inscription });
    if (mensualite > 0 && nbMois > 0) items.push({ description: `Mensualité — ${formationName}`, quantity: nbMois, unitPrice: mensualite });
    if (!items.length) { toast('Renseignez au moins les frais d\'inscription ou une mensualité', 'error'); return; }
    total = inscription + mensualite * nbMois;
    extraData = { type: 'formation', formationName, inscription, mensualite, nbMois };
  } else {
    if (!quoteItems.length || !quoteItems[0].description) { toast('Ajoutez au moins une prestation', 'error'); return; }
    items = quoteItems;
    total = quoteItems.reduce((s, i) => s + (i.quantity * i.unitPrice), 0);
    extraData = { type: 'standard', formationName: null, inscription: null, mensualite: null, nbMois: null };
  }

  const data = {
    clientId, clientName: client?.name || '',
    projectId: projectId || null, projectName: project?.name || '',
    date: document.getElementById('qf_date')?.value,
    validUntil: document.getElementById('qf_valid')?.value,
    items, taxRate: 0, subtotal: total, taxAmount: 0, total,
    notes: document.getElementById('qf_notes')?.value?.trim(),
    ...extraData
  };
  if (id) {
    const updated = await api.put(`/api/quotes/${id}`, data);
    state.quotes = state.quotes.map(q => q.id === id ? updated : q);
    toast('Devis mis à jour');
  } else {
    const created = await api.post('/api/quotes', data);
    state.quotes.push(created);
    toast('Devis créé');
  }
  closeModal(); updateBadges(); renderPage('quotes');
};

const changeQuoteStatus = async (id) => {
  const q = state.quotes.find(x => x.id === id);
  const statuses = ['draft', 'sent', 'accepted', 'rejected'];
  const nextStatus = statuses[(statuses.indexOf(q.status) + 1) % statuses.length];
  const updated = await api.put(`/api/quotes/${id}`, { status: nextStatus });
  state.quotes = state.quotes.map(x => x.id === id ? updated : x);
  toast(`Statut mis à jour : ${statusLabel[nextStatus]}`);
  renderPage('quotes');
};

const convertToInvoice = async (id) => {
  const ok = await openConfirm('Convertir en facture', 'Un devis accepté sera converti en facture. Cette action est irréversible.');
  if (!ok) return;
  const invoice = await api.post(`/api/quotes/${id}/convert`, {});
  state.invoices.push(invoice);
  state.quotes = state.quotes.map(q => q.id === id ? { ...q, status: 'accepted' } : q);
  updateBadges();
  toast(`Facture ${invoice.number} créée !`, 'success');
  renderPage('invoices');
};

const deleteQuote = async (id) => {
  const ok = await openConfirm('Supprimer le devis', 'Ce devis sera définitivement supprimé.');
  if (!ok) return;
  await api.del(`/api/quotes/${id}`);
  state.quotes = state.quotes.filter(q => q.id !== id);
  updateBadges(); toast('Devis supprimé'); renderPage('quotes');
};

// ===== INVOICES =====
const renderInvoices = (main) => {
  main.innerHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Factures (${state.invoices.length})</span>
        <button class="btn-admin btn-admin-primary" onclick="openInvoiceForm()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nouvelle facture
        </button>
      </div>
      <div class="table-toolbar">
        <input class="search-input" placeholder="Rechercher..." id="invSearch" oninput="filterInvoices()">
        <select class="filter-select" id="invStatusFilter" onchange="filterInvoices()">
          <option value="">Tous les statuts</option>
          <option value="draft">Brouillon</option>
          <option value="sent">Envoyée</option>
          <option value="paid">Payée</option>
          <option value="overdue">En retard</option>
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Numéro</th><th>Client</th><th>Montant TTC</th><th>Date</th><th>Échéance</th><th>Statut</th><th>Actions</th>
          </tr></thead>
          <tbody id="invoicesBody"></tbody>
        </table>
      </div>
    </div>
  `;
  renderInvoicesTable(state.invoices);
};

const renderInvoicesTable = (invoices) => {
  const tbody = document.getElementById('invoicesBody');
  if (!tbody) return;
  const cur = state.settings.company?.currency || 'FCFA';
  if (!invoices.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
      <h3>Aucune facture</h3><p>Les factures apparaissent ici une fois créées ou converties depuis un devis</p>
    </div></td></tr>`;
    return;
  }
  const now = new Date();
  tbody.innerHTML = [...invoices].reverse().map(inv => {
    const isOverdue = inv.status === 'sent' && inv.dueDate && new Date(inv.dueDate) < now;
    const status = isOverdue ? 'overdue' : inv.status;
    return `<tr>
      <td><strong style="color:var(--gold)">${inv.number}</strong></td>
      <td>${inv.clientName || '—'}</td>
      <td><strong>${fmt.currency(inv.total, cur)}</strong>${inv.remiseMontant > 0 ? `<br><span style="font-size:11px;color:var(--danger)">Remise : -${fmt.currency(inv.remiseMontant, cur)}</span>` : ''}${inv.acompte > 0 ? `<br><span style="font-size:11px;color:var(--success)">Acompte : ${fmt.currency(inv.acompte, cur)}</span>` : ''}</td>
      <td style="color:var(--text-muted)">${fmt.date(inv.issueDate)}</td>
      <td style="color:${isOverdue ? 'var(--danger)' : 'var(--text-muted)'}">${fmt.date(inv.dueDate)}${inv.reste > 0 ? `<br><span style="font-size:11px;color:var(--gold)">Reste : ${fmt.currency(inv.reste, cur)}</span>` : ''}</td>
      <td><span class="badge badge-${status}">${statusLabel[status] || status}</span></td>
      <td><div class="table-actions">
        <button class="btn-admin-icon" title="Aperçu" onclick="previewDocument('invoice','${inv.id}')" style="color:var(--gold)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button class="btn-admin-icon" title="Modifier" onclick="openInvoiceForm('${inv.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-admin-icon" title="Télécharger PDF" onclick="downloadInvoicePDF('${inv.id}')" style="color:var(--info)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <button class="btn-admin-icon" title="Envoyer par email" onclick="sendByEmail('invoice','${inv.id}')" style="color:var(--success)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        </button>
        ${inv.status !== 'paid' ? `<button class="btn-admin btn-admin-sm btn-admin-success" onclick="markAsPaid('${inv.id}')">✓ Payée</button>` : ''}
        <button class="btn-admin-icon" title="Supprimer" onclick="deleteInvoice('${inv.id}')" style="color:var(--danger)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div></td>
    </tr>`;
  }).join('');
};

const filterInvoices = () => {
  const q = document.getElementById('invSearch')?.value.toLowerCase() || '';
  const s = document.getElementById('invStatusFilter')?.value || '';
  renderInvoicesTable(state.invoices.filter(x =>
    (!q || x.number?.toLowerCase().includes(q) || x.clientName?.toLowerCase().includes(q)) &&
    (!s || x.status === s)
  ));
};

let invoiceItems = [];
const openInvoiceForm = (id = null) => {
  const inv = id ? state.invoices.find(x => x.id === id) : {};
  invoiceItems = inv.items ? JSON.parse(JSON.stringify(inv.items)) : [{ description: '', quantity: 1, unitPrice: 0 }];
  const cur = state.settings.company?.currency || 'FCFA';
  const today = new Date().toISOString().split('T')[0];
  const due = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  const clientOptions = state.clients.map(c =>
    `<option value="${c.id}" ${inv.clientId === c.id ? 'selected' : ''}>${c.name}</option>`
  ).join('');
  const clientQuotes = inv.clientId ? state.quotes.filter(q => q.clientId === inv.clientId) : [];
  const quoteOptions = clientQuotes.map(q =>
    `<option value="${q.id}" ${inv.quoteId === q.id ? 'selected' : ''}>${q.number} — ${q.projectName || ''} (${fmt.currency(q.total, cur)})</option>`
  ).join('');
  const existingAcompte = inv.acompte || 0;
  const isInvFormation = inv.type === 'formation';
  const invRemiseType  = inv.remiseType || 'none';
  const invRemiseVal   = inv.remiseVal  || 0;

  openModal(id ? `Facture ${inv.number}` : 'Nouvelle facture', `
    <div class="form-grid">
      <div class="form-group">
        <label>Client *</label>
        <select id="if_client" onchange="onClientChangeInvoice()"><option value="">Sélectionner...</option>${clientOptions}</select>
      </div>
      <div class="form-group">
        <label>Statut</label>
        <select id="if_status">
          ${['draft','sent','paid','overdue'].map(s =>
            `<option value="${s}" ${(inv.status||'sent')===s?'selected':''}>${statusLabel[s]}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Date d'émission</label>
        <input id="if_date" type="date" value="${inv.issueDate || today}">
      </div>
      <div class="form-group">
        <label>Date d'échéance</label>
        <input id="if_due" type="date" value="${inv.dueDate || due}">
      </div>
      <div class="form-group form-full">
        <label>Projet</label>
        <input id="if_project" value="${inv.projectName || ''}" placeholder="Nom du projet...">
      </div>
    </div>
    <div style="margin:0 0 18px;display:flex;gap:20px;align-items:center;padding:10px 14px;background:rgba(240,180,41,0.05);border:1px solid rgba(240,180,41,0.15);border-radius:8px">
      <span style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">Type</span>
      <label style="cursor:pointer;display:flex;align-items:center;gap:6px;font-size:13px">
        <input type="radio" name="if_type" id="if_type_standard" value="standard" ${!isInvFormation ? 'checked' : ''} onchange="toggleFormationType('i','standard')">
        Standard
      </label>
      <label style="cursor:pointer;display:flex;align-items:center;gap:6px;font-size:13px;color:var(--gold);font-weight:600">
        <input type="radio" name="if_type" id="if_type_formation" value="formation" ${isInvFormation ? 'checked' : ''} onchange="toggleFormationType('i','formation')">
        Formation
      </label>
    </div>
    <div id="i_formation_panel" style="display:${isInvFormation ? 'block' : 'none'};margin:0 0 20px;padding:16px;background:rgba(240,180,41,0.05);border:1px solid rgba(240,180,41,0.25);border-radius:10px">
      <div class="form-group" style="margin-bottom:14px">
        <label>Nom de la formation</label>
        <input id="if_formation_name" value="${inv.formationName || ''}" placeholder="Ex : Formation Gestion E-commerce..." oninput="calcFormationI()">
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>Frais d'inscription (${cur})</label>
          <input id="if_inscription" type="number" min="0" value="${inv.inscription || 0}" oninput="calcFormationI()">
        </div>
        <div class="form-group">
          <label>Mensualité — montant/mois (${cur})</label>
          <input id="if_mensualite" type="number" min="0" value="${inv.mensualite || 0}" oninput="calcFormationI()">
        </div>
        <div class="form-group">
          <label>Nombre de mensualités</label>
          <input id="if_nb_mois" type="number" min="0" value="${inv.nbMois || 1}" oninput="calcFormationI()">
        </div>
      </div>
      <div id="i_formation_subtotals" class="totals-box" style="margin-top:12px"></div>
    </div>
    <div id="i_standard_panel" style="display:${isInvFormation ? 'none' : 'block'}">
      <div class="form-group" style="margin-bottom:20px;padding:14px 16px;background:rgba(240,180,41,0.05);border:1px solid rgba(240,180,41,0.2);border-radius:10px">
        <label style="color:var(--gold)">Importer depuis un devis client</label>
        <select id="if_quote_source" onchange="loadQuoteItems(this.value)" style="margin-top:6px">
          <option value="">— Sélectionner un devis —</option>
          ${quoteOptions}
        </select>
        <p style="font-size:11px;color:var(--text-muted);margin-top:6px">Les prestations du devis sélectionné remplaceront les lignes ci-dessous automatiquement.</p>
      </div>
      <div style="margin:0 0 20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <label style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">Prestations facturées</label>
          <button class="btn-admin btn-admin-outline btn-admin-sm" onclick="addInvItem()">+ Ajouter</button>
        </div>
        <div class="table-wrap" style="border:1px solid var(--card-border);border-radius:var(--radius-sm)">
          <table class="items-table">
            <thead><tr><th>Description</th><th>Qté</th><th>Prix (${cur})</th><th>Total</th><th></th></tr></thead>
            <tbody id="invItemsBody"></tbody>
          </table>
        </div>
      </div>
    </div>
    <div class="form-group" style="margin-bottom:16px;padding:14px 16px;background:rgba(239,68,68,0.04);border:1px solid rgba(239,68,68,0.12);border-radius:10px">
      <label style="color:var(--danger)">Remise client</label>
      <div style="display:flex;gap:10px;align-items:center;margin-top:8px;flex-wrap:wrap">
        <select id="if_remise_type" onchange="calcInvTotals()" style="flex:none;min-width:170px">
          <option value="none" ${invRemiseType==='none'?'selected':''}>Aucune remise</option>
          <option value="pct"  ${invRemiseType==='pct' ?'selected':''}>Pourcentage (%)</option>
          <option value="fixed"${invRemiseType==='fixed'?'selected':''}>Montant fixe</option>
        </select>
        <input id="if_remise_val" type="number" min="0" value="${invRemiseVal}" placeholder="0" oninput="calcInvTotals()" style="flex:1;min-width:80px;text-align:right;font-size:16px;font-weight:700;background:rgba(239,68,68,0.05);border-color:rgba(239,68,68,0.2)">
        <span id="if_remise_unit" style="font-size:13px;font-weight:700;color:var(--danger);white-space:nowrap">${invRemiseType==='fixed'?cur:'%'}</span>
      </div>
    </div>
    <div class="form-group" style="margin-bottom:16px;padding:14px 16px;background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.2);border-radius:10px">
      <label style="color:var(--success)">Acompte déjà versé (${cur})</label>
      <div style="display:flex;gap:10px;align-items:center;margin-top:8px">
        <input id="if_acompte_montant" type="number" min="0" value="${existingAcompte}" placeholder="0" oninput="calcInvTotals()" style="flex:1;text-align:right;font-size:18px;font-weight:700;background:rgba(16,185,129,0.07);border-color:rgba(16,185,129,0.3)">
        <span style="font-size:14px;font-weight:700;color:var(--success);white-space:nowrap">${cur}</span>
      </div>
    </div>
    <div class="totals-box">
      <div class="total-row" id="i_subtotal_row" style="display:none;color:var(--text-light)"><span>Sous-total</span><span id="i_subtotal">—</span></div>
      <div class="total-row" id="i_remise_row" style="display:none;color:var(--danger)"><span id="i_remise_label">Remise</span><span id="i_remise_display">—</span></div>
      <div class="total-row final"><span>TOTAL</span><span id="i_total">—</span></div>
      <div class="total-row" style="color:var(--success)">
        <span>Acompte versé (<span id="i_taux_label">0</span>%)</span>
        <span id="i_acompte_display">—</span>
      </div>
      <div class="total-row final" style="border-top:2px solid var(--gold);margin-top:6px;padding-top:10px">
        <span>Reste à payer</span>
        <span id="i_reste">—</span>
      </div>
    </div>
    <div class="form-group" style="margin-top:16px">
      <label>Notes / Mode de paiement</label>
      <textarea id="if_notes" rows="3">${inv.notes || 'Paiement à effectuer par virement bancaire ou Mobile Money.\nMerci de votre confiance.'}</textarea>
    </div>
    <div class="form-actions">
      <button class="btn-admin btn-admin-outline" onclick="closeModal()">Annuler</button>
      <button class="btn-admin btn-admin-primary" onclick="saveInvoice('${id || ''}')">
        ${id ? 'Enregistrer' : 'Créer la facture'}
      </button>
    </div>
  `, 'modal-lg');
  setTimeout(() => { renderInvItems(); if (isInvFormation) calcFormationI(); }, 10);
};

const onClientChangeInvoice = () => {
  const clientId = document.getElementById('if_client')?.value;
  const clientQuotes = state.quotes.filter(q => q.clientId === clientId);
  const cur = state.settings.company?.currency || 'FCFA';
  const sel = document.getElementById('if_quote_source');
  if (!sel) return;
  sel.innerHTML = `<option value="">— Sélectionner un devis —</option>` +
    clientQuotes.map(q => `<option value="${q.id}">${q.number} — ${q.projectName || ''} (${fmt.currency(q.total, cur)})</option>`).join('');
};

const loadQuoteItems = (quoteId) => {
  if (!quoteId) return;
  const quote = state.quotes.find(q => q.id === quoteId);
  if (!quote) return;
  const proj = document.getElementById('if_project');
  if (proj && quote.projectName) proj.value = quote.projectName;
  if (quote.type === 'formation') {
    const fmRad = document.getElementById('if_type_formation');
    if (fmRad) { fmRad.checked = true; toggleFormationType('i', 'formation'); }
    const fn = document.getElementById('if_formation_name');
    const ins = document.getElementById('if_inscription');
    const men = document.getElementById('if_mensualite');
    const nb = document.getElementById('if_nb_mois');
    if (fn) fn.value = quote.formationName || '';
    if (ins) ins.value = quote.inscription || 0;
    if (men) men.value = quote.mensualite || 0;
    if (nb) nb.value = quote.nbMois || 1;
    calcFormationI();
  } else {
    invoiceItems = JSON.parse(JSON.stringify(quote.items));
    renderInvItems();
  }
};

const addInvItem = () => { invoiceItems.push({ description: '', quantity: 1, unitPrice: 0 }); renderInvItems(); };
const removeInvItem = (i) => { invoiceItems.splice(i, 1); renderInvItems(); };

const renderInvItems = () => {
  const tbody = document.getElementById('invItemsBody');
  const cur = state.settings.company?.currency || 'FCFA';
  if (!tbody) return;
  tbody.innerHTML = invoiceItems.map((item, i) => `
    <tr>
      <td><input value="${item.description}" placeholder="Description..." oninput="invoiceItems[${i}].description=this.value;calcInvTotals()"></td>
      <td><input type="number" value="${item.quantity}" min="1" style="width:70px;text-align:center" oninput="invoiceItems[${i}].quantity=parseFloat(this.value)||1;calcInvTotals()"></td>
      <td><input type="number" value="${item.unitPrice}" min="0" style="width:120px;text-align:right" oninput="invoiceItems[${i}].unitPrice=parseFloat(this.value)||0;calcInvTotals()"></td>
      <td style="text-align:right;color:var(--gold);font-weight:600">${fmt.currency(item.quantity * item.unitPrice, cur)}</td>
      <td><button class="item-remove-btn" onclick="removeInvItem(${i})">✕</button></td>
    </tr>
  `).join('');
  calcInvTotals();
};


const toggleFormationType = (prefix, type) => {
  const isFormation = type === 'formation';
  const stdPanel = document.getElementById(`${prefix}_standard_panel`);
  const frmPanel = document.getElementById(`${prefix}_formation_panel`);
  const stdTotal = document.getElementById(`${prefix}_std_total`);
  if (stdPanel) stdPanel.style.display = isFormation ? 'none' : 'block';
  if (frmPanel) frmPanel.style.display = isFormation ? 'block' : 'none';
  if (stdTotal) stdTotal.style.display = isFormation ? 'none' : 'block';
  if (isFormation) { if (prefix === 'q') calcFormationQ(); else calcFormationI(); }
  else { if (prefix === 'q') calcTotals(); else calcInvTotals(); }
};

const calcFormationQ = () => {
  const inscription = parseFloat(document.getElementById('qf_inscription')?.value) || 0;
  const mensualite  = parseFloat(document.getElementById('qf_mensualite')?.value)  || 0;
  const nbMois      = parseInt(document.getElementById('qf_nb_mois')?.value)        || 0;
  const total       = inscription + mensualite * nbMois;
  const cur         = state.settings.company?.currency || 'FCFA';
  const el          = document.getElementById('q_formation_totals');
  if (el) el.innerHTML = `
    <div class="total-row"><span>Frais d'inscription</span><span>${fmt.currency(inscription, cur)}</span></div>
    <div class="total-row"><span>Mensualités (${nbMois} × ${fmt.currency(mensualite, cur)})</span><span>${fmt.currency(mensualite * nbMois, cur)}</span></div>
    <div class="total-row final"><span>TOTAL</span><span>${fmt.currency(total, cur)}</span></div>
  `;
};

const calcFormationI = () => {
  const inscription = parseFloat(document.getElementById('if_inscription')?.value) || 0;
  const mensualite  = parseFloat(document.getElementById('if_mensualite')?.value)  || 0;
  const nbMois      = parseInt(document.getElementById('if_nb_mois')?.value)        || 0;
  const total       = inscription + mensualite * nbMois;
  const cur         = state.settings.company?.currency || 'FCFA';
  const subtEl      = document.getElementById('i_formation_subtotals');
  if (subtEl) subtEl.innerHTML = `
    <div class="total-row"><span>Frais d'inscription</span><span>${fmt.currency(inscription, cur)}</span></div>
    <div class="total-row"><span>Mensualités (${nbMois} × ${fmt.currency(mensualite, cur)})</span><span>${fmt.currency(mensualite * nbMois, cur)}</span></div>
  `;
  _updateInvAcompteTotals(total, cur);
};

const calcInvTotals = () => {
  if (document.getElementById('if_type_formation')?.checked) { calcFormationI(); return; }
  const total = invoiceItems.reduce((s, i) => s + (i.quantity * i.unitPrice), 0);
  const cur   = state.settings.company?.currency || 'FCFA';
  _updateInvAcompteTotals(total, cur);
};

const _updateInvAcompteTotals = (subtotal, cur) => {
  const remiseType  = document.getElementById('if_remise_type')?.value || 'none';
  const remiseVal   = parseFloat(document.getElementById('if_remise_val')?.value) || 0;
  let remiseMontant = 0;
  if (remiseType === 'pct')   remiseMontant = Math.round(subtotal * remiseVal / 100);
  if (remiseType === 'fixed') remiseMontant = Math.min(remiseVal, subtotal);
  const total   = Math.max(0, subtotal - remiseMontant);
  const acompte = Math.min(parseFloat(document.getElementById('if_acompte_montant')?.value) || 0, total);
  const taux    = total > 0 ? Math.round(acompte / total * 100) : 0;
  const reste   = Math.max(0, total - acompte);
  const el      = (id) => document.getElementById(id);
  const hasRemise = remiseMontant > 0;
  if (el('i_subtotal_row'))   el('i_subtotal_row').style.display   = hasRemise ? '' : 'none';
  if (el('i_subtotal'))       el('i_subtotal').textContent          = fmt.currency(subtotal, cur);
  if (el('i_remise_row'))     el('i_remise_row').style.display      = hasRemise ? '' : 'none';
  if (el('i_remise_label'))   el('i_remise_label').textContent      = remiseType === 'pct' ? `Remise (${remiseVal}%)` : 'Remise';
  if (el('i_remise_display')) el('i_remise_display').textContent    = hasRemise ? `- ${fmt.currency(remiseMontant, cur)}` : '—';
  if (el('if_remise_unit'))   el('if_remise_unit').textContent      = remiseType === 'fixed' ? cur : '%';
  if (el('i_total'))           el('i_total').textContent            = fmt.currency(total, cur);
  if (el('i_taux_label'))      el('i_taux_label').textContent       = taux;
  if (el('i_acompte_display')) el('i_acompte_display').textContent  = acompte > 0 ? `- ${fmt.currency(acompte, cur)}` : '—';
  if (el('i_reste'))           el('i_reste').textContent            = fmt.currency(reste, cur);
};

const saveInvoice = async (id) => {
  const clientId  = document.getElementById('if_client')?.value;
  const client    = state.clients.find(c => c.id === clientId);
  const quoteId   = document.getElementById('if_quote_source')?.value || undefined;
  if (!clientId) { toast('Veuillez sélectionner un client', 'error'); return; }

  const isFormation = document.getElementById('if_type_formation')?.checked;
  let items, total, extraData;

  if (isFormation) {
    const formationName = document.getElementById('if_formation_name')?.value?.trim() || 'Formation';
    const inscription   = parseFloat(document.getElementById('if_inscription')?.value) || 0;
    const mensualite    = parseFloat(document.getElementById('if_mensualite')?.value)  || 0;
    const nbMois        = parseInt(document.getElementById('if_nb_mois')?.value)        || 0;
    items = [];
    if (inscription > 0) items.push({ description: `Frais d'inscription — ${formationName}`, quantity: 1, unitPrice: inscription });
    if (mensualite > 0 && nbMois > 0) items.push({ description: `Mensualité — ${formationName}`, quantity: nbMois, unitPrice: mensualite });
    if (!items.length) { toast('Renseignez au moins les frais d\'inscription ou une mensualité', 'error'); return; }
    total = inscription + mensualite * nbMois;
    extraData = { type: 'formation', formationName, inscription, mensualite, nbMois };
  } else {
    items = invoiceItems;
    total = invoiceItems.reduce((s, i) => s + (i.quantity * i.unitPrice), 0);
    extraData = { type: 'standard', formationName: null, inscription: null, mensualite: null, nbMois: null };
  }

  const subtotal    = total;
  const remiseType  = document.getElementById('if_remise_type')?.value || 'none';
  const remiseVal   = parseFloat(document.getElementById('if_remise_val')?.value) || 0;
  let remiseMontant = 0;
  if (remiseType === 'pct')   remiseMontant = Math.round(subtotal * remiseVal / 100);
  if (remiseType === 'fixed') remiseMontant = Math.min(remiseVal, subtotal);
  total = Math.max(0, subtotal - remiseMontant);
  const acompte     = Math.min(parseFloat(document.getElementById('if_acompte_montant')?.value) || 0, total);
  const acompteTaux = total > 0 ? Math.round(acompte / total * 100) : 0;
  const reste       = Math.max(0, total - acompte);
  const projectName = document.getElementById('if_project')?.value?.trim() || '';
  const data = {
    clientId, clientName: client?.name || '',
    projectName,
    quoteId,
    status: document.getElementById('if_status')?.value,
    issueDate: document.getElementById('if_date')?.value,
    dueDate: document.getElementById('if_due')?.value,
    items, taxRate: 0, subtotal, taxAmount: 0, total,
    remiseType, remiseVal, remiseMontant,
    acompteTaux, acompte, reste,
    notes: document.getElementById('if_notes')?.value?.trim(),
    ...extraData
  };
  if (id) {
    const updated = await api.put(`/api/invoices/${id}`, data);
    state.invoices = state.invoices.map(i => i.id === id ? updated : i);
    toast('Facture mise à jour');
  } else {
    const created = await api.post('/api/invoices', data);
    state.invoices.push(created);
    toast('Facture créée');
  }
  closeModal(); updateBadges(); renderPage('invoices');
};

const markAsPaid = async (id) => {
  const updated = await api.put(`/api/invoices/${id}`, { status: 'paid' });
  state.invoices = state.invoices.map(i => i.id === id ? updated : i);
  toast('Facture marquée comme payée ✓', 'success');
  renderPage('invoices');
};

const deleteInvoice = async (id) => {
  const ok = await openConfirm('Supprimer la facture', 'Cette facture sera définitivement supprimée.');
  if (!ok) return;
  await api.del(`/api/invoices/${id}`);
  state.invoices = state.invoices.filter(i => i.id !== id);
  updateBadges(); toast('Facture supprimée'); renderPage('invoices');
};

// ===== PDF GENERATION =====

// Draws the AnNissa logo (concentric circles + smile arc + dots) at position cx,cy with radius r
const drawLogoInPDF = (doc, cx, cy, r, goldColor) => {
  const [gr, gg, gb] = goldColor;
  doc.setDrawColor(gr, gg, gb);
  doc.setFillColor(gr, gg, gb);

  // Outer circle
  doc.setLineWidth(0.6);
  doc.circle(cx, cy, r, 'S');
  // Inner circle
  doc.setLineWidth(0.4);
  doc.circle(cx, cy, r * 0.71, 'S');

  // 4 cardinal dots
  const dotR = r * 0.07;
  [[cx, cy - r], [cx, cy + r], [cx - r, cy], [cx + r, cy]].forEach(([x, y]) => {
    doc.circle(x, y, dotR, 'F');
  });

  // Smile arc (approximate with line segments)
  const arcY = cy + r * 0.21;
  const arcR = r * 0.36;
  const steps = 20;
  doc.setLineWidth(0.7);
  for (let i = 0; i < steps; i++) {
    const a1 = Math.PI + (i / steps) * Math.PI;
    const a2 = Math.PI + ((i + 1) / steps) * Math.PI;
    doc.line(
      cx + arcR * Math.cos(a1), arcY + arcR * Math.sin(a1),
      cx + arcR * Math.cos(a2), arcY + arcR * Math.sin(a2)
    );
  }

  // Center dot
  doc.circle(cx, cy + r * 0.28, r * 0.1, 'F');
};

const buildPDF = (doc, data, type = 'quote') => {
  const co = state.settings.company || {};
  const cur = co.currency || 'FCFA';
  const isQuote = type === 'quote';
  const label = isQuote ? 'DEVIS' : 'FACTURE';
  const gold  = [240, 180, 41];
  const navy  = [13, 19, 71];
  const navyMid = [22, 30, 98];
  const white = [255, 255, 255];
  const slate = [136, 150, 196];
  const ink   = [28, 35, 90];
  const pageW = doc.internal.pageSize.width;   // 210
  const pageH = doc.internal.pageSize.height;  // 297

  // ── HEADER full-width navy band ──────────────────────────────────────────
  doc.setFillColor(...navy);
  doc.rect(0, 0, pageW, 52, 'F');

  // Gold left accent strip
  doc.setFillColor(...gold);
  doc.rect(0, 0, 4, 52, 'F');

  // Logo
  drawLogoInPDF(doc, 20, 26, 10, gold);

  // Company name
  doc.setTextColor(...gold);
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.text('AnNissa', 34, 22);
  doc.setTextColor(...white);
  doc.text(' Dev Group', 34 + doc.getTextWidth('AnNissa'), 22);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...slate);
  doc.text('Tech with purpose and dignity', 34, 29);
  const contactLine = [co.address, co.email, co.phone].filter(Boolean).join('  ·  ');
  doc.text(contactLine || 'annissadevgroup.com', 34, 35);
  doc.text(co.website || 'annissadevgroup.com', 34, 41);

  // ── Document type badge (top-right) ──────────────────────────────────────
  const badgeW = 52, badgeH = data.type === 'formation' ? 26 : 20, badgeX = pageW - badgeW - 12, badgeY = 8;
  doc.setFillColor(...gold);
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 3, 3, 'F');
  doc.setTextColor(...navy);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(label, badgeX + badgeW / 2, badgeY + 8, { align: 'center' });
  doc.setFontSize(8);
  doc.text(data.number, badgeX + badgeW / 2, badgeY + 15, { align: 'center' });
  if (data.type === 'formation') {
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text('FORMATION', badgeX + badgeW / 2, badgeY + 22, { align: 'center' });
  }

  // Status pill

  // ── Info cards (client + dates) ───────────────────────────────────────────
  const cardY = 58, cardH = 44;
  const client = state.clients.find(c => c.id === data.clientId);

  // Client card
  doc.setFillColor(245, 246, 253);
  doc.roundedRect(12, cardY, 92, cardH, 3, 3, 'F');
  doc.setDrawColor(230, 232, 248);
  doc.setLineWidth(0.3);
  doc.roundedRect(12, cardY, 92, cardH, 3, 3, 'S');

  doc.setFillColor(...gold);
  doc.roundedRect(12, cardY, 92, 7, 3, 3, 'F');
  doc.rect(12, cardY + 4, 92, 3, 'F');
  doc.setTextColor(...navy);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURÉ À', 16, cardY + 5.5);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...ink);
  doc.text(data.clientName || '—', 16, cardY + 16, { maxWidth: 84 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slate);
  let ly = cardY + 23;
  if (client?.company) { doc.text(client.company, 16, ly); ly += 5.5; }
  if (client?.email)   { doc.text(client.email,   16, ly); ly += 5.5; }
  if (client?.phone)   { doc.text(client.phone,   16, ly); ly += 5.5; }
  if (client?.address) { doc.text(client.address, 16, ly, { maxWidth: 84 }); }

  // Dates card
  doc.setFillColor(245, 246, 253);
  doc.roundedRect(110, cardY, 88, cardH, 3, 3, 'F');
  doc.setDrawColor(230, 232, 248);
  doc.roundedRect(110, cardY, 88, cardH, 3, 3, 'S');

  doc.setFillColor(...navy);
  doc.roundedRect(110, cardY, 88, 7, 3, 3, 'F');
  doc.rect(110, cardY + 4, 88, 3, 'F');
  doc.setTextColor(...gold);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text('DÉTAILS DU DOCUMENT', 114, cardY + 5.5);

  const rows = [
    ['Date', fmt.date(data.date || data.issueDate)],
    isQuote
      ? ['Validité', fmt.date(data.validUntil)]
      : ['Échéance', fmt.date(data.dueDate)],
    ...(data.projectName ? [['Projet :', data.projectName]] : [])
  ];
  doc.setFontSize(8);
  rows.forEach(([k, v], i) => {
    const ry = cardY + 16 + i * 8;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...slate);
    doc.text(k, 114, ry);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...ink);
    doc.text(v, 196, ry, { align: 'right', maxWidth: 76 });
  });

  // ── Items table ───────────────────────────────────────────────────────────
  const items = (data.items || []).map(item => [
    item.description,
    { content: String(item.quantity), styles: { halign: 'center' } },
    { content: fmt.currency(item.unitPrice, cur), styles: { halign: 'right' } },
    { content: fmt.currency(item.quantity * item.unitPrice, cur), styles: { halign: 'right', fontStyle: 'bold' } }
  ]);

  doc.autoTable({
    startY: cardY + cardH + 8,
    head: [['PRESTATION / DESCRIPTION', 'QTE', 'PRIX UNIT.', 'TOTAL']],
    body: items,
    theme: 'plain',
    headStyles: {
      fillColor: navy, textColor: gold,
      fontSize: 7, fontStyle: 'bold', cellPadding: { top: 4, bottom: 4, left: 4, right: 4 }
    },
    bodyStyles: {
      fontSize: 8, textColor: ink,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      lineColor: [235, 237, 250], lineWidth: 0.2
    },
    alternateRowStyles: { fillColor: [247, 248, 254] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 40, halign: 'right' },
      3: { cellWidth: 40, fontStyle: 'bold', halign: 'right' }
    },
    margin: { left: 12, right: 12 },
    didDrawPage: (d) => {
      // repeat gold left strip on extra pages
      doc.setFillColor(...gold);
      doc.rect(0, 0, 4, pageH, 'F');
    }
  });

  // ── Totals block ──────────────────────────────────────────────────────────
  const spaceNeeded = 10 + (data.remiseMontant > 0 ? 16 : 0) + 20 + (data.acompte > 0 ? 12 : 0) + 18;
  let tY = doc.lastAutoTable.finalY + 6;
  if (tY + spaceNeeded > pageH - 18) {
    doc.addPage();
    doc.setFillColor(...gold); doc.rect(0, 0, 4, pageH, 'F');
    tY = 20;
  }
  const tX = 118, tW = 80;

  // Subtle separator line
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.3);
  doc.line(tX, tY, pageW - 12, tY);

  let extraOffset = 0;
  if (data.remiseMontant > 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...slate);
    doc.text('Sous-total', tX + 2, tY + 8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...ink);
    doc.text(fmt.currency(data.subtotal, cur), pageW - 13, tY + 8, { align: 'right' });
    const remLabel = data.remiseType === 'pct' ? `Remise (${data.remiseVal}%)` : 'Remise';
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(220, 38, 38);
    doc.text(remLabel, tX + 2, tY + 15);
    doc.setFont('helvetica', 'bold');
    doc.text(`- ${fmt.currency(data.remiseMontant, cur)}`, pageW - 13, tY + 15, { align: 'right' });
    extraOffset = 16;
  }

  const totalBannerY = tY + 4 + extraOffset;

  // Total banner
  doc.setFillColor(...navy);
  doc.roundedRect(tX, totalBannerY, pageW - 12 - tX, 16, 3, 3, 'F');
  doc.setFillColor(...gold);
  doc.roundedRect(tX, totalBannerY, 3, 16, 1, 1, 'F');
  doc.setTextColor(...gold);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', tX + 7, totalBannerY + 10);
  const totalStr = fmt.currency(data.total, cur);
  const totalFontSize = totalStr.length > 14 ? 9 : 11;
  doc.setFontSize(totalFontSize);
  doc.text(totalStr, pageW - 14, totalBannerY + 10, { align: 'right' });

  // Acompte / Reste à payer
  let afterTotalY = totalBannerY + 20;
  if (data.acompte > 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(16, 185, 129);
    doc.text('Acompte versé', tX + 2, afterTotalY + 4);
    doc.setFont('helvetica', 'bold');
    doc.text(`- ${fmt.currency(data.acompte, cur)}`, pageW - 13, afterTotalY + 4, { align: 'right' });
    afterTotalY += 12;
  }
  if (!isQuote) {
    const resteVal = data.reste ?? Math.max(0, data.total - (data.acompte || 0));
    const resteY = afterTotalY;
    doc.setFillColor(...navy);
    doc.roundedRect(tX, resteY, pageW - 12 - tX, 14, 3, 3, 'F');
    doc.setFillColor(...gold);
    doc.roundedRect(tX, resteY, 3, 14, 1, 1, 'F');
    doc.setTextColor(...gold);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('RESTE À PAYER', tX + 7, resteY + 9);
    doc.setFontSize(10);
    doc.text(fmt.currency(resteVal, cur), pageW - 13, resteY + 9, { align: 'right' });
    afterTotalY = resteY + 18;
  }

  // ── Notes ─────────────────────────────────────────────────────────────────
  if (data.notes) {
    doc.setFontSize(7.5);
    const noteLines = doc.splitTextToSize(data.notes, pageW - 34);
    const boxH = Math.max(26, 12 + noteLines.length * 5);
    let nY = afterTotalY + 4;
    if (nY + boxH + 2 > pageH - 16) {
      doc.addPage();
      doc.setFillColor(...gold); doc.rect(0, 0, 4, pageH, 'F');
      nY = 20;
    }
    doc.setFillColor(248, 249, 254);
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.3);
    doc.roundedRect(12, nY, pageW - 24, boxH, 3, 3, 'F');
    doc.setFillColor(...gold);
    doc.roundedRect(12, nY, 3, boxH, 1, 1, 'F');
    doc.setTextColor(...gold);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTES & CONDITIONS', 19, nY + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(80, 88, 130);
    doc.text(noteLines, 19, nY + 12);
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setFillColor(...navy);
  doc.rect(0, pageH - 16, pageW, 16, 'F');
  doc.setFillColor(...gold);
  doc.rect(0, pageH - 16, 4, 16, 'F');

  // Logo mini in footer
  doc.setDrawColor(...gold);
  doc.setFillColor(...gold);
  doc.setLineWidth(0.4);
  doc.circle(12, pageH - 8, 4, 'S');
  doc.circle(12, pageH - 8, 2.8, 'S');
  doc.circle(12, pageH - 8, 0.5, 'F');

  doc.setTextColor(...slate);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`${co.name || 'AnNissa Dev Group'}  ·  ${co.website || 'annissadevgroup.com'}  ·  ${co.email || ''}  ·  ${co.phone || ''}`, pageW / 2 + 6, pageH - 6, { align: 'center' });

  // Gold right accent strip in footer
  doc.setFillColor(...gold);
  doc.rect(pageW - 4, pageH - 16, 4, 16, 'F');
};

const downloadQuotePDF = (id) => {
  const q = state.quotes.find(x => x.id === id);
  if (!q) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  buildPDF(doc, q, 'quote');
  doc.save(`Devis_${q.number}.pdf`);
  toast('PDF téléchargé !');
};

const downloadInvoicePDF = (id) => {
  const inv = state.invoices.find(x => x.id === id);
  if (!inv) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  buildPDF(doc, inv, 'invoice');
  doc.save(`Facture_${inv.number}.pdf`);
  toast('PDF téléchargé !');
};

// ===== PREVIEW =====
const logoSVG = `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" width="52" height="52">
  <circle cx="30" cy="30" r="28" stroke="#f0b429" stroke-width="2.2"/>
  <circle cx="30" cy="30" r="20" stroke="#f0b429" stroke-width="1.6"/>
  <circle cx="30" cy="36" r="3" fill="#f0b429"/>
  <path d="M20 28 Q30 20 40 28" stroke="#f0b429" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <circle cx="30" cy="8"  r="2.2" fill="#f0b429"/>
  <circle cx="30" cy="52" r="2.2" fill="#f0b429"/>
  <circle cx="8"  cy="30" r="2.2" fill="#f0b429"/>
  <circle cx="52" cy="30" r="2.2" fill="#f0b429"/>
</svg>`;

const previewDocument = (type, id) => {
  const isQuote = type === 'quote';
  const data = isQuote ? state.quotes.find(x => x.id === id) : state.invoices.find(x => x.id === id);
  if (!data) return;
  const co = state.settings.company || {};
  const cur = co.currency || 'FCFA';
  const client = state.clients.find(c => c.id === data.clientId);
  const label = isQuote ? 'DEVIS' : 'FACTURE';
  const dlFn  = isQuote ? `downloadQuotePDF('${id}')` : `downloadInvoicePDF('${id}')`;

  const statusMeta = {
    draft:    { color:'#6b7280', bg:'rgba(107,114,128,.12)', text:'Brouillon' },
    sent:     { color:'#3b82f6', bg:'rgba(59,130,246,.12)',  text:'Envoyé'    },
    accepted: { color:'#10b981', bg:'rgba(16,185,129,.12)',  text:'Accepté'   },
    rejected: { color:'#ef4444', bg:'rgba(239,68,68,.12)',   text:'Refusé'    },
    paid:     { color:'#10b981', bg:'rgba(16,185,129,.12)',  text:'Payé'      },
    overdue:  { color:'#ef4444', bg:'rgba(239,68,68,.12)',   text:'En retard' }
  };
  const sm = statusMeta[data.status] || statusMeta.draft;

  const itemsRows = (data.items || []).map((item, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f7f8fe'}">
      <td style="padding:11px 16px;font-size:12.5px;color:#1c2360;border-bottom:1px solid #eef0f8;line-height:1.4">${item.description}</td>
      <td style="padding:11px 16px;text-align:center;font-size:12.5px;color:#4a5280;border-bottom:1px solid #eef0f8;width:50px">${item.quantity}</td>
      <td style="padding:11px 16px;text-align:right;font-size:12.5px;color:#4a5280;border-bottom:1px solid #eef0f8;white-space:nowrap;width:148px">${fmt.currency(item.unitPrice, cur)}</td>
      <td style="padding:11px 16px;text-align:right;font-size:12.5px;font-weight:700;color:#0d1347;border-bottom:1px solid #eef0f8;white-space:nowrap;width:148px">${fmt.currency(item.quantity * item.unitPrice, cur)}</td>
    </tr>`).join('');

  const clientInfo = client ? [client.company, client.email, client.phone, client.address]
    .filter(Boolean).map(v => `<div>${v}</div>`).join('') : '';

  const dateRows = [
    ['Date', fmt.date(data.date || data.issueDate)],
    isQuote ? ['Validité', fmt.date(data.validUntil)]
            : ['Échéance', fmt.date(data.dueDate)],
    ...(data.projectName ? [['Projet :', data.projectName]] : [])
  ].map(([k,v]) => `
    <div style="padding:5px 0;border-bottom:1px solid #eef0f8;font-size:12px">
      <span style="color:#8896c4;font-weight:500">${k} &nbsp;</span>
      <span style="color:#1c2360;font-weight:700">${v}</span>
    </div>`).join('');

  const html = `
  <div style="font-family:'Inter',sans-serif;background:#e8eaf2;padding:0;border-radius:12px;overflow:hidden">

    <!-- Page blanche simulée -->
    <div style="background:#fff;margin:0;box-shadow:0 8px 40px rgba(13,19,71,.18);border-radius:4px;overflow:hidden">

      <!-- ══ HEADER ══ -->
      <div style="background:#0d1347;position:relative;overflow:hidden">
        <!-- Gold left accent -->
        <div style="position:absolute;left:0;top:0;bottom:0;width:5px;background:#f0b429"></div>
        <!-- Gold right accent -->
        <div style="position:absolute;right:0;top:0;bottom:0;width:5px;background:#f0b429"></div>

        <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:28px 32px 28px 36px;gap:20px">
          <!-- Logo + infos entreprise -->
          <div style="display:flex;align-items:flex-start;gap:16px">
            <div style="flex-shrink:0;margin-top:2px">${logoSVG}</div>
            <div>
              <div style="font-size:22px;font-weight:800;letter-spacing:-.5px;line-height:1">
                <span style="color:#f0b429">AnNissa</span><span style="color:#fff"> Dev Group</span>
              </div>
              <div style="font-size:10px;color:#8896c4;letter-spacing:2px;text-transform:uppercase;margin:4px 0 10px">Tech with purpose and dignity</div>
              <div style="font-size:11px;color:#6872a8;line-height:1.9">
                ${co.address || 'Dakar, Sénégal'}<br>
                ${[co.email, co.phone].filter(Boolean).join('  ·  ') || 'contact@annissadevgroup.com'}<br>
                <span style="color:#8896c4">${co.website || 'annissadevgroup.com'}</span>
              </div>
            </div>
          </div>

          <!-- Badge document -->
          <div style="text-align:right;flex-shrink:0">
            <div style="background:#f0b429;color:#0d1347;font-weight:900;font-size:16px;letter-spacing:3px;padding:9px 22px;border-radius:8px;display:inline-block;margin-bottom:8px">${label}</div>
            ${data.type === 'formation' ? '<div style="background:#0d1347;color:#f0b429;font-weight:800;font-size:10px;letter-spacing:2px;padding:3px 12px;border-radius:5px;border:1px solid #f0b429;display:inline-block;margin-bottom:6px">FORMATION</div><br>' : ''}
            <div style="font-size:20px;font-weight:800;color:#fff">${data.number}</div>
          </div>
        </div>
      </div>

      <!-- ══ INFO CARDS ══ -->
      <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:3px solid #f0b42918">

        <!-- Client -->
        <div style="padding:22px 28px;border-right:1px solid #eef0f8">
          <div style="font-size:9px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;color:#f0b429;background:#0d1347;display:inline-block;padding:3px 10px;border-radius:4px;margin-bottom:12px">Facturé à</div>
          <div style="font-size:15px;font-weight:800;color:#0d1347;margin-bottom:6px">${data.clientName || '—'}</div>
          <div style="font-size:11.5px;color:#6872a8;line-height:1.9">${clientInfo}</div>
        </div>

        <!-- Dates -->
        <div style="padding:22px 28px">
          <div style="font-size:9px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;color:#fff;background:#0d1347;display:inline-block;padding:3px 10px;border-radius:4px;margin-bottom:12px">Détails</div>
          ${dateRows}
        </div>
      </div>

      <!-- ══ ITEMS TABLE ══ -->
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#0d1347">
            <th style="padding:11px 16px;text-align:left;font-size:9.5px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:#f0b429">Prestation / Description</th>
            <th style="padding:11px 16px;text-align:center;font-size:9.5px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:#f0b429;width:50px">Qté</th>
            <th style="padding:11px 16px;text-align:right;font-size:9.5px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:#f0b429;width:148px">P.U. (${cur})</th>
            <th style="padding:11px 16px;text-align:right;font-size:9.5px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:#f0b429;width:148px">Total (${cur})</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>

      <!-- ══ TOTALS ══ -->
      <div style="display:flex;justify-content:flex-end;padding:20px 28px 0">
        <div style="min-width:320px">
          ${data.remiseMontant > 0 ? `
          <div style="display:flex;justify-content:space-between;padding:7px 14px;background:#f7f8fe;border-radius:7px;margin-bottom:4px">
            <span style="font-size:12px;color:#8896c4;font-weight:500">Sous-total</span>
            <span style="font-size:12px;color:#1c2360;font-weight:600">${fmt.currency(data.subtotal, cur)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:7px 14px;background:rgba(239,68,68,0.06);border-radius:7px;border-left:3px solid #ef4444;margin-bottom:6px">
            <span style="font-size:12.5px;color:#ef4444;font-weight:600">${data.remiseType === 'pct' ? `Remise (${data.remiseVal}%)` : 'Remise'}</span>
            <span style="font-size:12.5px;color:#ef4444;font-weight:700">- ${fmt.currency(data.remiseMontant, cur)}</span>
          </div>` : ''}
          <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:#0d1347;border-radius:10px;border-left:4px solid #f0b429">
            <span style="font-size:13px;font-weight:700;color:#c8d0f0;letter-spacing:.5px">TOTAL</span>
            <span style="font-size:18px;font-weight:900;color:#f0b429">${fmt.currency(data.total, cur)}</span>
          </div>
          ${data.acompte > 0 ? `
          <div style="display:flex;justify-content:space-between;padding:8px 14px;margin-top:6px;background:rgba(16,185,129,0.08);border-radius:8px;border-left:3px solid #10b981">
            <span style="font-size:12.5px;color:#10b981;font-weight:600">Acompte versé</span>
            <span style="font-size:12.5px;color:#10b981;font-weight:700">- ${fmt.currency(data.acompte, cur)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;margin-top:4px;background:#161d5e;border-radius:8px;border-left:3px solid #f0b429">
            <span style="font-size:13px;font-weight:800;color:#e8eaf6">RESTE À PAYER</span>
            <span style="font-size:16px;font-weight:900;color:#f0b429">${fmt.currency(data.reste ?? (data.total - data.acompte), cur)}</span>
          </div>` : ''}
        </div>
      </div>

      <!-- ══ NOTES ══ -->
      ${data.notes ? `
      <div style="margin:20px 28px;padding:16px 20px;background:#f7f8fe;border-radius:10px;border-left:4px solid #f0b429">
        <div style="font-size:9px;font-weight:800;letter-spacing:2px;color:#f0b429;text-transform:uppercase;margin-bottom:8px">Notes & Conditions</div>
        <div style="font-size:11.5px;color:#4a5280;line-height:1.9;white-space:pre-line">${data.notes}</div>
      </div>` : '<div style="height:24px"></div>'}

      <!-- ══ FOOTER ══ -->
      <div style="background:#0d1347;padding:13px 28px;display:flex;align-items:center;justify-content:center;gap:16px;border-top:3px solid #f0b429">
        <svg viewBox="0 0 40 40" fill="none" width="24" height="24">
          <circle cx="20" cy="20" r="18" stroke="#f0b429" stroke-width="1.5"/>
          <circle cx="20" cy="20" r="13" stroke="#f0b429" stroke-width="1"/>
          <circle cx="20" cy="24" r="2" fill="#f0b429"/>
          <path d="M13 18Q20 13 27 18" stroke="#f0b429" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        </svg>
        <span style="font-size:11px;color:#6872a8">
          ${co.name || 'AnNissa Dev Group'}&nbsp;·&nbsp;${co.website || 'annissadevgroup.com'}&nbsp;·&nbsp;${co.email || ''}
        </span>
      </div>
    </div>

    <!-- ══ ACTIONS ══ -->
    <div style="display:flex;justify-content:flex-end;gap:12px;padding:20px 4px 4px">
      <button class="btn-admin btn-admin-outline" onclick="closeModal()">Fermer</button>
      <button class="btn-admin btn-admin-outline" onclick="sendByEmail('${type}','${id}');closeModal()" style="color:var(--success);border-color:var(--success)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        Envoyer par email
      </button>
      <button class="btn-admin btn-admin-primary" onclick="${dlFn};closeModal()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Télécharger PDF
      </button>
    </div>
  </div>`;

  openModal(`${label} — ${data.number}`, html, 'modal-preview');
};

// ===== SETTINGS =====
const renderSettings = (main) => {
  const co = state.settings.company || {};
  main.innerHTML = `
    <div style="max-width:700px">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Informations de l'entreprise</span>
        </div>
        <div class="settings-section">
          <h3>Identité</h3>
          <div class="form-grid">
            <div class="form-group">
              <label>Nom de l'entreprise</label>
              <input id="s_name" value="${co.name || 'AnNissa Dev Group'}">
            </div>
            <div class="form-group">
              <label>Site web</label>
              <input id="s_web" value="${co.website || 'annissadevgroup.com'}">
            </div>
            <div class="form-group">
              <label>Email de contact</label>
              <input id="s_email" type="email" value="${co.email || ''}">
            </div>
            <div class="form-group">
              <label>Téléphone</label>
              <input id="s_phone" value="${co.phone || ''}">
            </div>
            <div class="form-group form-full">
              <label>Adresse</label>
              <input id="s_address" value="${co.address || ''}">
            </div>
            <div class="form-group">
              <label>SIRET / Numéro fiscal</label>
              <input id="s_siret" value="${co.siret || ''}">
            </div>
            <div class="form-group">
              <label>Téléphone admin (SMS notifications)</label>
              <input id="s_admin_phone" value="${co.adminPhone || ''}" placeholder="+221XXXXXXXXX">
            </div>
          </div>
        </div>
        <div class="settings-section">
          <h3>Facturation</h3>
          <div class="form-grid">
            <div class="form-group">
              <label>Devise</label>
              <select id="s_currency">
                ${['FCFA','EUR','USD','GBP','XOF'].map(c => `<option value="${c}" ${co.currency===c?'selected':''}>${c}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Préfixe devis</label>
              <input id="s_qprefix" value="${co.quotePrefix || 'DEV'}">
            </div>
            <div class="form-group">
              <label>Préfixe facture</label>
              <input id="s_iprefix" value="${co.invoicePrefix || 'FACT'}">
            </div>
          </div>
        </div>
        <div class="settings-section">
          <h3>Email (Brevo SMTP)</h3>
          <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px">Configurez Brevo pour envoyer les devis et factures par email.</p>
          <div class="form-grid">
            <div class="form-group">
              <label>Email expéditeur (votre compte Brevo)</label>
              <input id="s_smtp_user" type="email" value="${state.settings.smtp?.user || ''}" placeholder="votre@email.com">
            </div>
            <div class="form-group">
              <label>Clé API Brevo</label>
              <input id="s_smtp_pass" type="password" value="${state.settings.smtp?.pass || ''}" placeholder="xkeysib-...">
            </div>
          </div>
          <div style="background:rgba(240,180,41,0.08);border:1px solid rgba(240,180,41,0.3);border-radius:10px;padding:14px 16px;margin-top:12px;font-size:12px;color:var(--text-muted)">
            <strong style="color:var(--gold)">Configuration Brevo :</strong><br>
            1. Connectez-vous sur <strong>app.brevo.com</strong><br>
            2. Profil → <strong>SMTP &amp; API</strong> → onglet <strong>API keys &amp; MCP</strong><br>
            3. Copiez la clé API (commence par <code style="background:rgba(255,255,255,.1);padding:1px 5px;border-radius:4px">xkeysib-</code>)
          </div>
        </div>
        <div class="form-actions">
          <button class="btn-admin btn-admin-primary" onclick="saveSettings()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Enregistrer les paramètres
          </button>
        </div>
      </div>
    </div>
  `;
};

const saveSettings = async () => {
  const data = {
    company: {
      name: document.getElementById('s_name')?.value,
      website: document.getElementById('s_web')?.value,
      email: document.getElementById('s_email')?.value,
      phone: document.getElementById('s_phone')?.value,
      address: document.getElementById('s_address')?.value,
      siret: document.getElementById('s_siret')?.value,
      adminPhone: document.getElementById('s_admin_phone')?.value?.trim(),
      currency: document.getElementById('s_currency')?.value,
      quotePrefix: document.getElementById('s_qprefix')?.value,
      invoicePrefix: document.getElementById('s_iprefix')?.value
    },
    smtp: {
      host: 'smtp-relay.brevo.com',
      port: '587',
      user: document.getElementById('s_smtp_user')?.value?.trim(),
      pass: document.getElementById('s_smtp_pass')?.value?.trim()
    }
  };
  const saved = await api.put('/api/settings', data);
  state.settings = saved;
  toast('Paramètres enregistrés ✓', 'success');
};

const showEmailSuccessPopup = (to, label) => {
  const overlay = document.createElement('div');
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(13,19,71,.7);backdrop-filter:blur(6px);z-index:9999;display:flex;align-items:center;justify-content:center;animation:fadeIn .25s ease`;
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:48px 40px;max-width:420px;width:90%;text-align:center;box-shadow:0 32px 80px rgba(13,19,71,.35);animation:slideUp .3s ease">
      <div style="width:72px;height:72px;background:linear-gradient(135deg,#10b981,#059669);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" width="36" height="36"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h2 style="color:#0d1347;font-size:22px;font-weight:800;margin:0 0 8px">${label} envoyé !</h2>
      <p style="color:#64748b;font-size:14px;margin:0 0 6px">Votre email a bien été transmis à</p>
      <p style="color:#0d1347;font-weight:700;font-size:15px;margin:0 0 32px;background:#f0f4ff;padding:10px 18px;border-radius:8px;display:inline-block">${to}</p>
      <button onclick="this.closest('[data-email-popup]').remove()" style="background:linear-gradient(135deg,#0d1347,#1a2a7a);color:#f0b429;border:none;padding:14px 40px;border-radius:50px;font-size:15px;font-weight:700;cursor:pointer;width:100%;letter-spacing:.5px">Parfait !</button>
    </div>`;
  overlay.setAttribute('data-email-popup', '');
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 6000);
};

const sendByEmail = async (type, id) => {
  const data = type === 'quote'
    ? state.quotes.find(q => q.id === id)
    : state.invoices.find(i => i.id === id);
  if (!data) return;

  const client = state.clients.find(c => c.id === data.clientId);
  const clientEmail = client?.email || '';
  const label = type === 'quote' ? 'Devis' : 'Facture';
  const co = state.settings.company || {};
  const cur = co.currency || 'FCFA';

  // Beau modal de confirmation
  openModal(`Envoyer le ${label.toLowerCase()} par email`, `
    <div style="text-align:center;padding:8px 0 16px">
      <div style="width:56px;height:56px;background:linear-gradient(135deg,#0d1347,#1a2a7a);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
        <svg viewBox="0 0 24 24" fill="none" stroke="#f0b429" stroke-width="2" width="28" height="28"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
      </div>
      <div style="background:#f0f4ff;border-radius:12px;padding:14px 20px;margin-bottom:24px;text-align:left">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
          <span style="color:#64748b">Document</span>
          <span style="color:#0d1347;font-weight:700">${data.number}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
          <span style="color:#64748b">Client</span>
          <span style="color:#0d1347;font-weight:700">${data.clientName}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px">
          <span style="color:#64748b">Montant</span>
          <span style="color:#f0b429;font-weight:800">${fmt.currency(data.total, cur)}</span>
        </div>
      </div>
      <div class="form-group" style="text-align:left">
        <label style="font-weight:700;color:#0d1347">Adresse email du destinataire</label>
        <input id="email_to_input" type="email" value="${clientEmail}" placeholder="exemple@email.com"
          style="width:100%;padding:12px 16px;border-radius:10px;border:2px solid #e2e8f0;font-size:14px;outline:none;transition:border .2s"
          onfocus="this.style.borderColor='#f0b429'" onblur="this.style.borderColor='#e2e8f0'">
      </div>
    </div>
    <div style="display:flex;gap:12px;margin-top:8px">
      <button onclick="closeModal()" style="flex:1;padding:13px;border-radius:10px;border:2px solid #e2e8f0;background:#fff;color:#64748b;font-weight:600;cursor:pointer;font-size:14px">Annuler</button>
      <button onclick="doSendEmail('${type}','${id}')" style="flex:2;padding:13px;border-radius:10px;border:none;background:linear-gradient(135deg,#0d1347,#1a2a7a);color:#f0b429;font-weight:700;cursor:pointer;font-size:14px;letter-spacing:.3px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15" style="vertical-align:middle;margin-right:6px"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        Envoyer maintenant
      </button>
    </div>
  `);
};

const doSendEmail = async (type, id) => {
  const to = document.getElementById('email_to_input')?.value?.trim();
  if (!to) { toast('Veuillez saisir une adresse email', 'error'); return; }

  const data = type === 'quote'
    ? state.quotes.find(q => q.id === id)
    : state.invoices.find(i => i.id === id);
  if (!data) return;

  const label = type === 'quote' ? 'Devis' : 'Facture';

  closeModal();
  toast('Génération du PDF…');

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  buildPDF(doc, data, type);
  const pdfBase64 = doc.output('datauristring');
  const filename = type === 'quote' ? `Devis_${data.number}.pdf` : `Facture_${data.number}.pdf`;

  toast('Envoi en cours…');
  const res = await api.post('/api/send-email', {
    to, pdfBase64, filename,
    ...(type === 'quote' ? { quoteId: id } : { invoiceId: id })
  });

  if (res.error) {
    toast(res.error, 'error');
    return;
  }

  showEmailSuccessPopup(to, label);
  await loadAll();
  renderPage(type === 'quote' ? 'quotes' : 'invoices');
};

// ===== MESSAGES =====
const renderMessages = async (main) => {
  const projectTypes = { web: 'Développement Web', mobile: 'Application Mobile', ai: 'Intelligence Artificielle', consulting: 'Conseil & Expertise', other: 'Autre' };
  const unread = state.messages.filter(m => !m.read).length;

  main.innerHTML = `
    <div class="page-header">
      <div>
        <h2 style="margin:0;font-size:1.4rem;font-weight:700;color:#0d1347">Messages reçus</h2>
        <p style="margin:4px 0 0;color:#64748b;font-size:13px">${state.messages.length} message(s) — ${unread} non lu(s)</p>
      </div>
    </div>
    <div id="msgList"></div>`;

  const list = main.querySelector('#msgList');

  if (state.messages.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:80px 20px;color:#94a3b8">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48" style="opacity:.3;margin-bottom:16px"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <p>Aucun message reçu pour l'instant.</p></div>`;
    return;
  }

  list.innerHTML = state.messages.map(m => `
    <div id="msg-${m.id}" class="msg-card ${m.read ? '' : 'msg-unread'}" onclick="expandMsg('${m.id}')">
      <div class="msg-card-row">
        <div class="msg-content">
          <div class="msg-meta-line">
            ${!m.read ? '<span class="msg-dot"></span>' : ''}
            <strong class="msg-name">${m.name || '—'}</strong>
            <span class="msg-contact">${m.email || ''}</span>
            ${m.phone ? `<span class="msg-contact">· ${m.phone}</span>` : ''}
          </div>
          <div class="msg-type">${projectTypes[m.projectType] || m.projectType || '—'}</div>
          <p class="msg-preview" id="preview-${m.id}">${m.message || ''}</p>
        </div>
        <div class="msg-actions">
          <span class="msg-date">${fmt.date(m.createdAt)}</span>
          <div class="msg-btns">
            ${!m.read ? `<button onclick="event.stopPropagation();markRead('${m.id}')" class="btn-read">Lu</button>` : ''}
            <button onclick="event.stopPropagation();deleteMsg('${m.id}')" class="btn-del">Suppr.</button>
          </div>
        </div>
      </div>
      <div id="body-${m.id}" class="msg-body" style="display:none">
        <p style="margin:0;font-size:13px;color:#334155;line-height:1.7;white-space:pre-wrap">${m.message || ''}</p>
        <a href="mailto:${m.email}?subject=Re: Votre demande ${projectTypes[m.projectType] || ''}" class="btn-reply">Répondre par email →</a>
      </div>
    </div>`).join('');
};

const expandMsg = async (id) => {
  const body = document.getElementById(`body-${id}`);
  const preview = document.getElementById(`preview-${id}`);
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if (preview) preview.style.display = isOpen ? '' : 'none';
  const msg = state.messages.find(m => m.id === id);
  if (msg && !msg.read) await markRead(id);
};

const markRead = async (id) => {
  await api.put(`/api/messages/${id}/read`, {});
  await loadAll();
  renderPage('messages');
};

const deleteMsg = async (id) => {
  await api.del(`/api/messages/${id}`);
  await loadAll();
  renderPage('messages');
};

// ===== SIDEBAR MOBILE =====
const sidebar = document.getElementById('sidebar');
document.getElementById('sidebarOpen')?.addEventListener('click', () => sidebar.classList.add('open'));
document.getElementById('sidebarClose')?.addEventListener('click', () => sidebar.classList.remove('open'));
sidebar?.addEventListener('click', e => {
  if (e.target === sidebar) sidebar.classList.remove('open');
});
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    if (window.innerWidth <= 900) sidebar.classList.remove('open');
  });
});

// ===== LOGOUT =====
const logout = async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.replace('/admin/login');
};

// ===== INIT =====
(async () => {
  const authCheck = await fetch('/api/auth/check').then(r => r.json()).catch(() => ({ authenticated: false }));
  if (!authCheck.authenticated) { window.location.replace('/admin/login'); return; }

  // Add logout button to header
  const actions = document.getElementById('headerActionBtn');
  if (actions) {
    actions.style.display = 'flex';
    actions.style.alignItems = 'center';
    actions.style.gap = '8px';
    actions.style.background = 'rgba(239,68,68,.1)';
    actions.style.border = '1px solid rgba(239,68,68,.3)';
    actions.style.color = '#fca5a5';
    actions.style.padding = '8px 16px';
    actions.style.borderRadius = '10px';
    actions.style.fontSize = '13px';
    actions.style.fontWeight = '600';
    actions.style.cursor = 'pointer';
    actions.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> Déconnexion';
    actions.onclick = logout;
  }

  await loadAll();
  navigate('dashboard');

  // Démarrage sync temps réel
  const v = await fetch('/api/events/version').then(r => r.json()).catch(() => ({ version: '' }));
  syncVersion = v.version;
  setInterval(syncPoll, 3000);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
})();
