/* ============================================================
   FlottiPay Admin — Logique JavaScript
   ============================================================ */

/* ══════════════════════════════════════════════════════════
   1. CONFIGURATION
   ══════════════════════════════════════════════════════════ */

const SB_URL       = 'https://yweojpsawxkwyfwqqttt.supabase.co';
const SB_KEY       = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3ZW9qcHNhd3hrd3lmd3FxdHR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDQ3NDEsImV4cCI6MjA5MjEyMDc0MX0.pGlUyns7b-kT3LHj_-nnqYtYeItcUv-_duTG9gCPzu8';
const ADMIN_EMAIL  = 'frejusglessougbe@gmail.com';
const ADMIN_WA_NUMBER = '22901909293'; // Sans espaces ni tirets

const { createClient } = supabase;
const sb = createClient(SB_URL, SB_KEY);

/** Définition des plans de licence */
const PLANS = [
  { id: 'essai',   icon: '🆓', name: 'Essai',       price: 'Gratuit',  priceN: 0,     days: 0,   feat: "Période d'essai personnalisée", custom: true },
  { id: 'mensuel', icon: '📅', name: 'Mensuel',     price: '1 500 F',  priceN: 1500,  days: 30,  feat: 'Gérants illimités · 30 jours' },
  { id: 'trim',    icon: '📆', name: 'Trimestriel', price: '4 000 F',  priceN: 4000,  days: 90,  feat: 'Gérants illimités · 90 jours', pop: true },
  { id: 'annuel',  icon: '🗓️', name: 'Annuel',      price: '15 000 F', priceN: 15000, days: 365, feat: 'Gérants illimités · 365 jours' },
];

/* ── État global ── */
let currentPlan      = null; // Plan sélectionné dans le Keygen
let genKey           = null; // Clé générée en cours
let curPage          = 0;    // Page active (0–4)
let extendTarget     = null; // Cible de la modale de prolongation
let licSearchQuery   = '';   // Filtre actif sur la page Licences
let ownersSearchQuery = '';  // Filtre actif sur la page Propriétaires


/* ══════════════════════════════════════════════════════════
   2. UTILITAIRES
   ══════════════════════════════════════════════════════════ */

/** Affiche un toast temporaire */
function toast(message, duration = 2400) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}

/** Formate un nombre avec séparateur de milliers (fr-FR) */
function fmt(n) {
  return Number(n || 0).toLocaleString('fr-FR');
}

/** Formate un nombre en abrégé (k, M) */
function fmtK(n) {
  n = Number(n || 0);
  if (n >= 1_000_000) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

/** Retourne le nombre de jours restants avant une date */
function dl(dateStr) {
  return dateStr ? Math.max(0, Math.floor((new Date(dateStr) - new Date()) / 864e5)) : 0;
}

/** Génère un segment aléatoire de 4 caractères alphanumériques majuscules */
function seg() {
  return Math.random().toString(36).substr(2, 4).toUpperCase();
}

/** Copie une clé dans le presse-papier et affiche un toast */
function cpKey(key) {
  try { navigator.clipboard.writeText(key); } catch (e) { /* silencieux */ }
  toast('🔑 Clé copiée : ' + key);
}

/** Ouvre une modale (bottom sheet) */
function openM(id) {
  document.getElementById(id).classList.add('open');
}

/** Ferme une modale */
function closeM(id) {
  document.getElementById(id).classList.remove('open');
}

/* Fermeture des modales au clic sur l'overlay */
document.querySelectorAll('.mover').forEach(m =>
  m.addEventListener('click', function (e) {
    if (e.target === this) closeM(this.id);
  })
);


/* ══════════════════════════════════════════════════════════
   3. AUTHENTIFICATION
   ══════════════════════════════════════════════════════════ */

/** Confirme la déconnexion avant de l'exécuter */
function confirmLogout() {
  if (!confirm('Voulez-vous vraiment vous déconnecter du portail admin ?')) return;
  doLogout();
}

/** Connexion administrateur */
async function doLogin() {
  const email = document.getElementById('lemail').value.trim();
  const pass  = document.getElementById('lpass').value;
  const err   = document.getElementById('lerr');
  const btn   = document.getElementById('lbtn');

  err.style.display = 'none';

  if (email !== ADMIN_EMAIL) {
    err.textContent = 'Accès refusé : compte non autorisé.';
    err.style.display = 'block';
    return;
  }
  if (!pass) {
    err.textContent = 'Mot de passe requis.';
    err.style.display = 'block';
    return;
  }

  btn.textContent = 'Connexion...';
  btn.disabled = true;

  const { error } = await sb.auth.signInWithPassword({ email, password: pass });

  if (error) {
    err.textContent = 'Identifiants incorrects.';
    err.style.display = 'block';
    btn.textContent = 'Accéder au portail →';
    btn.disabled = false;
    return;
  }

  document.getElementById('adminEmail').textContent = email;
  showApp();
}

/** Déconnexion */
async function doLogout() {
  await sb.auth.signOut();
  document.getElementById('app').classList.remove('active');
  document.getElementById('login').classList.add('active');
}

/** Affiche l'application après connexion */
function showApp() {
  document.getElementById('login').classList.remove('active');
  document.getElementById('app').classList.add('active');
  goP(0);
}

/** Vérifie si une session existe déjà au chargement */
async function checkSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (session && session.user.email === ADMIN_EMAIL) {
    document.getElementById('adminEmail').textContent = session.user.email;
    showApp();
  }
}


