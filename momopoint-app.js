/* ============================================================
   MomoPoint— App Logic
   Logique principale de l'application client
   (Propriétaire & Gérant)

   TABLE DES MATIÈRES :
     1.  Configuration & constantes
     2.  État global
     3.  Utilitaires généraux
     4.  Logique des tranches de retrait
     5.  Navigation (auth / vues)
     6.  Authentification (login / register)
     7.  Chargement post-login
     8.  Temps réel & notifications
     9.  Onglets Propriétaire
    10.  Gestion des réseaux (config)
    11.  Onglets Gérant
    12.  Transactions offline
    13.  Initialisation
   ============================================================ */


/* ─────────────────────────────────────────────
   1. CONFIGURATION & CONSTANTES
   ───────────────────────────────────────────── */

const SB_URL          = 'https://yweojpsawxkwyfwqqttt.supabase.co';
const SB_KEY          = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3ZW9qcHNhd3hrd3lmd3FxdHR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDQ3NDEsImV4cCI6MjA5MjEyMDc0MX0.pGlUyns7b-kT3LHj_-nnqYtYeItcUv-_duTG9gCPzu8';
const ADMIN_EMAIL     = 'frejusglessougbe@gmail.com';
const ADMIN_WA_NUMBER = '22901909293'; // Sans espaces ni tirets

/** Pays supportés pour la saisie des numéros clients */
const COUNTRIES = [
  { code: 'BJ', flag: '🇧🇯', prefix: '+229', name: 'Bénin'         },
  { code: 'SN', flag: '🇸🇳', prefix: '+221', name: 'Sénégal'       },
  { code: 'CI', flag: '🇨🇮', prefix: '+225', name: "Côte d'Ivoire" },
  { code: 'ML', flag: '🇲🇱', prefix: '+223', name: 'Mali'          },
  { code: 'NE', flag: '🇳🇪', prefix: '+227', name: 'Niger'         },
  { code: 'BF', flag: '🇧🇫', prefix: '+226', name: 'Burkina Faso'  },
];

/** Labels, couleurs et icônes des types d'opérations */
const OL = { dep: 'Dépôt',            ret: 'Retrait',         for: 'Forfait',          cre: 'Crédit'          };
const OC = { dep: 'var(--accent)',     ret: 'var(--warn)',     for: 'var(--accent2)',   cre: 'var(--yellow)'   };
const OI = { dep: '⬇️',               ret: '⬆️',              for: '📶',               cre: '📱'              };

/** Palette de couleurs disponibles pour les réseaux */
const NET_COLORS = ['#00c4ff','#ff9500','#ffc94d','#00d68f','#ff4466','#b09fff','#3d8bff','#ff6eb4'];

/** Initialisation du client Supabase */
const { createClient } = supabase;
const sb = createClient(SB_URL, SB_KEY);


/* ─────────────────────────────────────────────
   2. ÉTAT GLOBAL DE L'APPLICATION
   ─────────────────────────────────────────────
   Objet centralisé — toute la session en mémoire.
   Évite les variables globales dispersées.
   ───────────────────────────────────────────── */

let A = {
  // Identité de l'utilisateur connecté
  role:         null,     // 'owner' | 'manager'
  mode:         'login',  // 'login' | 'register'
  user:         null,     // Objet user Supabase
  profile:      null,     // Profil owner ou manager (table owners / managers)
  ownerProfile: null,     // Profil owner du propriétaire (utilisé si on est gérant)

  // Données chargées au démarrage
  nets:     [],           // Réseaux du propriétaire
  notifs:   [],           // Notifications de l'utilisateur
  managers: [],           // Liste des gérants (si propriétaire)

  // Sélections actives dans le formulaire de transaction
  selOp:   'dep',         // Type d'opération : 'dep' | 'ret' | 'for' | 'cre'
  selNet:  null,          // Nom du réseau sélectionné
  selCty:  'BJ',          // Code pays sélectionné
  selColor: '#00d68f',    // Couleur choisie lors d'un ajout de réseau

  // Navigation propriétaire
  oTab:      0,           // Onglet actif (0=accueil, 1=rapports, 2=gérants, 3=config)
  oSubView:  null,        // Sous-vue active (ex: 'mgr' pour le détail d'un gérant)
  viewedMgr: null,        // ID du gérant dont on consulte le détail

  // Modale suppression transaction
  pendingDelTx: null,     // ID de la transaction en cours de demande de suppression

  // Capitaux
  netCapMap:  {},         // { networkId: totalCapital } — somme des capitaux de tous les gérants actifs
  mgrNetCaps: {},         // { networkId: capital } — capital du gérant courant par réseau

  // Tranches de retrait
  slabs:      {},         // { networkId: [ { min, max, fee } ] }
  _slabNetId: null,       // Réseau en cours d'édition dans la modal tranches
  _slabRows:  [],         // Lignes temporaires de la modal tranches (avant sauvegarde)

  // Filtres persistants (évitent la perte lors des re-rendus)
  fH: { s: '', n: 'all', df: '', dt: '' }, // Historique gérant
  fG: { s: '', n: 'all', df: '', dt: '' }, // Gains gérant
  fR: { s: '', n: 'all', df: '', dt: '' }, // Rapports propriétaire
  fD: { s: '', n: 'all', df: '', dt: '' }, // Détail gérant

  // Valeurs de recherche en attente (pour ne pas les perdre au re-rendu)
  pendH: '', pendR: '', pendD: '',
};


/* ─────────────────────────────────────────────
   3. UTILITAIRES GÉNÉRAUX
   ───────────────────────────────────────────── */