/* ══════════════════════════════════════════════════════════
   4. NAVIGATION
   ══════════════════════════════════════════════════════════ */

/**
 * Navigue vers une page de l'admin.
 * @param {number} n - Index de la page (0=Tableau, 1=Licences, 2=Keygen, 3=Propriétaires, 4=Recettes)
 */
function goP(n) {
  curPage = n;
  [0, 1, 2, 3, 4].forEach(i =>
    document.getElementById('sn' + i).classList.toggle('active', i === n)
  );
  [pageDash, pageLic, pageKg, pageOwners, pageRev][n]();
}


/* ══════════════════════════════════════════════════════════
   5. PAGE — TABLEAU DE BORD
   ══════════════════════════════════════════════════════════ */

async function pageDash() {
  const mc = document.getElementById('mc');
  mc.innerHTML = '<div class="loader"><div class="spin"></div>Chargement...</div>';

  const [{ data: dash }, { data: licsAll }] = await Promise.all([
    sb.from('admin_dashboard').select('*'),
    sb.from('licenses').select('*').neq('status', 'pending'),
  ]);

  const rows = dash || [];
  const lics  = licsAll || [];

  // Totaux transactions
  const totalTx   = rows.reduce((a, r) => a + Number(r.total_tx   || 0), 0);
  const totalAmt  = rows.reduce((a, r) => a + Number(r.total_amount || 0), 0);
  const totalComm = rows.reduce((a, r) => a + Number(r.total_commission || 0), 0);

  // Recettes licences (correspondance insensible à la casse)
  const totalRev = lics.reduce((a, l) => {
    const p = PLANS.find(x => x.name.toLowerCase() === (l.plan || '').toLowerCase());
    return a + (p && p.priceN ? p.priceN : 0);
  }, 0);

  const active  = lics.filter(l => l.status === 'active').length;
  const expSoon = rows.filter(r => r.license_status === 'active' && dl(r.end_date) <= 7 && dl(r.end_date) > 0);

  // Comptage par plan
  const pc = { Mensuel: 0, Trimestriel: 0, Annuel: 0 };
  lics.forEach(l => {
    const p = PLANS.find(x => x.name.toLowerCase() === (l.plan || '').toLowerCase());
    if (p && pc[p.name] !== undefined) pc[p.name]++;
  });

  mc.innerHTML = `
  <div class="pt">Tableau de bord</div>
  <div class="ps">${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>

  <div class="sg4">
    <div class="sc"><div class="slbl">Licences actives</div><div class="sval" style="color:var(--accent);">${active}</div><div class="sdelta">${rows.length} propriétaires</div></div>
    <div class="sc"><div class="slbl">Transactions totales</div><div class="sval" style="color:var(--accent2);">${fmt(totalTx)}</div><div class="sdelta">toutes cabines</div></div>
    <div class="sc"><div class="slbl">Volume total transité</div><div class="sval" style="color:var(--yellow);font-size:16px;">${fmtK(totalAmt)} F</div><div class="sdelta up">↑ cumulé</div></div>
    <div class="sc"><div class="slbl">Commissions totales</div><div class="sval" style="color:var(--accent);font-size:16px;">${fmtK(totalComm)} F</div><div class="sdelta up">↑ cumulé</div></div>
  </div>

  <div class="sg2">
    <div class="card">
      <div class="sh"><div class="st">Répartition plans</div></div>
      ${PLANS.map(p => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border);">
          <div style="display:flex;align-items:center;gap:8px;">
            <span>${p.icon}</span>
            <div>
              <div style="font-size:12px;font-weight:700;">${p.name}</div>
              <div style="font-size:10px;color:var(--muted2);">${p.price}/période</div>
            </div>
          </div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:19px;font-weight:700;color:var(--purple);">${pc[p.name] || 0}</div>
        </div>
      `).join('')}
      <div style="padding-top:10px;display:flex;justify-content:space-between;">
        <div style="font-size:11px;color:var(--muted2);">Recettes admin totales</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:var(--yellow);">${fmtK(totalRev)} F</div>
      </div>
    </div>

    <div class="card">
      <div class="sh"><div class="st">⚠️ Expirations ≤ 7 jours</div></div>
      ${expSoon.length === 0
        ? '<div style="text-align:center;padding:20px;color:var(--muted2);font-size:12px;">✅ Aucune expiration imminente</div>'
        : expSoon.map(r => `
          <div class="li">
            <div class="liico" style="background:rgba(255,201,77,.1);">⚠️</div>
            <div class="libody">
              <div class="lititle">${r.owner_name}</div>
              <div class="lisub">${r.plan} · ${dl(r.end_date)} j restants</div>
            </div>
            <span class="pill py">${dl(r.end_date)}j</span>
          </div>
        `).join('')
      }
    </div>
  </div>

  <div class="card">
    <div class="sh"><div class="st">Activité du jour — toutes cabines</div></div>
    <div class="sg4" style="margin-bottom:0;">
      ${rows.slice(0, 4).map(r => `
        <div class="sc">
          <div class="slbl" style="font-size:9px;">${r.owner_name}</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:700;color:var(--accent);">${fmt(r.tx_today || 0)} tx</div>
          <div class="sdelta">${fmtK(r.amount_today || 0)} F</div>
        </div>
      `).join('')}
    </div>
  </div>`;
}


/* ══════════════════════════════════════════════════════════
   6. PAGE — GESTION DES LICENCES
   ══════════════════════════════════════════════════════════ */

async function pageLic() {
  licSearchQuery = '';
  await renderLicTable('');
}

/** Affiche le tableau des licences avec filtre optionnel */
async function renderLicTable(query) {
  const mc = document.getElementById('mc');
  mc.innerHTML = '<div class="loader"><div class="spin"></div>Chargement...</div>';

  const { data: rows } = await sb.from('admin_dashboard').select('*').order('registered_at', { ascending: false });
  let filtered = rows || [];

  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(r =>
      r.owner_name?.toLowerCase().includes(q) ||
      r.license_key?.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q) ||
      r.plan?.toLowerCase().includes(q)
    );
  }

  mc.innerHTML = `
  <div class="pt">Gestion des licences</div>
  <div class="ps">${(rows || []).length} propriétaires enregistrés</div>

  <div class="search-row">
    <input class="search-inp" type="text" id="licSearch" placeholder="Rechercher par nom, clé, email, plan..." value="${query}">
    <button class="search-btn" onclick="runLicSearch()">🔍 Rechercher</button>
  </div>

  <div class="card">
    <div class="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>Propriétaire</th><th>Clé de licence</th><th>Plan</th>
            <th>Statut</th><th>Expiration</th><th>Gérants</th>
            <th>Tx totales</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(r => {
            const d = dl(r.end_date);
            const pill = r.license_status === 'active'
              ? d <= 7 ? `<span class="pill py">${d}j</span>` : '<span class="pill pg">Actif</span>'
              : r.license_status === 'revoked'
                ? '<span class="pill po">Révoqué</span>'
                : '<span class="pill pr">Expiré</span>';
            const isRevoked = r.license_status === 'revoked';
            return `<tr>
              <td>
                <div style="font-size:12px;font-weight:700;">${r.owner_name}</div>
                <div style="font-size:10px;color:var(--muted2);">${r.email || ''} · ${r.phone || ''}</div>
              </td>
              <td><div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--purple);">${r.license_key || '—'}</div></td>
              <td>${r.plan || '—'}</td>
              <td>${pill}</td>
              <td><div style="font-size:11px;">${r.end_date ? new Date(r.end_date).toLocaleDateString('fr-FR') : '—'}</div></td>
              <td><div style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;">${r.active_managers || 0}/${r.total_managers || 0}</div></td>
              <td>
                <div style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:var(--accent2);">${fmt(r.total_tx || 0)}</div>
                <div style="font-size:9px;color:var(--muted2);">${fmtK(r.total_amount || 0)} F</div>
              </td>
              <td style="white-space:nowrap;">
                <button class="action-btn" style="background:rgba(176,159,255,.1);color:var(--purple);border:1px solid rgba(176,159,255,.2);" onclick="cpKey('${r.license_key || ''}')">📋 Copier</button>
                <button class="action-btn btny" onclick="openExtend('${r.license_key}','${r.owner_name}','${r.end_date || ''}')">📅 Prolonger</button>
                ${r.license_status === 'active' ? `<button class="action-btn btnr" onclick="revokeLic('${r.license_key}','${r.owner_name}')">🚫 Révoquer</button>` : ''}
                ${isRevoked ? `<button class="action-btn btnr" onclick="deleteLicense('${r.license_key}','${r.owner_name}')">🗑️ Suppr. clé</button>` : ''}
                <button class="action-btn btnr" onclick="deleteOwner('${r.owner_id}','${r.owner_name}')">🗑️ Tout supprimer</button>
              </td>
            </tr>`;
          }).join('')}
          ${filtered.length === 0
            ? `<tr><td colspan="8" style="text-align:center;padding:22px;color:var(--muted2);">Aucun résultat${query ? ' pour "' + query + '"' : ''}</td></tr>`
            : ''
          }
        </tbody>
      </table>
    </div>
  </div>`;

  const el = document.getElementById('licSearch');
  if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') runLicSearch(); });
}

/** Lance la recherche depuis le champ licSearch */
function runLicSearch() {
  const q = document.getElementById('licSearch')?.value?.trim() || '';
  licSearchQuery = q;
  renderLicTable(q);
}


/* ══════════════════════════════════════════════════════════
   7. PROLONGATION DE LICENCE
   ══════════════════════════════════════════════════════════ */

/** Ouvre la modale de prolongation pour une licence */
function openExtend(key, ownerName, currentEndDate) {
  extendTarget = { key, ownerName, currentEndDate };

  document.getElementById('extOwnerName').textContent = ownerName;
  document.getElementById('extKey').textContent = key;

  const isExpired = !currentEndDate || new Date(currentEndDate) <= new Date();
  document.getElementById('extCurrentDate').textContent = currentEndDate
    ? new Date(currentEndDate).toLocaleDateString('fr-FR') + (isExpired ? ' (expirée)' : '')
    : 'Non définie';

  document.getElementById('extDays').value = '30';
  document.getElementById('extPreview').style.display = 'none';

  // Prévisualisation dynamique de la nouvelle date
  document.getElementById('extDays').oninput = function () {
    const days = parseInt(this.value) || 0;
    if (days > 0) {
      const base = currentEndDate && new Date(currentEndDate) > new Date()
        ? new Date(currentEndDate)
        : new Date();
      base.setDate(base.getDate() + days);
      document.getElementById('extNewDate').textContent = base.toLocaleDateString('fr-FR');
      document.getElementById('extPreview').style.display = 'block';
    } else {
      document.getElementById('extPreview').style.display = 'none';
    }
  };

  openM('extendM');
}

/** Valide et enregistre la prolongation */
async function confirmExtend() {
  if (!extendTarget) return;

  const days = parseInt(document.getElementById('extDays')?.value) || 0;
  if (days < 1) { toast('⚠️ Entrez un nombre de jours valide'); return; }

  const { key, ownerName, currentEndDate } = extendTarget;
  const base = currentEndDate && new Date(currentEndDate) > new Date()
    ? new Date(currentEndDate)
    : new Date();
  base.setDate(base.getDate() + days);
  const newEndDate = base.toISOString().slice(0, 10);

  const { error } = await sb.from('licenses').update({ end_date: newEndDate, status: 'active' }).eq('key', key);
  if (error) { toast('❌ Erreur : ' + error.message); return; }

  toast(`✅ Licence de ${ownerName} prolongée jusqu'au ${base.toLocaleDateString('fr-FR')}`);
  closeM('extendM');
  renderLicTable(licSearchQuery);
}