/** Affiche une vue et masque toutes les autres */
function showV(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

/** Affiche un message temporaire en bas de l'écran */
function toast(message, duration = 2300) {
  const t = document.getElementById('toast');
  t.textContent = message;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

/** Formate un nombre avec séparateurs français  ex: 10 000 */
function fmt(n) { return Number(n || 0).toLocaleString('fr-FR'); }

/** Formate en abrégé  ex: 1500 → 1.5k */
function fmtK(n) { n = Number(n || 0); return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }

/** Nombre de jours restants avant une date d'expiration */
function dl(dateStr) {
  return dateStr ? Math.max(0, Math.floor((new Date(dateStr) - new Date()) / 86_400_000)) : 0;
}

/** Génère un segment aléatoire 4 car. pour les codes (ex: "A3F1") */
function seg()     { return Math.random().toString(36).substr(2, 4).toUpperCase(); }
function genCode() { return 'CAB-' + seg(); }

/** Affiche un message d'erreur dans le formulaire d'auth */
function showErr(msg) {
  const e = document.getElementById('aErr');
  e.innerHTML = msg;
  e.style.display = 'block';
}

/** Ouvre une modal bottom-sheet */
function openM(id) {
  if (id === 'notifM') renderNotifs(); // Rafraîchir avant d'afficher
  document.getElementById(id).classList.add('open');
}

/** Ferme une modal bottom-sheet */
function closeM(id) { document.getElementById(id).classList.remove('open'); }

/** Demande confirmation avant déconnexion */
function confirmLogout() {
  if (!confirm('Voulez-vous vraiment vous déconnecter ?')) return;
  doLogout();
}

/** Ouvre WhatsApp avec un message pré-rempli pour contacter l'admin */
function contactAdmin(ownerName, licKey) {
  const name = ownerName || A.profile?.full_name || 'Propriétaire';
  const key  = licKey    || A.profile?.license_key || '—';
  const msg  = encodeURIComponent(
    `Bonjour, je suis ${name} et ma licence MomoPoint a expiré.\n\n🔑 Clé : ${key}\n\nJe souhaite renouveler mon abonnement. Merci.`
  );
  window.open(`https://wa.me/${ADMIN_WA_NUMBER}?text=${msg}`, '_blank');
}

// Fermeture des modals en cliquant sur l'overlay
document.querySelectorAll('.mover').forEach(m => {
  m.addEventListener('click', function(e) { if (e.target === this) closeM(this.id); });
});


/* ─────────────────────────────────────────────
   4. LOGIQUE DES TRANCHES DE RETRAIT
   ─────────────────────────────────────────────
   Pour les RETRAITS, la commission est calculée avec
   les frais fixes d'une tranche (pas un % du montant) :
     commission = taux_réseau% × frais_tranche(montant)

   Pour DÉPÔT / FORFAIT / CRÉDIT :
     commission = taux_réseau% × montant
   ───────────────────────────────────────────── */

/**
 * Retourne les frais fixes de la tranche correspondant au montant.
 * Retourne null si aucune tranche ne couvre ce montant.
 *
 * @param {string} networkId
 * @param {number} amount
 * @returns {number|null}
 */
function getWithdrawalFee(networkId, amount) {
  const slabs = (A.slabs[networkId] || [])
    .slice()
    .sort((a, b) => a.min_amount - b.min_amount);

  for (const s of slabs) {
    const withinRange = amount >= s.min_amount
      && (s.max_amount === null || s.max_amount === undefined || amount <= s.max_amount);
    if (withinRange) return Number(s.fee || 0);
  }

  return null; // Aucune tranche trouvée pour ce montant
}

/**
 * Calcule la commission selon le type d'opération.
 *
 * @param {'dep'|'ret'|'for'|'cre'} op  - Type d'opération
 * @param {number} rate                  - Taux du réseau en %
 * @param {number} amount                - Montant de la transaction
 * @param {string} networkId             - ID du réseau
 * @returns {{ comm: number, noSlab: boolean, fee?: number }}
 */
function computeComm(op, rate, amount, networkId) {
  if (op === 'ret') {
    const fee = getWithdrawalFee(networkId, amount);
    if (fee === null) return { comm: 0, noSlab: true };
    return { comm: Math.round(fee * rate / 100), noSlab: false, fee };
  }
  // Dépôt, forfait, crédit : taux% × montant
  return { comm: Math.round(amount * rate / 100), noSlab: false };
}

/** Charge les tranches de retrait depuis Supabase et les stocke dans A.slabs */
async function loadSlabs(ownerId) {
  const { data } = await sb
    .from('withdrawal_slabs')
    .select('*')
    .eq('owner_id', ownerId)
    .order('min_amount');

  A.slabs = {};
  (data || []).forEach(s => {
    if (!A.slabs[s.network_id]) A.slabs[s.network_id] = [];
    A.slabs[s.network_id].push(s);
  });
}

/* ── Modal tranches (édition par le propriétaire) ── */

/** Ouvre la modal d'édition des tranches pour un réseau donné */
async function openSlabModal(netId, netName) {
  A._slabNetId = netId;
  document.getElementById('slabNetName').textContent = netName;

  const { data } = await sb
    .from('withdrawal_slabs')
    .select('*')
    .eq('network_id', netId)
    .order('min_amount');

  A._slabRows = (data || []).map(s => ({ ...s }));
  renderSlabModal();
  openM('slabM');
}

/** Construit le contenu de la modal tranches */
function renderSlabModal() {
  const rows = A._slabRows;

  document.getElementById('slabMBody').innerHTML = `
    <div style="padding:9px 12px;background:rgba(255,201,77,.05);border:1px solid rgba(255,201,77,.18);border-radius:10px;">
      <div style="font-size:11px;color:var(--yellow);font-weight:700;margin-bottom:3px;">📐 Logique de calcul retrait</div>
      <div style="font-size:10px;color:var(--muted3);line-height:1.6;">
        Commission = <strong style="color:var(--text);">taux% × frais de la tranche</strong><br>
        Les frais sont fixes selon le montant retiré, pas un % du montant total.
      </div>
    </div>

    <div>
      <div style="display:grid;grid-template-columns:1fr 1fr 90px 34px;gap:6px;padding:5px 0 8px;border-bottom:1px solid var(--border2);">
        <div style="font-size:9px;font-weight:700;color:var(--muted2);text-transform:uppercase;">Min (FCFA)</div>
        <div style="font-size:9px;font-weight:700;color:var(--muted2);text-transform:uppercase;">Max (FCFA)</div>
        <div style="font-size:9px;font-weight:700;color:var(--muted2);text-transform:uppercase;">Frais (F)</div>
        <div></div>
      </div>
      ${rows.length === 0
        ? '<div style="text-align:center;padding:16px;font-size:11px;color:var(--muted2);">Aucune tranche. Ajoutez-en une ↓</div>'
        : rows.map((s, i) => `
            <div class="slab-row">
              <input class="slab-inp" type="number" min="0" placeholder="0"   value="${s.min_amount ?? ''}" id="slab_min_${i}">
              <input class="slab-inp" type="number" min="0" placeholder="∞"   value="${s.max_amount ?? ''}" id="slab_max_${i}">
              <input class="slab-inp" type="number" min="0" placeholder="125" value="${s.fee ?? ''}"        id="slab_fee_${i}">
              <button class="slab-del" onclick="removeSlabRow(${i})">🗑️</button>
            </div>`).join('')}
    </div>

    <button onclick="addSlabRow()"
      style="width:100%;padding:10px;border-radius:10px;border:1.5px dashed var(--border3);background:transparent;color:var(--muted2);font-size:12px;font-weight:700;cursor:pointer;font-family:'Syne',sans-serif;"
      onmouseover="this.style.borderColor='var(--accent)'"
      onmouseout="this.style.borderColor='var(--border3)'">
      + Ajouter une tranche
    </button>

    <div style="display:grid;grid-template-columns:1fr 2fr;gap:8px;">
      <div style="padding:10px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:10px;text-align:center;font-size:12px;color:var(--muted2);font-weight:700;cursor:pointer;" onclick="closeM('slabM')">Annuler</div>
      <button class="btn btng" onclick="saveSlabs()">💾 Enregistrer les tranches</button>
    </div>`;
}

function addSlabRow() {
  A._slabRows.push({ min_amount: '', max_amount: '', fee: '' });
  renderSlabModal();
}

function removeSlabRow(i) {
  A._slabRows.splice(i, 1);
  renderSlabModal();
}

/** Sauvegarde les tranches (supprime les anciennes puis réinsère) */
async function saveSlabs() {
  const netId = A._slabNetId;
  if (!netId) return;

  // Lecture des valeurs depuis le DOM
  const newRows = [];
  A._slabRows.forEach((_, i) => {
    const min   = parseFloat(document.getElementById(`slab_min_${i}`)?.value);
    const maxEl = document.getElementById(`slab_max_${i}`)?.value?.trim();
    const fee   = parseFloat(document.getElementById(`slab_fee_${i}`)?.value);
    if (isNaN(min) || isNaN(fee)) return; // Ignorer les lignes incomplètes
    newRows.push({
      network_id: netId,
      owner_id:   A.profile.id,
      min_amount: min,
      max_amount: (maxEl === '' || maxEl === undefined) ? null : parseFloat(maxEl),
      fee,
    });
  });

  // Validation : pas de chevauchement entre tranches
  for (let i = 0; i < newRows.length - 1; i++) {
    if (newRows[i].max_amount !== null && newRows[i].max_amount >= newRows[i + 1].min_amount) {
      toast('⚠️ Les tranches se chevauchent, vérifiez les bornes');
      return;
    }
  }

  // Suppression des anciennes + réinsertion
  const { error: delErr } = await sb.from('withdrawal_slabs').delete().eq('network_id', netId);
  if (delErr) { toast('❌ ' + delErr.message); return; }

  if (newRows.length > 0) {
    const { error: insErr } = await sb.from('withdrawal_slabs').insert(newRows);
    if (insErr) { toast('❌ ' + insErr.message); return; }
  }

  A.slabs[netId] = newRows; // Mise à jour du cache local
  toast(`✅ Tranches enregistrées ! (${newRows.length} tranche${newRows.length > 1 ? 's' : ''})`);
  closeM('slabM');
}


/* ─────────────────────────────────────────────
   5. NAVIGATION ENTRE LES VUES
   ───────────────────────────────────────────── */

/** Revient à l'écran de choix du rôle */
function goSplash() { A.role = null; showV('splash'); }

/** Affiche le formulaire d'auth selon le rôle choisi */
function goAuth(role) {
  A.role = role;
  const isOwner = role === 'owner';

  document.getElementById('aBadge').textContent = isOwner ? '👑 Propriétaire' : '👤 Gérant';
  document.getElementById('aBadge').className   = 'abadge ' + (isOwner ? 'tbadge own' : 'tbadge mgr');
  document.getElementById('aTitle').textContent = isOwner ? 'Espace Propriétaire'                     : 'Espace Gérant';
  document.getElementById('aSub').textContent   = isOwner ? 'Connectez-vous ou créez votre compte cabine' : 'Connectez-vous ou créez votre compte gérant';

  setMode('login');
  showV('auth');
}

/** Bascule entre le mode connexion et inscription */
function setMode(m) {
  A.mode = m;
  document.getElementById('mL').classList.toggle('on', m === 'login');
  document.getElementById('mR').classList.toggle('on', m === 'register');
  document.getElementById('aErr').style.display = 'none';
  renderForm();
}

/** Génère dynamiquement le formulaire selon le rôle et le mode */
function renderForm() {
  const isOwner = A.role === 'owner';
  const isLogin = A.mode === 'login';
  const c = document.getElementById('aForm');

  if (isLogin) {
    c.innerHTML = `
      <div class="fg"><label class="fl">Email</label><input class="fi" type="email" id="aEmail" placeholder="votre@email.com"></div>
      <div class="fg"><label class="fl">Mot de passe</label><input class="fi" type="password" id="aPass" placeholder="••••••••" onkeydown="if(event.key==='Enter') doLogin()"></div>
      <button class="abtn ${isOwner ? 'bg' : 'bb'}" onclick="doLogin()">${isOwner ? 'Accéder à ma cabine →' : 'Commencer →'}</button>`;

  } else if (isOwner) {
    c.innerHTML = `
      <div class="fg"><label class="fl">🔑 Clé de licence</label><input class="fi" type="text" id="rLic" placeholder="FP-XXXX-XXXX-XXXX"><div class="fhint">Fournie par l'administrateur MomoPoint</div></div>
      <div class="fg"><label class="fl">Nom complet</label><input class="fi" type="text" id="rName" placeholder="Prénom Nom"></div>
      <div class="fg"><label class="fl">Identifiant</label><input class="fi" type="text" id="rUser" placeholder="nom_utilisateur"></div>
      <div class="fg"><label class="fl">Téléphone</label><input class="fi" type="tel" id="rPhone" placeholder="+229 01 90 92 93 94"></div>
      <div class="fg"><label class="fl">Email</label><input class="fi" type="email" id="rEmail" placeholder="votre@email.com"></div>
      <div class="fg"><label class="fl">Mot de passe</label><input class="fi" type="password" id="rPass" placeholder="8 caractères minimum"></div>
      <button class="abtn bg" onclick="doRegOwner()">Créer mon compte →</button>`;

  } else {
    c.innerHTML = `
      <div class="fg"><label class="fl">Code cabine</label><input class="fi" type="text" id="rCode" placeholder="CAB-XXXX"><div class="fhint">Demandez ce code à votre propriétaire</div></div>
      <div class="fg"><label class="fl">Nom complet</label><input class="fi" type="text" id="rName" placeholder="Prénom Nom"></div>
      <div class="fg"><label class="fl">Identifiant</label><input class="fi" type="text" id="rUser" placeholder="nom_utilisateur"></div>
      <div class="fg"><label class="fl">Téléphone</label><input class="fi" type="tel" id="rPhone" placeholder="+229 01 90 92 93 94"></div>
      <div class="fg"><label class="fl">Numéro de pièce (NIP)</label><input class="fi" type="text" id="rNip" placeholder="NIP000000"></div>
      <div class="fg"><label class="fl">Email</label><input class="fi" type="email" id="rEmail" placeholder="votre@email.com"></div>
      <div class="fg"><label class="fl">Mot de passe</label><input class="fi" type="password" id="rPass" placeholder="8 caractères minimum"></div>
      <button class="abtn bb" onclick="doRegMgr()">Créer mon compte →</button>`;
  }
}


/* ─────────────────────────────────────────────
   6. AUTHENTIFICATION
   ───────────────────────────────────────────── */

/** Connexion via email + mot de passe */
async function doLogin() {
  const email = document.getElementById('aEmail')?.value?.trim();
  const pass  = document.getElementById('aPass')?.value;

  if (!email || !pass) { showErr('Remplissez tous les champs.'); return; }

  if (email === ADMIN_EMAIL) {
    showErr('Ce compte est réservé à l\'administration.<br>Utilisez <a href="momopoint-admin.html" style="color:var(--accent2);">le portail admin</a>.');
    return;
  }

  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) { showErr('Identifiants incorrects.'); return; }
  await afterLogin(data.user);
}

/** Inscription d'un nouveau propriétaire */
async function doRegOwner() {
  const lic   = (document.getElementById('rLic')?.value   || '').trim().toUpperCase();
  const name  = (document.getElementById('rName')?.value  || '').trim();
  const user  = (document.getElementById('rUser')?.value  || '').trim();
  const phone = (document.getElementById('rPhone')?.value || '').trim();
  const email = (document.getElementById('rEmail')?.value || '').trim();
  const pass  = (document.getElementById('rPass')?.value  || '');

  if (!lic || !name || !user || !email || !pass) { showErr('Tous les champs sont obligatoires.'); return; }
  if (pass.length < 8) { showErr('Le mot de passe doit contenir au moins 8 caractères.'); return; }

  // Vérification de la clé de licence
  const { data: licRow } = await sb.from('licenses').select('*').eq('key', lic).maybeSingle();
  if (!licRow)                    { showErr('Clé de licence invalide.'); return; }
  if (licRow.status !== 'pending') { showErr('Cette clé a déjà été utilisée ou est expirée.'); return; }

  const { data, error } = await sb.auth.signUp({ email, password: pass });
  if (error) { showErr(error.message); return; }

  const uid  = data.user.id;
  const code = genCode();

  await sb.from('owners').insert({ id: uid, full_name: name, username: user, phone, email, license_key: lic, invite_code: code, cabin_name: 'Ma Cabine', capital: 0 });
  await sb.from('licenses').update({ owner_id: uid, status: 'active', start_date: new Date().toISOString().slice(0, 10) }).eq('key', lic);
  await sb.rpc('setup_default_networks', { p_owner_id: uid });

  toast('✅ Compte créé ! Vérifiez votre email puis connectez-vous.');
  setMode('login');
}

/** Inscription d'un nouveau gérant */
async function doRegMgr() {
  const code  = (document.getElementById('rCode')?.value  || '').trim().toUpperCase();
  const name  = (document.getElementById('rName')?.value  || '').trim();
  const user  = (document.getElementById('rUser')?.value  || '').trim();
  const phone = (document.getElementById('rPhone')?.value || '').trim();
  const nip   = (document.getElementById('rNip')?.value   || '').trim();
  const email = (document.getElementById('rEmail')?.value || '').trim();
  const pass  = (document.getElementById('rPass')?.value  || '');

  if (!code || !name || !user || !email || !pass) { showErr('Tous les champs sont obligatoires.'); return; }
  if (pass.length < 8) { showErr('Mot de passe trop court (8 caractères minimum).'); return; }

  const { data: owner } = await sb.from('owners').select('id,cabin_name,license_key').eq('invite_code', code).maybeSingle();
  if (!owner) { showErr('Code cabine invalide. Vérifiez auprès de votre propriétaire.'); return; }

  const { data: lic } = await sb.from('licenses').select('status').eq('key', owner.license_key).maybeSingle();
  if (!lic || lic.status !== 'active') { showErr('La licence de ce propriétaire est expirée ou révoquée.'); return; }

  const { data, error } = await sb.auth.signUp({ email, password: pass });
  if (error) { showErr(error.message); return; }

  const uid = data.user.id;
  await sb.from('managers').insert({ id: uid, full_name: name, username: user, phone, id_number: nip, owner_id: owner.id, invite_code: code, cabin_name: owner.cabin_name, status: 'pending' });
  await sb.from('manager_requests').insert({ manager_id: uid, owner_id: owner.id, status: 'pending' });

  toast("✅ Demande envoyée ! En attente d'approbation.");
  setMode('login');
}

/** Déconnexion complète et réinitialisation de l'état */
async function doLogout() {
  await sb.auth.signOut();
  A = { ...A, user: null, profile: null, role: null, nets: [], notifs: [], managers: [], slabs: {} };
  showV('splash');
}

/** Vérifie si une session Supabase existe au démarrage */
async function checkSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) await afterLogin(session.user);
}


/* ─────────────────────────────────────────────
   7. CHARGEMENT POST-LOGIN
   ───────────────────────────────────────────── */

/**
 * Callback appelé après une connexion réussie.
 * Détermine le rôle et charge les données correspondantes.
 */
async function afterLogin(user) {
  A.user = user;

  // Blocage du compte admin dans l'app client
  if (user.email === ADMIN_EMAIL) {
    await sb.auth.signOut();
    showErr("Ce compte est réservé à l'administration.");
    return;
  }

  // Tentative de chargement en tant que propriétaire
  const { data: owner } = await sb.from('owners').select('*').eq('id', user.id).maybeSingle();
  if (owner) { A.role = 'owner'; A.profile = owner; await checkAndLoadOwner(); return; }

  // Tentative de chargement en tant que gérant
  const { data: mgr } = await sb.from('managers').select('*,owners(*)').eq('id', user.id).maybeSingle();
  if (mgr) { A.role = 'manager'; A.profile = mgr; A.ownerProfile = mgr.owners; await checkAndLoadManager(); return; }

  showErr('Profil introuvable. Créez un compte.');
}

/** Vérifie la licence et charge l'interface propriétaire */
async function checkAndLoadOwner() {
  const { data: lic } = await sb.from('licenses').select('*').eq('key', A.profile.license_key).maybeSingle();

  const isExpired = !lic || lic.status === 'expired' || lic.status === 'revoked' || new Date(lic.end_date) < new Date();
  if (isExpired) {
    _showBlockedScreen('🔒', 'Votre licence a expiré',
      "Votre accès et celui de vos gérants est suspendu. Contactez l'administrateur MomoPoint pour renouveler votre licence.",
      `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted2);margin-bottom:14px;padding:8px;background:var(--card2);border-radius:8px;">Clé : ${A.profile.license_key}</div>
       <button onclick="contactAdmin('${A.profile.full_name}','${A.profile.license_key}')" style="width:100%;padding:13px;border-radius:12px;border:none;background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;font-family:'Syne',sans-serif;font-size:13px;font-weight:800;cursor:pointer;">
         Contacter l'administrateur
       </button>`
    );
    return;
  }

  // Bandeau d'avertissement si < 5 jours restants
  const d = dl(lic.end_date);
  if (d <= 5 && d > 0) {
    document.getElementById('oExpMsg').textContent = `⚠️ Votre licence expire dans ${d} jour${d > 1 ? 's' : ''}. Renouvelez pour éviter la suspension.`;
    document.getElementById('oExpBanner').classList.add('show');
  }

  document.getElementById('oTitle').textContent = A.profile.cabin_name || 'Ma Cabine';
  document.getElementById('oSub').textContent   = A.profile.full_name;

  const [{ data: nets }, { data: mgrs }, { data: notifs }] = await Promise.all([
    sb.from('networks').select('*').eq('owner_id', A.profile.id).order('created_at'),
    sb.from('managers').select('*').eq('owner_id', A.profile.id),
    sb.from('notifications').select('*').eq('user_id', A.user.id).order('created_at', { ascending: false }).limit(30),
  ]);

  A.nets = nets || []; A.managers = mgrs || []; A.notifs = notifs || [];
  await loadSlabs(A.profile.id);
  updateDot('owner');
  showV('app-owner');
  oTab(0);
  startRealtime();
}

/** Vérifie les droits et charge l'interface gérant */
async function checkAndLoadManager() {
  if (A.profile.status === 'pending')  { _showBlockedScreen('⏳', "En attente d'approbation", "Votre demande est en cours d'examen par le propriétaire.", ''); return; }
  if (A.profile.status === 'rejected') { _showBlockedScreen('❌', 'Demande refusée', "Votre demande d'accès a été refusée. Contactez votre propriétaire.", ''); return; }

  const { data: lic } = await sb.from('licenses').select('*').eq('key', A.ownerProfile?.license_key || '').maybeSingle();
  const isExpired = !lic || lic.status === 'expired' || lic.status === 'revoked' || new Date(lic.end_date) < new Date();
  if (isExpired) { _showBlockedScreen('🔒', 'Cabine désactivée', "La licence de votre propriétaire a expiré. Votre accès est suspendu.", ''); return; }

  const d = dl(lic.end_date);
  if (d <= 5 && d > 0) {
    document.getElementById('mExpMsg').textContent = `La licence de votre cabine expire dans ${d} jour${d > 1 ? 's' : ''}. Avertissez votre propriétaire.`;
    document.getElementById('mExpBanner').classList.add('show');
  }

  document.getElementById('mName').textContent = A.profile.full_name;
  document.getElementById('mSub').textContent  = (A.profile.cabin_name || 'Cabine') + ' · Gérant';

  const [{ data: nets }, { data: notifs }] = await Promise.all([
    sb.from('networks').select('*').eq('owner_id', A.profile.owner_id).eq('active', true),
    sb.from('notifications').select('*').eq('user_id', A.user.id).order('created_at', { ascending: false }).limit(30),
  ]);

  A.nets = nets || []; A.notifs = notifs || [];
  if (A.nets.length) A.selNet = A.nets[0].name;
  await loadMgrNetCaps();
  await loadSlabs(A.profile.owner_id);
  updateDot('manager');
  showV('app-manager');
  mTab(0);
  startRealtime();
}

/** Affiche l'écran d'accès bloqué avec un message personnalisé */
function _showBlockedScreen(icon, title, message, actionsHTML) {
  document.getElementById('blockedIco').textContent    = icon;
  document.getElementById('blockedTitle').textContent  = title;
  document.getElementById('blockedMsg').textContent    = message;
  document.getElementById('blockedActions').innerHTML  = actionsHTML;
  showV('blocked');
}


/* ─────────────────────────────────────────────
   8. TEMPS RÉEL & NOTIFICATIONS
   ───────────────────────────────────────────── */