/** Révoque une licence (bloque l'accès immédiatement) */
async function revokeLic(key, name) {
  if (!key || !confirm(`Révoquer la licence de ${name} ?\n\nCela bloquera immédiatement l'accès au propriétaire et à tous ses gérants.`)) return;

  const { error } = await sb.from('licenses').update({ status: 'revoked' }).eq('key', key);
  if (error) { toast('❌ Erreur : ' + error.message); return; }

  toast(`🚫 Licence de ${name} révoquée.`);
  renderLicTable(licSearchQuery);
}

/** Supprime définitivement une clé révoquée */
async function deleteLicense(key, ownerName) {
  if (!key) return;
  if (!confirm(`Supprimer définitivement la clé révoquée ?\n\nClé : ${key}\nPropriétaire : ${ownerName}\n\n⚠️ Action IRRÉVERSIBLE.`)) return;

  const { error } = await sb.from('licenses').delete().eq('key', key);
  if (error) { toast('❌ Erreur : ' + error.message); return; }

  toast(`🗑️ Clé ${key} supprimée définitivement.`);
  renderLicTable(licSearchQuery);
}

/** Supprime complètement un propriétaire et toutes ses données (cascade) */
async function deleteOwner(ownerId, name) {
  if (!ownerId) return;
  if (!confirm(`⚠️ SUPPRIMER DÉFINITIVEMENT "${name}" ?\n\nCela supprimera TOUTES ses données :\n• Compte propriétaire\n• Tous ses gérants et leurs comptes\n• Toutes les transactions\n• Tous les réseaux\n• Toutes les notifications\n• Sa clé de licence\n\n❌ Action IRRÉVERSIBLE.`)) return;

  const { data: mgrs } = await sb.from('managers').select('id').eq('owner_id', ownerId);
  const mgrIds = (mgrs || []).map(m => m.id);

  // Suppression en cascade
  await sb.from('transactions').delete().eq('owner_id', ownerId);
  await sb.from('deletion_requests').delete().eq('owner_id', ownerId);
  await sb.from('manager_requests').delete().eq('owner_id', ownerId);

  for (const mid of mgrIds) {
    await sb.from('notifications').delete().eq('user_id', mid);
    await sb.from('manager_networks').delete().eq('manager_id', mid);
  }

  await sb.from('notifications').delete().eq('user_id', ownerId);
  await sb.from('networks').delete().eq('owner_id', ownerId);
  await sb.from('managers').delete().eq('owner_id', ownerId);
  await sb.from('licenses').update({ status: 'revoked', owner_id: null }).eq('owner_id', ownerId);

  const { error } = await sb.from('owners').delete().eq('id', ownerId);
  if (error) { toast('❌ Erreur : ' + error.message); return; }

  toast(`✅ ${name} et toutes ses données ont été supprimés.`);
  renderLicTable(licSearchQuery);
}