/** Abonnement Supabase Realtime aux nouvelles notifications */
function startRealtime() {
  sb.channel('app-notifs')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${A.user.id}` },
      payload => {
        A.notifs.unshift(payload.new);
        updateDot(A.role);
        toast('🔔 ' + payload.new.message.slice(0, 60));
      })
    .subscribe();
}

/** Met à jour le point rouge sur l'icône notifications */
function updateDot(role) {
  const unread = A.notifs.filter(n => !n.read).length;
  const dot    = document.getElementById(role === 'owner' ? 'oNDot' : 'mNDot');
  if (dot) dot.classList.toggle('show', unread > 0);
}

const NOTIF_ICONS = {
  manager_request:  '👤', request_approved: '✅', request_rejected: '❌',
  deletion_request: '🗑️', deletion_approved:'✅', deletion_rejected:'❌',
  license_expiry:   '⚠️',
};
const NOTIF_TITLES = {
  manager_request:  'Demande gérant',        request_approved: 'Demande approuvée',
  request_rejected: 'Demande refusée',        deletion_request: 'Suppression demandée',
  deletion_approved:'Suppression approuvée', deletion_rejected:'Suppression refusée',
  license_expiry:   'Expiration licence',
};

/** Rendu de la liste des notifications dans la modal */
function renderNotifs() {
  const c = document.getElementById('notifList');
  if (!A.notifs.length) { c.innerHTML = '<div class="empty">Aucune notification</div>'; return; }

  c.innerHTML = A.notifs.map(n => `
    <div class="ni-item ${!n.read ? 'unread' : ''}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
        <div style="flex:1;">
          <div class="ni-title">${NOTIF_ICONS[n.type] || '🔔'} ${NOTIF_TITLES[n.type] || 'Notification'}</div>
          <div class="ni-msg">${n.message}</div>
          <div class="ni-time">${new Date(n.created_at).toLocaleString('fr-FR')}</div>
        </div>
        <button onclick="markRead('${n.id}')" style="padding:3px 7px;border-radius:6px;background:rgba(255,61,90,.1);border:1px solid rgba(255,61,90,.2);color:var(--red);font-size:9px;font-weight:700;cursor:pointer;flex-shrink:0;">✕</button>
      </div>
      ${n.type === 'manager_request' && A.role === 'owner' ? `
        <div style="display:flex;gap:6px;margin-top:8px;">
          <button onclick="event.stopPropagation();approveMgr('${n.data?.manager_id}','${n.data?.request_id}')" style="padding:5px 12px;border-radius:8px;background:rgba(0,232,150,.12);border:1px solid rgba(0,232,150,.25);color:var(--accent);font-size:11px;font-weight:700;cursor:pointer;">✅ Approuver</button>
          <button onclick="event.stopPropagation();rejectMgr('${n.data?.manager_id}','${n.data?.request_id}')"  style="padding:5px 12px;border-radius:8px;background:rgba(255,61,90,.1);border:1px solid rgba(255,61,90,.2);color:var(--red);font-size:11px;font-weight:700;cursor:pointer;">❌ Refuser</button>
        </div>` : ''}
      ${n.type === 'deletion_request' && A.role === 'owner' ? `
        <div style="display:flex;gap:6px;margin-top:8px;">
          <button onclick="event.stopPropagation();handleDel('${n.data?.request_id}','approved')" style="padding:5px 12px;border-radius:8px;background:rgba(0,232,150,.12);border:1px solid rgba(0,232,150,.25);color:var(--accent);font-size:11px;font-weight:700;cursor:pointer;">✅ Approuver</button>
          <button onclick="event.stopPropagation();handleDel('${n.data?.request_id}','rejected')" style="padding:5px 12px;border-radius:8px;background:rgba(255,61,90,.1);border:1px solid rgba(255,61,90,.2);color:var(--red);font-size:11px;font-weight:700;cursor:pointer;">❌ Refuser</button>
        </div>` : ''}
    </div>`).join('');
}

async function markRead(id) {
  await sb.from('notifications').delete().eq('id', id);
  A.notifs = A.notifs.filter(n => n.id !== id);
  updateDot(A.role);
  renderNotifs();
}

async function clearAllNotifs() {
  if (!A.notifs.length) { toast('Aucune notification'); return; }
  if (!confirm(`Supprimer toutes les notifications (${A.notifs.length}) ?`)) return;
  await sb.from('notifications').delete().in('id', A.notifs.map(n => n.id));
  A.notifs = [];
  updateDot(A.role);
  renderNotifs();
  toast('🗑️ Notifications vidées');
}

async function approveMgr(mgrId, reqId) {
  await sb.from('manager_requests').update({ status: 'approved' }).eq('id', reqId);
  toast('✅ Gérant approuvé !');
  closeM('notifM');
  const { data: mgrs } = await sb.from('managers').select('*').eq('owner_id', A.profile.id);
  A.managers = mgrs || [];
  if (A.oTab === 2) oMgrs();
}

async function rejectMgr(mgrId, reqId) {
  await sb.from('manager_requests').update({ status: 'rejected' }).eq('id', reqId);
  toast('❌ Gérant refusé.');
  closeM('notifM');
}

async function handleDel(reqId, status) {
  if (!reqId) return;
  await sb.from('deletion_requests').update({ status }).eq('id', reqId);
  toast(status === 'approved' ? '✅ Suppression effectuée' : '❌ Demande refusée');
  closeM('notifM');
  if (A.oTab === 1) oRep();
}


/* ─────────────────────────────────────────────
   9. ONGLETS PROPRIÉTAIRE
   ───────────────────────────────────────────── */

/** Change d'onglet dans l'interface propriétaire */
function oTab(n) {
  A.oTab = n; A.oSubView = null;
  [0, 1, 2, 3].forEach(i => {
    const e = document.getElementById('on' + i);
    e.classList.remove('ag');
    if (i === n) e.classList.add('ag');
  });
  document.getElementById('ownerC').innerHTML = '<div class="loader"><div class="spin"></div></div>';
  [oHome, oRep, oMgrs, oConf][n]();
}

/* ── Onglet 0 : Accueil ── */
async function oHome() {
  const oid   = A.profile.id;
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7) + '-01';

  const [{ data: td }, { data: mo }, { data: lic }, { data: pend }] = await Promise.all([
    sb.from('transactions').select('amount,commission').eq('owner_id', oid).eq('date', today).eq('deleted', false),
    sb.from('transactions').select('amount,commission').eq('owner_id', oid).gte('date', month).eq('deleted', false),
    sb.from('licenses').select('key,plan,end_date').eq('key', A.profile.license_key).maybeSingle(),
    sb.from('deletion_requests').select('*,managers(full_name),transactions(type,amount,network_name)').eq('owner_id', oid).eq('status', 'pending'),
  ]);

  const st = arr => ({
    amt:   arr?.reduce((a, t) => a + t.amount, 0)     || 0,
    comm:  arr?.reduce((a, t) => a + t.commission, 0) || 0,
    count: arr?.length || 0,
  });
  const T = st(td), M = st(mo);
  const d = lic ? dl(lic.end_date) : 0;

  document.getElementById('ownerC').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:11px;">
      <div>
        <div style="font-family:'Syne',sans-serif;font-size:17px;font-weight:800;">Bonjour 👑</div>
        <div style="font-size:11px;color:var(--muted2);">${A.profile.full_name} · tous gérants</div>
      </div>
      <span class="pill pg">Licence active</span>
    </div>

    <div style="padding:11px;background:rgba(0,232,150,.05);border:1.5px solid rgba(0,232,150,.14);border-radius:12px;margin-bottom:11px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted2);">${A.profile.license_key}</div>
        <span class="pill py">${lic?.plan || ''}</span>
      </div>
      <div class="pbar" style="margin-bottom:5px;"><div class="pfill" style="width:${Math.min(100, Math.round(d / 90 * 100))}%;background:${d <= 5 ? 'var(--warn)' : d <= 15 ? 'var(--yellow)' : 'var(--accent)'}"></div></div>
      <div style="font-size:10px;color:var(--muted2);">Expire dans <strong style="color:${d <= 5 ? 'var(--warn)' : 'var(--accent)'};">${d} jours</strong></div>
    </div>

    ${pend?.length ? `
      <div style="padding:10px 12px;background:rgba(255,92,56,.06);border:1px solid rgba(255,92,56,.2);border-radius:11px;margin-bottom:11px;cursor:pointer;" onclick="openM('notifM')">
        <div style="font-size:11px;font-weight:700;color:var(--warn);">🗑️ ${pend.length} demande${pend.length > 1 ? 's' : ''} de suppression</div>
        ${pend.map(r => `<div style="font-size:10px;color:var(--muted2);margin-top:2px;">${r.managers?.full_name || '?'} · ${OL[r.transactions?.type] || '?'} ${fmt(r.transactions?.amount || 0)} F</div>`).join('')}
        <div style="font-size:10px;color:var(--accent2);margin-top:4px;">→ Appuyez pour traiter</div>
      </div>` : ''}

    <div style="font-family:'Syne',sans-serif;font-size:10px;font-weight:700;color:var(--muted2);text-transform:uppercase;letter-spacing:.7px;margin-bottom:7px;">Aujourd'hui</div>
    <div class="sg3">
      <div class="sc"><div class="slbl">Mis en jeu</div><div class="sval" style="color:var(--yellow);font-size:13px;">${fmtK(T.amt)} F</div></div>
      <div class="sc"><div class="slbl">Nb Tx</div><div class="sval" style="color:var(--accent2);">${T.count}</div></div>
      <div class="sc"><div class="slbl">Commissions</div><div class="sval" style="color:var(--accent);font-size:13px;">${fmtK(T.comm)} F</div></div>
    </div>

    <div style="font-family:'Syne',sans-serif;font-size:10px;font-weight:700;color:var(--muted2);text-transform:uppercase;letter-spacing:.7px;margin-bottom:7px;">Ce mois</div>
    <div class="sg3">
      <div class="sc"><div class="slbl">Mis en jeu</div><div class="sval" style="color:var(--yellow);font-size:13px;">${fmtK(M.amt)} F</div></div>
      <div class="sc"><div class="slbl">Nb Tx</div><div class="sval" style="color:var(--accent2);">${M.count}</div></div>
      <div class="sc"><div class="slbl">Commissions</div><div class="sval" style="color:var(--accent);font-size:13px;">${fmtK(M.comm)} F</div></div>
    </div>`;
}

/* ── Onglet 1 : Rapports ── */
async function oRep() {
  const f = A.fR;
  let q = sb.from('transactions').select('*').eq('owner_id', A.profile.id).eq('deleted', false);
  if (f.n !== 'all') q = q.eq('network_name', f.n);
  if (f.df) q = q.gte('date', f.df);
  if (f.dt) q = q.lte('date', f.dt);
  const { data: txs } = await q.order('created_at', { ascending: false });

  let rows = txs || [];
  if (f.s) {
    const sq = f.s.toLowerCase();
    rows = rows.filter(t =>
      t.client_phone?.includes(f.s) ||
      t.network_name?.toLowerCase().includes(sq) ||
      OL[t.type]?.toLowerCase().includes(sq)
    );
  }

  const mmap = {};
  A.managers.forEach(m => { mmap[m.id] = m.full_name; });
  const st   = { amt: rows.reduce((a, t) => a + t.amount, 0), comm: rows.reduce((a, t) => a + t.commission, 0), count: rows.length };
  const nets = ['all', ...A.nets.filter(n => n.active).map(n => n.name)];

  document.getElementById('ownerC').innerHTML = `
    <div class="sh"><div class="st">Rapports — tous gérants</div></div>
    <div class="fb">
      <div class="sb-row">
        <div class="sb"><span style="color:var(--muted2);">🔍</span><input type="text" placeholder="Numéro, réseau, type..." id="repSearch" value="${A.pendR || ''}"></div>
        <button class="search-go" onclick="submitRepSearch()">Chercher</button>
      </div>
      <div class="dr"><input class="di" type="date" value="${f.df}" onchange="A.fR.df=this.value;oRep()"><input class="di" type="date" value="${f.dt}" onchange="A.fR.dt=this.value;oRep()"></div>
      <div class="fr">${nets.map(n => `<div class="fc ${f.n === n ? 'on' : ''}" onclick="A.fR.n='${n}';oRep()">${n === 'all' ? 'Tous' : n}</div>`).join('')}</div>
    </div>
    <div class="sg3">
      <div class="sc"><div class="slbl">Mis en jeu</div><div class="sval" style="color:var(--yellow);font-size:13px;">${fmtK(st.amt)} F</div></div>
      <div class="sc"><div class="slbl">Nb Tx</div><div class="sval" style="color:var(--accent2);">${st.count}</div></div>
      <div class="sc"><div class="slbl">Commissions</div><div class="sval" style="color:var(--accent);font-size:13px;">${fmtK(st.comm)} F</div></div>
    </div>
    <div class="card">${rows.length === 0 ? '<div class="empty">Aucune transaction</div>' : rows.slice(0, 15).map(tx => txH(tx, true, mmap)).join('')}${rows.length > 15 ? `<div style="text-align:center;padding:9px;font-size:11px;color:var(--muted2);">+${rows.length - 15} autres</div>` : ''}</div>`;

  const el = document.getElementById('repSearch');
  if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') submitRepSearch(); });
}
function submitRepSearch() { const v = document.getElementById('repSearch')?.value?.trim() || ''; A.pendR = v; A.fR.s = v; oRep(); }

/* ── Onglet 2 : Gérants ── */
async function oMgrs() {
  const { data: mgrs } = await sb.from('managers').select('*').eq('owner_id', A.profile.id).order('created_at');
  A.managers = mgrs || [];
  const { data: pend } = await sb.from('manager_requests').select('*,managers(full_name,username,phone)').eq('owner_id', A.profile.id).eq('status', 'pending');

  document.getElementById('ownerC').innerHTML = `
    <div class="sh"><div class="st">Mes Gérants</div><div class="sa" onclick="copyCode()">Code : ${A.profile.invite_code}</div></div>
    <div style="padding:9px 11px;background:rgba(0,232,150,.04);border:1px solid rgba(0,232,150,.14);border-radius:10px;font-size:11px;color:var(--muted3);margin-bottom:11px;">
      ♾️ Code invite : <strong style="font-family:'JetBrains Mono',monospace;color:var(--accent2);">${A.profile.invite_code}</strong>
      <span style="cursor:pointer;color:var(--accent2);margin-left:6px;" onclick="copyCode()">📋</span>
    </div>

    ${pend?.length ? `
      <div class="card" style="border-color:rgba(255,201,77,.25);margin-bottom:11px;">
        <div class="sh" style="margin-bottom:9px;"><div class="st">⏳ En attente (${pend.length})</div></div>
        ${pend.map(r => `
          <div class="li">
            <div class="liico" style="background:rgba(255,201,77,.1);">👤</div>
            <div class="libody"><div class="lititle">${r.managers?.full_name || '—'}</div><div class="lisub">@${r.managers?.username || '—'} · ${r.managers?.phone || '—'}</div></div>
            <div style="display:flex;gap:5px;">
              <button onclick="approveMgr('${r.manager_id}','${r.id}')" style="padding:4px 9px;border-radius:7px;background:rgba(0,232,150,.12);border:1px solid rgba(0,232,150,.22);color:var(--accent);font-size:10px;font-weight:700;cursor:pointer;">✅</button>
              <button onclick="rejectMgr('${r.manager_id}','${r.id}')"  style="padding:4px 9px;border-radius:7px;background:rgba(255,61,90,.1);border:1px solid rgba(255,61,90,.2);color:var(--red);font-size:10px;font-weight:700;cursor:pointer;">❌</button>
            </div>
          </div>`).join('')}
      </div>` : ''}

    ${(mgrs || []).map(m => `
      <div class="card" style="margin-bottom:9px;cursor:pointer;" onclick="openMgrD('${m.id}')">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:${m.status === 'active' ? '9' : '0'}px;">
          <div style="display:flex;align-items:center;gap:9px;">
            <div style="width:35px;height:35px;border-radius:10px;background:${m.status === 'active' ? 'rgba(0,232,150,.1)' : 'rgba(255,255,255,.04)'};display:flex;align-items:center;justify-content:center;font-size:15px;">👤</div>
            <div>
              <div style="font-size:13px;font-weight:700;">${m.full_name}</div>
              <div style="font-size:10px;color:var(--muted2);">@${m.username} · ${m.phone || '—'}</div>
            </div>
          </div>
          <div style="display:flex;gap:5px;align-items:center;">
            <span class="pill ${m.status === 'active' ? 'pg' : m.status === 'pending' ? 'py' : 'pr'}">${m.status === 'active' ? 'Actif' : m.status === 'pending' ? 'En attente' : 'Refusé'}</span>
            ${m.status === 'active' ? `<button onclick="event.stopPropagation();openCapModal('${m.id}')" style="padding:3px 8px;border-radius:6px;background:rgba(255,201,77,.1);border:1px solid rgba(255,201,77,.22);color:var(--yellow);font-size:10px;cursor:pointer;">💰</button>` : ''}
            <button onclick="event.stopPropagation();delMgr('${m.id}','${m.full_name}')" style="padding:3px 8px;border-radius:6px;background:rgba(255,61,90,.1);border:1px solid rgba(255,61,90,.2);color:var(--red);font-size:10px;cursor:pointer;">🗑️</button>
          </div>
        </div>
        ${m.status === 'active' ? '<div style="font-size:10px;color:var(--accent2);text-align:right;">Voir transactions →</div>' : ''}
      </div>`).join('') || `<div class="empty">Aucun gérant<br><span style="font-size:11px;">Code : <strong>${A.profile.invite_code}</strong></span></div>`}`;
}

async function openCapModal(mgrId) {
  const mgr = A.managers.find(m => m.id === mgrId); if (!mgr) return;
  const { data: mgrNets } = await sb.from('manager_networks').select('*').eq('manager_id', mgrId);
  const capMap = {};
  (mgrNets || []).forEach(mn => { capMap[mn.network_id] = Number(mn.capital || 0); });
  const activeNets = A.nets.filter(n => n.active);

  document.getElementById('capMBody').innerHTML = `
    <div style="padding:9px 12px;background:var(--card2);border:1px solid var(--border2);border-radius:10px;"><div style="font-size:10px;color:var(--muted2);">Gérant</div><div style="font-size:13px;font-weight:700;">${mgr.full_name}</div></div>
    <div style="font-size:11px;color:var(--muted3);">Définissez le capital remis à ce gérant par réseau. Les gérants ne peuvent pas modifier ces valeurs.</div>
    ${activeNets.map(n => `
      <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);">
        <div style="width:9px;height:9px;border-radius:50%;background:${n.color};flex-shrink:0;"></div>
        <div style="flex:1;font-size:12px;font-weight:600;">${n.name}</div>
        <div style="display:flex;align-items:center;gap:4px;background:var(--card2);border:1.5px solid var(--border2);border-radius:8px;padding:6px 9px;width:130px;">
          <input type="number" class="cei" style="width:80px;" value="${capMap[n.id] || 0}" id="cap_${mgrId}_${n.id}" min="0" step="500"><span style="font-size:10px;color:var(--muted2);">FCFA</span>
        </div>
      </div>`).join('')}
    <button class="btn btng" onclick="saveCapitaux('${mgrId}')">💾 Enregistrer</button>`;
  openM('capM');
}

async function saveCapitaux(mgrId) {
  const activeNets = A.nets.filter(n => n.active);
  for (const n of activeNets) {
    const cap = parseFloat(document.getElementById(`cap_${mgrId}_${n.id}`)?.value) || 0;
    const { error } = await sb.from('manager_networks').upsert({ manager_id: mgrId, network_id: n.id, owner_id: A.profile.id, capital: cap }, { onConflict: 'manager_id,network_id' });
    if (error) { toast('❌ Erreur : ' + error.message); return; }
  }
  toast('✅ Capitaux enregistrés !'); closeM('capM');
  await loadOwnerNetCapTotals(); oConf();
}

async function loadOwnerNetCapTotals() {
  const activeMgrIds = A.managers.filter(m => m.status === 'active').map(m => m.id);
  A.netCapMap = {};
  if (activeMgrIds.length > 0) {
    const { data: mgrNets } = await sb.from('manager_networks').select('network_id,capital').in('manager_id', activeMgrIds);
    (mgrNets || []).forEach(mn => { A.netCapMap[mn.network_id] = (A.netCapMap[mn.network_id] || 0) + Number(mn.capital || 0); });
  }
}

async function openMgrD(mgrId) { A.oSubView = 'mgr'; A.viewedMgr = mgrId; A.fD = { s: '', n: 'all', df: '', dt: '' }; A.pendD = ''; renderMgrD(); }