/* ══════════════════════════════════════════════════════════
   8. PAGE — GÉNÉRATEUR DE LICENCES (KEYGEN)
   ══════════════════════════════════════════════════════════ */

function pageKg() {
  const mc = document.getElementById('mc');
  mc.innerHTML = `
  <div class="pt">Générateur de licences</div>
  <div class="ps">Créez et attribuez des clés de licence uniques à chaque propriétaire</div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">

    <!-- Colonne gauche : formulaire -->
    <div>
      <div class="card">
        <div class="sh"><div class="st">1. Infos propriétaire</div></div>
        <div style="margin-bottom:11px;"><label class="lbl">Nom complet</label><input class="fi2" type="text" id="kgName" placeholder="Prénom Nom"></div>
        <div style="margin-bottom:11px;"><label class="lbl">Téléphone WhatsApp</label><input class="fi2" type="tel" id="kgPhone" placeholder="+229 01 90 92 93 94"></div>
        <div><label class="lbl">Email (optionnel)</label><input class="fi2" type="email" id="kgEmail" placeholder="proprietaire@email.com"></div>
      </div>

      <div class="card">
        <div class="sh"><div class="st">2. Plan de licence</div></div>
        <div class="plan-grid" style="grid-template-columns:repeat(4,1fr);">
          ${PLANS.map(p => `
            <div class="pcard ${p.pop ? 'pop' : ''}" onclick="selectPlan(this,'${p.id}')" data-pid="${p.id}">
              <div class="pname">${p.icon} ${p.name}</div>
              <div class="pprice">${p.price}</div>
              <div class="pfeat">${p.feat}</div>
              ${p.pop    ? '<div style="margin-top:5px;"><span class="pill pg" style="font-size:9px;">⭐ Populaire</span></div>' : ''}
              ${p.custom ? '<div style="margin-top:5px;"><span class="pill pp" style="font-size:9px;">✏️ Jours libres</span></div>' : ''}
            </div>
          `).join('')}
        </div>
        <div id="trialDaysWrap" style="display:none;margin-bottom:11px;">
          <label class="lbl">Nombre de jours d'essai</label>
          <input class="fi2" type="number" id="trialDays" placeholder="Ex: 7" min="1" max="365" value="7">
        </div>
      </div>
    </div>

    <!-- Colonne droite : génération + clés récentes -->
    <div>
      <div class="card">
        <div class="sh"><div class="st">3. Générer &amp; Envoyer</div></div>
        <div class="kgvis">
          <div style="font-size:11px;color:var(--muted2);" id="kgHint">Remplissez le formulaire et générez la clé</div>
          <div class="kgkey" id="kgKeyVal">FP-????-????-????</div>
          <div style="font-size:10px;color:var(--muted);" id="kgMeta">—</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:10px;">
          <button class="btn btnb" style="width:100%;" onclick="doGen()">⚡ Générer</button>
          <button class="btn btng" style="width:100%;opacity:.4;" id="savBtn" onclick="doSave()" disabled>✅ Enregistrer</button>
        </div>
        <button class="btn btnw" style="width:100%;padding:12px;opacity:.4;" id="waBtn" onclick="doWA()" disabled>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" style="margin-right:6px;vertical-align:middle;">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.112 1.524 5.84L0 24l6.335-1.498A11.946 11.946 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.64-.497-5.153-1.367l-.369-.218-3.762.889.944-3.662-.24-.381A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
          </svg>
          Envoyer par WhatsApp
        </button>
      </div>

      <div class="card">
        <div class="sh"><div class="st">Clés récentes</div></div>
        <div id="recentKeys"><div style="text-align:center;padding:14px;color:var(--muted2);font-size:12px;">Chargement...</div></div>
      </div>
    </div>

  </div>`;

  loadRecent();
}

/** Charge les 6 dernières clés générées */
async function loadRecent() {
  const { data } = await sb.from('licenses').select('key,plan,status,created_at').order('created_at', { ascending: false }).limit(6);
  const el = document.getElementById('recentKeys');
  if (!el) return;

  if (!data || !data.length) {
    el.innerHTML = '<div style="text-align:center;padding:14px;color:var(--muted2);font-size:12px;">Aucune clé générée</div>';
    return;
  }

  el.innerHTML = data.map(l => `
    <div class="li">
      <div class="liico" style="background:rgba(176,159,255,.09);">🔑</div>
      <div class="libody">
        <div class="lititle" style="font-family:'JetBrains Mono',monospace;font-size:11px;">${l.key}</div>
        <div class="lisub">${l.plan} · <span class="${l.status === 'active' ? 'pg' : l.status === 'pending' ? 'pp' : 'pr'} pill">${l.status}</span></div>
      </div>
      <button class="action-btn" style="background:rgba(176,159,255,.1);color:var(--purple);border:1px solid rgba(176,159,255,.2);" onclick="cpKey('${l.key}')">Copier</button>
    </div>
  `).join('');
}

/** Sélectionne un plan dans le Keygen */
function selectPlan(el, pid) {
  document.querySelectorAll('[data-pid]').forEach(e => e.classList.remove('sel'));
  el.classList.add('sel');
  currentPlan = PLANS.find(p => p.id === pid);
  const wrap = document.getElementById('trialDaysWrap');
  if (wrap) wrap.style.display = currentPlan?.custom ? 'block' : 'none';
}