async function renderMgrD() {
  const f = A.fD;
  const mgr = A.managers.find(m => m.id === A.viewedMgr);
  let q = sb.from('transactions').select('*').eq('manager_id', A.viewedMgr).eq('deleted', false);
  if (f.n !== 'all') q = q.eq('network_name', f.n);
  if (f.df) q = q.gte('date', f.df);
  if (f.dt) q = q.lte('date', f.dt);
  const { data: txs } = await q.order('created_at', { ascending: false });

  let rows = txs || [];
  if (f.s) {
    const sq = f.s.toLowerCase();
    rows = rows.filter(t => t.client_phone?.includes(f.s) || t.network_name?.toLowerCase().includes(sq) || OL[t.type]?.toLowerCase().includes(sq));
  }
  const st   = { amt: rows.reduce((a, t) => a + t.amount, 0), comm: rows.reduce((a, t) => a + t.commission, 0), count: rows.length };
  const nets = ['all', ...A.nets.filter(n => n.active).map(n => n.name)];

  document.getElementById('ownerC').innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:11px;cursor:pointer;" onclick="oTab(2)">
      <div style="width:30px;height:30px;border-radius:9px;background:var(--card2);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:13px;">←</div>
      <span style="font-size:12px;color:var(--muted3);">Retour aux gérants</span>
    </div>
    <div style="display:flex;align-items:center;gap:9px;padding:11px;background:rgba(0,232,150,.05);border:1.5px solid rgba(0,232,150,.14);border-radius:12px;margin-bottom:11px;">
      <div style="width:38px;height:38px;border-radius:11px;background:rgba(0,232,150,.12);display:flex;align-items:center;justify-content:center;font-size:18px;">👤</div>
      <div><div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:800;">${mgr?.full_name || '—'}</div><div style="font-size:10px;color:var(--muted2);">@${mgr?.username || ''} · ${mgr?.phone || ''}</div></div>
      <span class="pill pg" style="margin-left:auto;">Actif</span>
    </div>
    <div class="fb">
      <div class="sb-row"><div class="sb"><span style="color:var(--muted2);">🔍</span><input type="text" placeholder="Numéro, réseau, type..." id="mgrDSearch" value="${A.pendD || ''}"></div><button class="search-go" onclick="submitMgrDSearch()">Chercher</button></div>
      <div class="dr"><input class="di" type="date" value="${f.df}" onchange="A.fD.df=this.value;renderMgrD()"><input class="di" type="date" value="${f.dt}" onchange="A.fD.dt=this.value;renderMgrD()"></div>
      <div class="fr">${nets.map(n => `<div class="fc ${f.n === n ? 'on' : ''}" onclick="A.fD.n='${n}';renderMgrD()">${n === 'all' ? 'Tous' : n}</div>`).join('')}</div>
    </div>
    <div class="sg3">
      <div class="sc"><div class="slbl">Mis en jeu</div><div class="sval" style="color:var(--yellow);font-size:13px;">${fmtK(st.amt)} F</div></div>
      <div class="sc"><div class="slbl">Nb Tx</div><div class="sval" style="color:var(--accent2);">${st.count}</div></div>
      <div class="sc"><div class="slbl">Commissions</div><div class="sval" style="color:var(--accent);font-size:13px;">${fmtK(st.comm)} F</div></div>
    </div>
    <div class="card">${rows.length === 0 ? '<div class="empty">Aucune transaction</div>' : rows.slice(0, 20).map(tx => txH(tx, false, {})).join('')}${rows.length > 20 ? `<div style="text-align:center;padding:9px;font-size:11px;color:var(--muted2);">+${rows.length - 20} autres</div>` : ''}</div>`;

  const el = document.getElementById('mgrDSearch');
  if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') submitMgrDSearch(); });
}
function submitMgrDSearch() { const v = document.getElementById('mgrDSearch')?.value?.trim() || ''; A.pendD = v; A.fD.s = v; renderMgrD(); }

async function delMgr(id, name) {
  if (!confirm(`Supprimer le gérant "${name}" ?\n\n⚠️ Cela supprimera définitivement :\n• Son compte\n• Toutes ses transactions\n• Toutes ses demandes\n• Ses données de capital\n\nAction IRRÉVERSIBLE.`)) return;
  await sb.from('transactions').delete().eq('manager_id', id);
  await sb.from('deletion_requests').delete().eq('manager_id', id);
  await sb.from('manager_requests').delete().eq('manager_id', id);
  await sb.from('notifications').delete().eq('user_id', id);
  await sb.from('manager_networks').delete().eq('manager_id', id);
  const { error } = await sb.from('managers').delete().eq('id', id);
  if (error) { toast('❌ ' + error.message); return; }
  toast(`✅ ${name} et toutes ses données supprimés.`);
  const { data: mgrs } = await sb.from('managers').select('*').eq('owner_id', A.profile.id);
  A.managers = mgrs || []; oMgrs();
}

function copyCode() { try { navigator.clipboard.writeText(A.profile.invite_code); } catch {} toast('📋 Code copié : ' + A.profile.invite_code); }

/* ── Onglet 3 : Configuration ── */
async function oConf() {
  await loadOwnerNetCapTotals();
  const netCapMap = A.netCapMap || {};
  const totalCap  = Object.values(netCapMap).reduce((a, v) => a + v, 0);
  const slabCount = netId => (A.slabs[netId] || []).length;

  document.getElementById('ownerC').innerHTML = `
    <div class="sh"><div class="st">Configuration</div></div>

    <div class="card" style="margin-bottom:11px;">
      <div class="sh" style="margin-bottom:8px;"><div class="st" style="font-size:12px;">🏦 Capital global remis aux gérants</div></div>
      <div style="padding:13px;background:rgba(255,201,77,.05);border:1.5px solid rgba(255,201,77,.2);border-radius:var(--r2);margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;">
        <div><div style="font-size:10px;color:var(--muted2);margin-bottom:3px;">TOTAL — tous gérants actifs</div><div style="font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:700;color:var(--yellow);">${fmt(totalCap)} FCFA</div></div>
        <div style="font-size:24px;">🏦</div>
      </div>
      <div style="font-size:10px;color:var(--muted2);margin-bottom:9px;">Détail par réseau</div>
      ${A.nets.map(n => `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);"><div style="width:7px;height:7px;border-radius:50%;background:${n.color};flex-shrink:0;"></div><div style="flex:1;font-size:12px;font-weight:600;">${n.name}</div><div style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:var(--yellow);">${fmt(netCapMap[n.id] || 0)} F</div></div>`).join('')}
      <div style="padding-top:9px;font-size:10px;color:var(--accent2);cursor:pointer;" onclick="oTab(2)">→ Modifier les capitaux par gérant (onglet Gérants 💰)</div>
    </div>

    <div class="card" style="margin-bottom:11px;">
      <div class="sh" style="margin-bottom:7px;"><div class="st" style="font-size:12px;">🌐 Réseaux</div><div class="sa" onclick="openNetAdd()">+ Ajouter</div></div>
      ${A.nets.map(n => `
        <div class="li">
          <div class="liico" style="background:rgba(255,255,255,.03);"><div style="width:9px;height:9px;border-radius:50%;background:${n.color}"></div></div>
          <div class="libody">
            <div class="lititle">${n.name}</div>
            <div class="lisub">Dép ${n.rate_dep}% · Ret ${n.rate_ret}% · Cap: ${fmtK(netCapMap[n.id] || 0)} F · <span style="color:${slabCount(n.id) > 0 ? 'var(--yellow)' : 'var(--red)'};">${slabCount(n.id)} tranche${slabCount(n.id) > 1 ? 's' : ''} retrait</span></div>
          </div>
          <div style="display:flex;align-items:center;gap:5px;">
            <button onclick="openSlabModal('${n.id}','${n.name.replace(/'/g, "\\'")}')" style="padding:3px 7px;border-radius:6px;background:rgba(255,201,77,.1);border:1px solid rgba(255,201,77,.2);color:var(--yellow);font-size:10px;font-weight:700;cursor:pointer;">📊</button>
            <button onclick="openNetEdit('${n.id}')"            style="padding:3px 7px;border-radius:6px;background:rgba(61,139,255,.1);border:1px solid rgba(61,139,255,.2);color:var(--accent2);font-size:10px;font-weight:700;cursor:pointer;">✏️</button>
            <button onclick="deleteNet('${n.id}','${n.name}')" style="padding:3px 7px;border-radius:6px;background:rgba(255,61,90,.1);border:1px solid rgba(255,61,90,.2);color:var(--red);font-size:10px;font-weight:700;cursor:pointer;">🗑️</button>
            <div class="tog ${n.active ? 'on' : 'off'}" onclick="togNet('${n.id}',${!n.active})"></div>
          </div>
        </div>`).join('')}
    </div>

    <div class="card">
      <div class="sh" style="margin-bottom:4px;"><div class="st" style="font-size:12px;">💰 Taux de commissions</div></div>
      <div style="padding:8px 10px;background:rgba(61,139,255,.05);border:1px solid rgba(61,139,255,.15);border-radius:9px;margin-bottom:11px;font-size:10px;color:var(--muted3);line-height:1.6;">
        ⬇️📶📱 Dépôt / Forfait / Crédit : <strong style="color:var(--text);">taux % × montant</strong><br>
        ⬆️ Retrait : <strong style="color:var(--text);">taux % × frais de la tranche</strong>
      </div>
      ${A.nets.filter(n => n.active).map(n => `
        <div style="margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:6px;padding:6px 0 4px;">
            <div style="width:7px;height:7px;border-radius:50%;background:${n.color}"></div>
            <div style="font-family:'Syne',sans-serif;font-size:11px;font-weight:700;">${n.name}</div>
            ${slabCount(n.id) === 0 ? '<span class="pill pr" style="font-size:9px;">⚠️ Aucune tranche retrait</span>' : ''}
          </div>
          ${[{k:'rate_dep',i:'⬇️',l:'Dépôt'},{k:'rate_ret',i:'⬆️',l:'Retrait'},{k:'rate_for',i:'📶',l:'Forfait'},{k:'rate_cre',i:'📱',l:'Crédit'}].map(op =>
            `<div class="cer"><div class="ceico">${op.i}</div><div class="cen">${op.l}${op.k==='rate_ret'?'<span style="font-size:9px;color:var(--muted2);"> (× frais tranche)</span>':''}</div><div class="cew"><input class="cei" type="number" value="${n[op.k]||0}" step="0.5" id="r_${n.id}_${op.k}"><div class="cep">%</div></div></div>`
          ).join('')}
          <div style="height:1px;background:var(--border);margin-top:4px;"></div>
        </div>`).join('')}
      <button class="btn btng" onclick="saveRates()">💾 Enregistrer les taux</button>
    </div>`;
}


/* ─────────────────────────────────────────────
   10. GESTION DES RÉSEAUX
   ───────────────────────────────────────────── */

function openNetAdd() {
  document.getElementById('netMTitle').textContent = '➕ Nouveau réseau';
  document.getElementById('netMBtn').textContent   = '✅ Ajouter';
  document.getElementById('nName').value           = '';
  document.getElementById('nDep').value            = '2.5';
  document.getElementById('nRet').value            = '1.5';
  document.getElementById('editNetId').value       = '';
  A.selColor = '#00d68f';
  initCP(); openM('netM');
}

function openNetEdit(netId) {
  const net = A.nets.find(n => n.id === netId); if (!net) return;
  document.getElementById('netMTitle').textContent = '✏️ Modifier le réseau';
  document.getElementById('netMBtn').textContent   = '💾 Enregistrer';
  document.getElementById('nName').value           = net.name;
  document.getElementById('nDep').value            = net.rate_dep || 2.5;
  document.getElementById('nRet').value            = net.rate_ret || 1.5;
  document.getElementById('editNetId').value       = netId;
  A.selColor = net.color || '#00d68f';
  initCP(net.color); openM('netM');
}

async function saveNet() {
  const name   = document.getElementById('nName')?.value?.trim();
  const dep    = parseFloat(document.getElementById('nDep')?.value) || 2.5;
  const ret    = parseFloat(document.getElementById('nRet')?.value) || 1.5;
  const editId = document.getElementById('editNetId')?.value?.trim();
  if (!name) { toast('⚠️ Entrez un nom'); return; }

  if (editId) {
    const { error } = await sb.from('networks').update({ name, color: A.selColor, rate_dep: dep, rate_ret: ret }).eq('id', editId);
    if (error) { toast('❌ ' + error.message); return; }
    A.nets = A.nets.map(n => n.id === editId ? { ...n, name, color: A.selColor, rate_dep: dep, rate_ret: ret } : n);
    closeM('netM'); oConf(); toast(`✅ "${name}" modifié !`);
  } else {
    const { data, error } = await sb.from('networks').insert({ owner_id: A.profile.id, name, color: A.selColor || '#00d68f', active: true, capital: 0, rate_dep: dep, rate_ret: ret, rate_for: 0, rate_cre: 0 }).select().single();
    if (error) { toast('❌ ' + error.message); return; }
    A.nets.push(data); closeM('netM'); oConf(); toast(`✅ "${name}" ajouté !`);
  }
}

async function deleteNet(netId, netName) {
  if (!confirm(`Supprimer le réseau "${netName}" ?\n\nLes transactions associées restent en base mais ce réseau ne sera plus disponible.\n\nConfirmer ?`)) return;
  const { error } = await sb.from('networks').delete().eq('id', netId);
  if (error) { toast('❌ ' + error.message); return; }
  await sb.from('withdrawal_slabs').delete().eq('network_id', netId);
  delete A.slabs[netId];
  A.nets = A.nets.filter(n => n.id !== netId);
  toast(`🗑️ "${netName}" supprimé.`); oConf();
}

async function saveRates() {
  for (const n of A.nets.filter(x => x.active)) {
    const upd = {};
    ['rate_dep','rate_ret','rate_for','rate_cre'].forEach(k => { const el = document.getElementById(`r_${n.id}_${k}`); if (el) upd[k] = parseFloat(el.value) || 0; });
    await sb.from('networks').update(upd).eq('id', n.id);
    Object.assign(n, upd);
  }
  toast('✅ Taux enregistrés !');
}

async function togNet(id, v) {
  await sb.from('networks').update({ active: v }).eq('id', id);
  A.nets = A.nets.map(n => n.id === id ? { ...n, active: v } : n); oConf();
}

function initCP(selected) {
  document.getElementById('cPicker').innerHTML = NET_COLORS.map(c =>
    `<div class="cdot ${(selected || A.selColor) === c ? 'sel' : ''}" style="background:${c};" onclick="pickC(this,'${c}')"></div>`
  ).join('');
}

function pickC(el, c) {
  document.querySelectorAll('.cdot').forEach(d => d.classList.remove('sel'));
  el.classList.add('sel'); A.selColor = c;
}


/* ─────────────────────────────────────────────
   11. ONGLETS GÉRANT
   ───────────────────────────────────────────── */

function mTab(n) {
  [0, 1, 2].forEach(i => { const e = document.getElementById('mn' + i); e.classList.remove('ab'); if (i === n) e.classList.add('ab'); });
  document.getElementById('managerC').innerHTML = '<div class="loader"><div class="spin"></div></div>';
  [mTx, mHist, mGains][n]();
}

/* ── Onglet 0 : Saisie de transaction ── */
function mTx() {
  const nets = A.nets;
  if (!A.selNet && nets.length) A.selNet = nets[0].name;
  const net  = nets.find(n => n.name === A.selNet) || nets[0];
  const rk   = { dep: 'rate_dep', ret: 'rate_ret', for: 'rate_for', cre: 'rate_cre' }[A.selOp];
  const rate  = net ? net[rk] || 0 : 0;
  const ctr   = COUNTRIES.find(c => c.code === A.selCty) || COUNTRIES[0];
  const OO    = { dep:{i:'⬇️',c:'adep'}, ret:{i:'⬆️',c:'aret'}, for:{i:'📶',c:'afor'}, cre:{i:'📱',c:'acre'} };
  const mgrNetCap = A.mgrNetCaps?.[net?.id] || 0;

  const slabs = net ? (A.slabs[net.id] || []).slice().sort((a, b) => a.min_amount - b.min_amount) : [];
  const commHint = A.selOp === 'ret'
    ? slabs.length > 0
      ? `Taux ${rate}% × frais tranche · Ex: retrait 5 000 F → ${fmt(Math.round((slabs[0]?.fee || 0) * rate / 100))} F commission`
      : `<span style="color:var(--red);">⚠️ Aucune tranche configurée pour ce réseau</span>`
    : `Taux ${rate}% × montant`;

  document.getElementById('managerC').innerHTML = `
    <div style="padding:4px 0 9px;">
      <div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:800;">Nouvelle transaction</div>
      <div style="font-size:11px;color:var(--muted2);">👤 ${A.profile.full_name}${!navigator.onLine ? '<span style="margin-left:6px;padding:2px 7px;border-radius:9px;background:rgba(255,92,56,.12);border:1px solid rgba(255,92,56,.25);color:var(--warn);font-size:9px;">📵 Hors ligne</span>' : ''}</div>
    </div>

    <div style="margin-bottom:10px;"><label class="lbl">Type d'opération</label>
      <div class="opgrid">${Object.entries(OO).map(([k,v]) => `<div class="opcard ${A.selOp===k?v.c:''}" onclick="A.selOp='${k}';mTab(0)"><span class="opico">${v.i}</span><span class="oplbl">${OL[k]}</span></div>`).join('')}</div>
    </div>

    <div style="margin-bottom:10px;"><label class="lbl">Réseau</label>
      <div style="display:flex;gap:5px;flex-wrap:wrap;">${nets.map(n => `<div style="padding:5px 11px;border-radius:20px;font-size:11px;font-weight:700;border:1.5px solid ${A.selNet===n.name?n.color:'var(--border)'};color:${A.selNet===n.name?n.color:'var(--muted2)'};background:var(--card2);cursor:pointer;" onclick="A.selNet='${n.name}';mTab(0)"><span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:${n.color};margin-right:3px;vertical-align:middle;"></span>${n.name}</div>`).join('')}</div>
    </div>

    ${mgrNetCap > 0 ? `<div style="padding:8px 11px;background:rgba(255,201,77,.05);border:1px solid rgba(255,201,77,.15);border-radius:9px;margin-bottom:10px;"><div style="font-size:10px;color:var(--muted2);">Mon capital ${A.selNet||'—'} : <strong style="color:var(--yellow);">${fmt(mgrNetCap)} FCFA</strong></div></div>` : ''}

    <div style="margin-bottom:10px;"><label class="lbl">Numéro client</label>
      <div class="pf-wrap">
        <div class="csel"><span style="font-size:14px;">${ctr.flag}</span><span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted2);">${ctr.prefix}</span><select onchange="A.selCty=this.value;mTab(0)">${COUNTRIES.map(c=>`<option value="${c.code}" ${c.code===A.selCty?'selected':''}>${c.flag} ${c.prefix} ${c.name}</option>`).join('')}</select></div>
        <div class="pf-num"><span class="pf-pre">${ctr.prefix}</span><input type="tel" id="cPhone" placeholder="01 90 92 93 94"></div>
      </div>
    </div>

    <div style="margin-bottom:10px;"><label class="lbl">Montant (FCFA)</label>
      <div class="afield"><input style="background:none;border:none;outline:none;font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:700;color:var(--text);width:100%;" type="number" id="txAmt" placeholder="0" oninput="calcComm('${net?.id}','${A.selOp}',${rate})"><span class="acur">FCFA</span></div>
    </div>

    ${A.selOp==='ret'&&slabs.length>0?`<div style="margin-bottom:9px;padding:8px 10px;background:rgba(255,201,77,.04);border:1px solid rgba(255,201,77,.14);border-radius:9px;"><div style="font-size:9px;font-weight:700;color:var(--muted2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Grille de frais retrait — ${A.selNet}</div>${slabs.map(s=>`<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted3);padding:2px 0;"><span>${fmt(s.min_amount)} – ${s.max_amount!=null?fmt(s.max_amount):'∞'} F</span><span style="color:var(--yellow);font-weight:700;">${fmt(s.fee)} F → <span style="color:var(--accent);">+${fmt(Math.round(s.fee*rate/100))} F</span></span></div>`).join('')}</div>`:'' }

    <div class="cdisp" style="margin-bottom:9px;">
      <div><div style="font-size:11px;color:var(--muted2);">Commission (${OL[A.selOp]} ${A.selNet||'—'})</div><div style="font-size:10px;color:var(--muted);margin-top:1px;">${commHint}</div></div>
      <div style="text-align:right;"><div style="font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;color:var(--accent);" id="commVal">+ 0 F</div><div style="font-size:9px;color:var(--muted2);" id="commFeeDetail"></div></div>
    </div>

    <div class="lock-n">🔒 Transaction verrouillée après validation</div>
    <button class="btn btnb" onclick="subTx('${net?.id}',${rate})">✅ Valider la transaction</button>
    ${getPendingOfflineCount()>0?`<div style="margin-top:9px;padding:8px 11px;background:rgba(255,201,77,.07);border:1px solid rgba(255,201,77,.2);border-radius:9px;font-size:11px;color:var(--yellow);">📤 ${getPendingOfflineCount()} tx en attente de synchronisation</div>`:''}`;
}

/** Recalcule et affiche la commission en temps réel */
function calcComm(networkId, op, rate) {
  const a      = parseFloat(document.getElementById('txAmt')?.value) || 0;
  const elVal  = document.getElementById('commVal');
  const elDet  = document.getElementById('commFeeDetail');
  if (!elVal) return;
  if (a <= 0) { elVal.textContent = '+ 0 F'; if (elDet) elDet.textContent = ''; return; }

  const res = computeComm(op, rate, a, networkId);
  if (res.noSlab) {
    elVal.textContent   = '⚠️ Pas de tranche';
    elVal.style.color   = 'var(--red)';
    if (elDet) elDet.textContent = 'Configurez les tranches dans Config → 📊';
  } else {
    elVal.textContent   = '+ ' + fmt(res.comm) + ' F';
    elVal.style.color   = 'var(--accent)';
    if (elDet) elDet.textContent = (op === 'ret' && res.fee !== undefined) ? `Frais retrait : ${fmt(res.fee)} F → ${rate}% = ${fmt(res.comm)} F` : '';
  }
}

/** Soumet une transaction (online ou offline) */
async function subTx(networkId, rate) {
  const net = A.nets.find(n => n.name === A.selNet);
  if (!net) { toast('⚠️ Sélectionnez un réseau'); return; }

  const amt   = parseFloat(document.getElementById('txAmt')?.value) || 0;
  if (amt <= 0) { toast('⚠️ Montant invalide'); return; }

  const phone = document.getElementById('cPhone')?.value?.trim();
  const ctr   = COUNTRIES.find(c => c.code === A.selCty) || COUNTRIES[0];
  const res   = computeComm(A.selOp, rate, amt, networkId);

  if (res.noSlab && A.selOp === 'ret') {
    toast('⚠️ Aucune tranche retrait configurée pour ce réseau. Contactez votre propriétaire.');
    return;
  }

  const payload = {
    owner_id:       A.profile.owner_id,
    manager_id:     A.profile.id,
    network_name:   net.name,
    network_color:  net.color,
    type:           A.selOp,
    amount:         amt,
    commission:     res.comm,
    rate,
    withdrawal_fee: A.selOp === 'ret' ? (res.fee || 0) : null, // Traçabilité
    client_phone:   phone,
    client_country: A.selCty,
    client_prefix:  ctr.prefix,
    date:           new Date().toISOString().slice(0, 10),
    time:           new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  };

  if (!navigator.onLine) { addOfflineTx(payload); toast('📵 Sauvegardé hors ligne'); mTab(0); return; }

  const { error } = await sb.from('transactions').insert(payload);
  if (error) { toast('❌ Erreur : ' + error.message); return; }
  toast('✅ Transaction validée et verrouillée !'); mTab(0);
}

/* ── Onglet 1 : Historique des saisies ── */
async function mHist() {
  const f = A.fH;
  let q = sb.from('transactions').select('*').eq('manager_id', A.profile.id).eq('deleted', false);
  if (f.n !== 'all') q = q.eq('network_name', f.n);
  if (f.df) q = q.gte('date', f.df);
  if (f.dt) q = q.lte('date', f.dt);
  const { data: txs } = await q.order('created_at', { ascending: false });

  let rows = txs || [];
  if (f.s) rows = rows.filter(t => t.client_phone?.includes(f.s) || t.network_name?.toLowerCase().includes(f.s.toLowerCase()) || OL[t.type]?.toLowerCase().includes(f.s.toLowerCase()));
  const nets = ['all', ...A.nets.map(n => n.name)];

  document.getElementById('managerC').innerHTML = `
    <div style="padding:4px 0 9px;"><div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:800;">📋 Mes saisies</div><div style="font-size:11px;color:var(--muted2);">${A.profile.full_name} 🔒</div></div>
    <div class="fb">
      <div class="sb-row"><div class="sb"><span style="color:var(--muted2);">🔍</span><input type="text" placeholder="Numéro, réseau, type..." id="histSearch" value="${A.pendH||''}"></div><button class="search-go" onclick="submitHistSearch()">Chercher</button></div>
      <div class="dr"><input class="di" type="date" value="${f.df}" onchange="A.fH.df=this.value;mHist()"><input class="di" type="date" value="${f.dt}" onchange="A.fH.dt=this.value;mHist()"></div>
      <div class="fr">${nets.map(n=>`<div class="fc ${f.n===n?'on':''}" onclick="A.fH.n='${n}';mHist()">${n==='all'?'Tous':n}</div>`).join('')}</div>
    </div>
    <div style="font-size:11px;color:var(--muted2);margin-bottom:9px;">${rows.length} résultat${rows.length>1?'s':''}</div>
    ${rows.length===0?'<div class="empty">Aucune transaction</div>':rows.map(tx=>txH(tx,false,{},true)).join('')}`;

  const el = document.getElementById('histSearch');
  if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') submitHistSearch(); });
}
function submitHistSearch() { const v = document.getElementById('histSearch')?.value?.trim()||''; A.pendH=v; A.fH.s=v; mHist(); }

/* ── Onglet 2 : Gains ── */
async function mGains() {
  const f = A.fG;
  let q = sb.from('transactions').select('*').eq('manager_id', A.profile.id).eq('deleted', false);
  if (f.n !== 'all') q = q.eq('network_name', f.n);
  if (f.df) q = q.gte('date', f.df);
  if (f.dt) q = q.lte('date', f.dt);
  const { data: txs } = await q;

  const rows  = txs || [];
  const st    = { amt: rows.reduce((a,t)=>a+t.amount,0), comm: rows.reduce((a,t)=>a+t.commission,0), count: rows.length };
  const byOp  = { dep:{a:0,c:0,n:0}, ret:{a:0,c:0,n:0}, for:{a:0,c:0,n:0}, cre:{a:0,c:0,n:0} };
  rows.forEach(t => { if(byOp[t.type]){byOp[t.type].a+=t.amount;byOp[t.type].c+=t.commission;byOp[t.type].n++;} });
  const nets  = ['all', ...A.nets.map(n => n.name)];

  document.getElementById('managerC').innerHTML = `
    <div style="padding:4px 0 9px;"><div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:800;">💰 Mes gains</div><div style="font-size:11px;color:var(--muted2);">${A.profile.full_name}</div></div>
    <div class="fb"><div class="dr"><input class="di" type="date" value="${f.df}" onchange="A.fG.df=this.value;mGains()"><input class="di" type="date" value="${f.dt}" onchange="A.fG.dt=this.value;mGains()"></div><div class="fr">${nets.map(n=>`<div class="fc ${f.n===n?'on':''}" onclick="A.fG.n='${n}';mGains()">${n==='all'?'Tous':n}</div>`).join('')}</div></div>
    <div style="padding:17px;background:rgba(0,232,150,.05);border:1.5px solid rgba(0,232,150,.16);border-radius:13px;text-align:center;margin-bottom:11px;"><div style="font-size:10px;color:var(--muted2);margin-bottom:4px;">TOTAL COMMISSIONS</div><div style="font-family:'JetBrains Mono',monospace;font-size:28px;font-weight:700;color:var(--accent);">${fmt(st.comm)} F</div><div style="font-size:10px;color:var(--muted2);margin-top:4px;">${st.count} transactions</div></div>
    <div class="sg3"><div class="sc"><div class="slbl">Mis en jeu</div><div class="sval" style="color:var(--yellow);font-size:13px;">${fmtK(st.amt)} F</div></div><div class="sc"><div class="slbl">Nb Tx</div><div class="sval" style="color:var(--accent2);">${st.count}</div></div><div class="sc"><div class="slbl">Commissions</div><div class="sval" style="color:var(--accent);font-size:13px;">${fmtK(st.comm)} F</div></div></div>
    <div class="card"><div style="font-family:'Syne',sans-serif;font-size:12px;font-weight:700;margin-bottom:7px;">Par type</div>
      ${Object.entries(byOp).filter(([,v])=>v.n>0).map(([k,v])=>`<div class="li"><div class="txico ${k}" style="width:31px;height:31px;display:flex;align-items:center;justify-content:center;font-size:14px;">${OI[k]}</div><div class="libody"><div class="lititle">${OL[k]}</div><div class="lisub">${v.n} tx · ${fmtK(v.a)} F mis en jeu</div></div><div style="text-align:right;"><div style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:${OC[k]};">${fmt(v.c)} F</div></div></div>`).join('')||'<div class="empty" style="padding:11px;">Aucune donnée</div>'}
    </div>`;
}

/**
 * Génère le HTML d'un item de transaction.
 *
 * @param {Object}  tx        - Objet transaction
 * @param {boolean} showMgr   - Afficher le nom du gérant (vue propriétaire)
 * @param {Object}  mmap      - Map { managerId: fullName }
 * @param {boolean} showDel   - Afficher le bouton de demande de suppression
 */
function txH(tx, showMgr = false, mmap = {}, showDel = false) {
  const isRet  = tx.type === 'ret';
  const feeNote = isRet && tx.withdrawal_fee != null
    ? `<span class="txp" style="color:var(--yellow);border-color:rgba(255,201,77,.2);background:rgba(255,201,77,.07);">Frais: ${fmt(tx.withdrawal_fee)} F</span>`
    : '';

  return `
    <div class="txitem" ${tx.deleted ? 'style="opacity:.45;"' : ''}>
      <div class="txtop">
        <div class="txico ${tx.deleted ? 'del' : tx.type}">${tx.deleted ? '🗑️' : OI[tx.type]}</div>
        <div class="txti">
          ${OL[tx.type] || '?'} ${tx.network_name || ''}
          ${tx.deleted ? '<span style="color:var(--red);font-size:9px;margin-left:4px;">SUPPRIMÉE</span>' : ''}<br>
          <span style="font-size:10px;color:var(--muted2);font-weight:400;">${fmt(tx.amount)} FCFA</span>
        </div>
        <div style="text-align:right;">
          <div style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:${OC[tx.type]||'var(--muted2)'};">+${fmt(tx.commission)} F</div>
          <div style="font-size:9px;color:var(--muted2);">${tx.rate || 0}%</div>
        </div>
      </div>
      <div class="txpills">
        <span class="txp" style="color:${tx.network_color||'var(--muted2)'};border-color:${tx.network_color||'var(--border2)'}33;background:${tx.network_color||'transparent'}11;">⬤ ${tx.network_name}</span>
        <span class="txp ph">📞 ${tx.client_prefix || '+229'} ${tx.client_phone || '—'}</span>
        <span class="txp">${tx.date} ${tx.time || ''}</span>
        ${feeNote}
        ${showMgr && mmap[tx.manager_id] ? `<span class="txp mgr">👤 ${mmap[tx.manager_id].split(' ')[0]}</span>` : ''}
        ${!tx.deleted ? '<span class="txp" style="color:var(--muted);">🔒</span>' : ''}
        ${showDel && !tx.deleted ? `<span class="txp" style="color:var(--red);border-color:rgba(255,61,90,.2);background:rgba(255,61,90,.07);cursor:pointer;" onclick="openDel('${tx.id}','${OL[tx.type]} ${fmt(tx.amount)} FCFA · ${tx.network_name}')">🗑️ Supprimer</span>` : ''}
      </div>
    </div>`;
}

function openDel(txId, info) {
  A.pendingDelTx = txId;
  document.getElementById('delTxInfo').textContent = info;
  document.getElementById('delReason').value = '';
  openM('delM');
}

async function submitDel() {
  const reason = document.getElementById('delReason')?.value?.trim();
  if (!reason) { toast('⚠️ Expliquez le motif'); return; }
  const { error } = await sb.from('deletion_requests').insert({ transaction_id: A.pendingDelTx, manager_id: A.profile.id, owner_id: A.profile.owner_id, reason });
  if (error) { toast('❌ ' + error.message); return; }
  toast('📤 Demande envoyée au propriétaire !'); closeM('delM');
}


/* ─────────────────────────────────────────────
   12. TRANSACTIONS HORS LIGNE (Offline)
   ─────────────────────────────────────────────
   Les transactions sont sauvegardées dans localStorage
   quand l'appareil n'a pas de connexion, puis
   synchronisées automatiquement dès la reconnexion.
   ───────────────────────────────────────────── */

const OFFLINE_KEY = 'momopoint_offline_txs';

function getOfflineTxs()  { try { return JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]'); } catch { return []; } }
function saveOfflineTxs(txs) { localStorage.setItem(OFFLINE_KEY, JSON.stringify(txs)); }
function getPendingOfflineCount() { return getOfflineTxs().length; }

/** Ajoute une transaction à la file hors ligne */
function addOfflineTx(tx) {
  const txs   = getOfflineTxs();
  const entry = { ...tx, _offline_id: Date.now() + '_' + Math.random().toString(36).slice(2, 6), _pending: true };
  txs.push(entry);
  saveOfflineTxs(txs);
  return entry;
}

/** Tente de synchroniser les transactions hors ligne avec Supabase */
async function syncOfflineTxs() {
  const txs = getOfflineTxs();
  if (!txs.length || !navigator.onLine) return;

  let synced = 0;
  const remaining = [];

  for (const tx of txs) {
    const { _offline_id, _pending, ...payload } = tx;
    const { error } = await sb.from('transactions').insert(payload);
    if (!error) { synced++; } else { remaining.push(tx); }
  }

  saveOfflineTxs(remaining);
  if (synced > 0) {
    toast(`☁️ ${synced} transaction(s) synchronisée(s) !`);
    if (A.role === 'manager') mTab(0);
  }
}

// Synchronisation automatique au retour de connexion
window.addEventListener('online',  () => { toast('🌐 Connexion rétablie — synchronisation...'); setTimeout(syncOfflineTxs, 1200); });
window.addEventListener('offline', () => { toast('📵 Mode hors ligne — vos saisies seront sauvegardées.'); });

/** Charge les capitaux du gérant par réseau */
async function loadMgrNetCaps() {
  if (A.role !== 'manager') return;
  const { data } = await sb.from('manager_networks').select('network_id,capital').eq('manager_id', A.profile.id);
  A.mgrNetCaps = {};
  (data || []).forEach(mn => { A.mgrNetCaps[mn.network_id] = Number(mn.capital || 0); });
}


/* ─────────────────────────────────────────────
   13. INITIALISATION
   ───────────────────────────────────────────── */

// Vérification de session au chargement (reconnexion automatique)
checkSession();

// Synchronisation des transactions offline après 2.5s (si connecté)
if (navigator.onLine) setTimeout(syncOfflineTxs, 2500);