/** Génère une nouvelle clé aléatoire */
function doGen() {
  const p = currentPlan;
  if (!p) { toast('⚠️ Sélectionnez un plan'); return; }

  const name = document.getElementById('kgName').value.trim();
  if (!name) { toast('⚠️ Entrez le nom du propriétaire'); return; }

  let days = p.days;
  if (p.custom) {
    days = parseInt(document.getElementById('trialDays')?.value) || 0;
    if (days < 1) { toast('⚠️ Entrez un nombre de jours valide'); return; }
  }

  genKey = `FP-${seg()}-${seg()}-${seg()}`;
  document.getElementById('kgKeyVal').textContent = genKey;
  document.getElementById('kgHint').textContent   = 'Clé générée — enregistrez-la puis envoyez-la';
  document.getElementById('kgMeta').textContent   = `${p.name} · ${days} jours · ${p.price}`;
  currentPlan = { ...p, days };

  ['savBtn', 'waBtn'].forEach(id => {
    const b = document.getElementById(id);
    b.disabled = false;
    b.style.opacity = '1';
  });

  toast('⚡ Clé générée !');
}

/** Enregistre la clé générée dans Supabase */
async function doSave() {
  const p = currentPlan;
  if (!genKey || !p) { toast("⚠️ Générez d'abord une clé"); return; }

  const { data: { session } } = await sb.auth.getSession();
  if (!session) { toast('❌ Session expirée, reconnectez-vous.'); return; }

  const end = new Date();
  end.setDate(end.getDate() + p.days);

  const { data: existing } = await sb.from('licenses').select('key').eq('key', genKey);
  if (existing && existing.length > 0) { toast('⚠️ Clé déjà existante — régénérez-en une'); return; }

  const { error } = await sb.from('licenses').insert({
    key:      genKey,
    plan:     p.name,
    days:     p.days,
    status:   'pending',
    end_date: end.toISOString().slice(0, 10),
  }).select();

  if (error) {
    toast('❌ ' + (error.code === '42501' ? 'Permission refusée — vérifiez les RLS Supabase' : error.message));
    return;
  }

  toast('✅ Licence enregistrée ! Clé : ' + genKey);
  loadRecent();
  document.getElementById('savBtn').disabled = true;
  document.getElementById('savBtn').style.opacity = '.4';
}

/** Ouvre WhatsApp avec le message de livraison de la clé */
function doWA() {
  if (!genKey) return;
  const name  = document.getElementById('kgName').value.trim();
  const phone = document.getElementById('kgPhone').value.trim().replace(/\s+/g, '');
  const p     = currentPlan;
  const msg   = encodeURIComponent(
    `Bonjour ${name} 👋\n\nVotre licence FlottiPay est prête !\n\n🔑 *Clé de licence :*\n${genKey}\n\n📦 Plan : ${p?.name || '—'} (${p?.days || 0} jours)\n♾️ Gérants illimités inclus\n\n🌐 Créez votre compte ici :\n👉 https://TON-SITE.netlify.app/flottipay-app.html\n\n⚠️ Cette clé est personnelle et ne peut être utilisée qu'une seule fois.\n\n_— FlottiPay, gestion de cabines mobile money_`
  );
  window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
}


/* ══════════════════════════════════════════════════════════
   9. PAGE — PROPRIÉTAIRES
   ══════════════════════════════════════════════════════════ */

async function pageOwners() {
  ownersSearchQuery = '';
  await renderOwnersTable('');
}

/** Affiche les fiches propriétaires avec filtre optionnel */
async function renderOwnersTable(query) {
  const mc = document.getElementById('mc');
  mc.innerHTML = '<div class="loader"><div class="spin"></div>Chargement...</div>';

  const { data: rows } = await sb.from('admin_dashboard').select('*').order('registered_at', { ascending: false });
  let filtered = rows || [];

  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(r =>
      r.owner_name?.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q) ||
      r.phone?.toLowerCase().includes(q) ||
      r.username?.toLowerCase().includes(q)
    );
  }

  mc.innerHTML = `
  <div class="pt">Propriétaires</div>
  <div class="ps">${(rows || []).length} propriétaire(s) enregistré(s)</div>

  <div class="search-row">
    <input class="search-inp" type="text" id="ownSearch" placeholder="Rechercher par nom, email, téléphone..." value="${query}">
    <button class="search-btn" onclick="runOwnersSearch()">🔍 Rechercher</button>
  </div>

  ${filtered.map(r => `
  <div class="card" style="margin-bottom:12px;">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;">
      <div>
        <div style="font-family:'Syne',sans-serif;font-size:15px;font-weight:800;">${r.owner_name}</div>
        <div style="font-size:11px;color:var(--muted2);margin-top:3px;">@${r.username || '—'} · ${r.phone || '—'} · ${r.email || '—'}</div>
        <div style="font-size:11px;color:var(--muted2);">Cabine : <strong>${r.cabin_name || '—'}</strong> · Code : <span style="font-family:'JetBrains Mono',monospace;color:var(--accent2);">${r.invite_code || '—'}</span></div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px;">Inscrit le ${r.registered_at ? new Date(r.registered_at).toLocaleDateString('fr-FR') : '—'}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end;">
        <button class="btn btny" style="padding:7px 12px;font-size:11px;" onclick="openExtend('${r.license_key}','${r.owner_name}','${r.end_date || ''}')">📅 Prolonger</button>
        ${r.license_status === 'active' ? `<button class="btn btnr" style="padding:7px 12px;font-size:11px;" onclick="revokeLic('${r.license_key}','${r.owner_name}')">🚫 Révoquer</button>` : ''}
        <button class="btn btnr" style="padding:7px 12px;font-size:11px;" onclick="deleteOwner('${r.owner_id}','${r.owner_name}')">🗑️ Supprimer</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;">
      <div class="sc">
        <div class="slbl">Licence</div>
        <div style="margin-top:3px;">
          ${r.license_status === 'active'  ? '<span class="pill pg">Actif</span>'    : ''}
          ${r.license_status === 'revoked' ? '<span class="pill po">Révoqué</span>'  : ''}
          ${r.license_status !== 'active' && r.license_status !== 'revoked' ? '<span class="pill pr">Expiré</span>' : ''}
        </div>
        <div style="font-size:10px;color:var(--muted2);margin-top:3px;">${r.end_date ? new Date(r.end_date).toLocaleDateString('fr-FR') : '—'}</div>
      </div>
      <div class="sc"><div class="slbl">Gérants</div><div class="sval" style="color:var(--purple);">${r.active_managers || 0}</div><div class="sdelta">${r.total_managers || 0} total</div></div>
      <div class="sc"><div class="slbl">Tx totales</div><div class="sval" style="color:var(--accent2);">${fmt(r.total_tx || 0)}</div></div>
      <div class="sc"><div class="slbl">Volume transité</div><div class="sval" style="color:var(--yellow);font-size:14px;">${fmtK(r.total_amount || 0)} F</div></div>
      <div class="sc"><div class="slbl">Commissions</div><div class="sval" style="color:var(--accent);font-size:14px;">${fmtK(r.total_commission || 0)} F</div></div>
    </div>

    <div style="margin-top:10px;">
      <div style="font-size:10px;color:var(--muted2);margin-bottom:4px;">Clé de licence</div>
      <div class="keybox">
        <div class="keytext">${r.license_key || '—'}</div>
        <div class="keycopy" onclick="cpKey('${r.license_key || ''}')">Copier</div>
      </div>
    </div>
  </div>
  `).join('') || '<div style="text-align:center;padding:30px;color:var(--muted2);">Aucun résultat</div>'}`;

  const el = document.getElementById('ownSearch');
  if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') runOwnersSearch(); });
}

/** Lance la recherche depuis le champ ownSearch */
function runOwnersSearch() {
  const q = document.getElementById('ownSearch')?.value?.trim() || '';
  ownersSearchQuery = q;
  renderOwnersTable(q);
}


/* ══════════════════════════════════════════════════════════
   10. PAGE — RECETTES & STATISTIQUES
   ══════════════════════════════════════════════════════════ */

async function pageRev() {
  const mc = document.getElementById('mc');
  mc.innerHTML = '<div class="loader"><div class="spin"></div>Chargement...</div>';

  const [{ data: licsRev }, { data: dash }] = await Promise.all([
    sb.from('licenses').select('plan,status,created_at').neq('status', 'pending'),
    sb.from('admin_dashboard').select('total_tx,total_amount,total_commission,tx_today,amount_today'),
  ]);

  const lics = licsRev || [];

  // Calcul des recettes par plan (insensible à la casse, plans payants seulement)
  const pr = {};
  PLANS.filter(p => p.priceN > 0).forEach(p => { pr[p.name] = 0; });

  lics.forEach(l => {
    const p = PLANS.find(x => x.name.toLowerCase() === (l.plan || '').toLowerCase());
    if (p && p.priceN > 0) {
      if (pr[p.name] === undefined) pr[p.name] = 0;
      pr[p.name] += p.priceN;
    }
  });

  const totalRev  = Object.values(pr).reduce((a, v) => a + v, 0);
  const rows      = dash || [];
  const totalTx   = rows.reduce((a, r) => a + Number(r.total_tx   || 0), 0);
  const totalAmt  = rows.reduce((a, r) => a + Number(r.total_amount || 0), 0);
  const totalComm = rows.reduce((a, r) => a + Number(r.total_commission || 0), 0);
  const todayTx   = rows.reduce((a, r) => a + Number(r.tx_today    || 0), 0);
  const todayAmt  = rows.reduce((a, r) => a + Number(r.amount_today || 0), 0);

  mc.innerHTML = `
  <div class="pt">Recettes &amp; Statistiques</div>
  <div class="ps">Vue d'ensemble financière de la plateforme</div>

  <div class="sg4">
    <div class="sc"><div class="slbl">Recettes licences</div><div class="sval" style="color:var(--yellow);font-size:16px;">${fmtK(totalRev)} F</div><div class="sdelta up">↑ cumulé</div></div>
    <div class="sc"><div class="slbl">Volume total transité</div><div class="sval" style="color:var(--accent2);font-size:16px;">${fmtK(totalAmt)} F</div><div class="sdelta">toutes cabines</div></div>
    <div class="sc"><div class="slbl">Commissions totales</div><div class="sval" style="color:var(--accent);font-size:16px;">${fmtK(totalComm)} F</div><div class="sdelta up">↑ cumulé</div></div>
    <div class="sc"><div class="slbl">Tx totales</div><div class="sval" style="color:var(--purple);">${fmt(totalTx)}</div><div class="sdelta">toutes cabines</div></div>
  </div>

  <div class="sg2">
    <div class="card">
      <div class="sh"><div class="st">Revenus par plan</div></div>
      ${PLANS.map(p => {
        const planKey = p.name.toLowerCase();
        const cnt   = lics.filter(l => (l.plan || '').toLowerCase() === planKey && l.status === 'active').length;
        const total = lics.filter(l => (l.plan || '').toLowerCase() === planKey).length;
        const rev   = pr[p.name] || 0;
        const pct   = totalRev > 0 ? Math.round(rev / totalRev * 100) : 0;
        return `
          <div style="margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
              <div style="display:flex;align-items:center;gap:7px;">
                <span>${p.icon}</span>
                <span style="font-size:12px;font-weight:700;">${p.name}</span>
                <span class="pill pg" style="font-size:9px;">${cnt} actif${cnt > 1 ? 's' : ''}</span>
                <span class="pill pp" style="font-size:9px;">${total} total</span>
              </div>
              <div style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:var(--yellow);">${fmtK(rev)} F</div>
            </div>
            <div class="pbar"><div class="pfill" style="width:${pct}%;background:var(--purple)"></div></div>
          </div>`;
      }).join('')}
      <div style="border-top:1px solid var(--border);padding-top:10px;display:flex;justify-content:space-between;">
        <div style="font-size:12px;font-weight:700;">TOTAL</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;color:var(--yellow);">${fmtK(totalRev)} F</div>
      </div>
    </div>

    <div class="card">
      <div class="sh"><div class="st">Activité aujourd'hui</div></div>
      <div class="sg2" style="margin-bottom:0;">
        <div class="sc"><div class="slbl">Transactions</div><div class="sval" style="color:var(--accent2);">${fmt(todayTx)}</div></div>
        <div class="sc"><div class="slbl">Volume</div><div class="sval" style="color:var(--yellow);font-size:15px;">${fmtK(todayAmt)} F</div></div>
      </div>
    </div>
  </div>`;
}


/* ══════════════════════════════════════════════════════════
   11. INITIALISATION
   ══════════════════════════════════════════════════════════ */

checkSession();
