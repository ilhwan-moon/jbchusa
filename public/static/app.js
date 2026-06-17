/* ============================================================
 * JBCHUSA Church Management System - Frontend SPA
 * ============================================================ */
const App = {
  state: { user: null, route: '#/login', params: {} },
};

const api = axios.create({ baseURL: '/api' });

/* ---------- helpers ---------- */
const $ = (sel, el = document) => el.querySelector(sel);
const el = (id) => document.getElementById(id);
function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
function initials(first, last) { return ((first||'?')[0] + (last||'')[0] || '?').toUpperCase(); }

function toast(msg, type = 'info') {
  const colors = { info:'bg-slate-800', success:'bg-emerald-600', error:'bg-red-600', warn:'bg-amber-500' };
  const t = h(`<div class="${colors[type]} text-white px-4 py-2.5 rounded-lg shadow-lg fade-in text-sm flex items-center gap-2">
    <i class="fas ${type==='success'?'fa-check-circle':type==='error'?'fa-exclamation-circle':'fa-info-circle'}"></i>
    <span>${esc(msg)}</span></div>`);
  el('toast-root').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, 2800);
}

function openModal(contentEl, opts = {}) {
  const root = el('modal-root');
  const overlay = h(`<div class="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/50 p-3 overflow-y-auto fade-in"></div>`);
  const box = h(`<div class="bg-white rounded-2xl shadow-2xl w-full ${opts.size || 'max-w-lg'} my-6"></div>`);
  box.appendChild(contentEl);
  overlay.appendChild(box);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  root.innerHTML = '';
  root.appendChild(overlay);
  return overlay;
}
function closeModal() { el('modal-root').innerHTML = ''; }

function loadingHtml(text = '불러오는 중...') {
  return `<div class="flex items-center justify-center py-20 text-slate-400"><i class="fas fa-circle-notch spin text-2xl mr-3"></i>${text}</div>`;
}

function avatar(photo, first, last, size = 'w-10 h-10') {
  if (photo) return `<img src="${esc(photo)}" class="${size} rounded-full object-cover border border-slate-200" />`;
  return `<div class="${size} rounded-full avatar-ph flex items-center justify-center font-bold text-sm">${esc(initials(first,last))}</div>`;
}

const CATEGORY_META = {
  PARISH:     { icon:'fa-map-location-dot', color:'text-blue-600', label:'교구구역' },
  FELLOWSHIP: { icon:'fa-people-group',     color:'text-purple-600', label:'교제부서' },
  SCHOOL:     { icon:'fa-graduation-cap',   color:'text-amber-600', label:'교회학교' },
  MINISTRY:   { icon:'fa-hands-praying',    color:'text-emerald-600', label:'봉사부서' },
  STAFF:      { icon:'fa-briefcase',        color:'text-slate-600', label:'직원' },
};

function statusBadge(status) {
  const map = { '활동':'bg-emerald-100 text-emerald-700','휴면':'bg-amber-100 text-amber-700','이전':'bg-slate-100 text-slate-600','사망':'bg-slate-200 text-slate-500' };
  return `<span class="badge ${map[status]||'bg-slate-100 text-slate-600'}">${esc(status)}</span>`;
}

/* ---------- auth bootstrap ---------- */
async function loadMe() {
  try { const { data } = await api.get('/auth/me'); App.state.user = data.user; }
  catch { App.state.user = null; }
}

/* ---------- router ---------- */
function parseHash() {
  const hash = location.hash || '#/login';
  const [path, query] = hash.split('?');
  const parts = path.replace(/^#\//, '').split('/');
  const params = {};
  if (query) query.split('&').forEach((p) => { const [k,v]=p.split('='); params[k]=decodeURIComponent(v||''); });
  return { name: parts[0] || 'dashboard', sub: parts.slice(1), params };
}

async function router() {
  const r = parseHash();
  // not logged in -> force login/signup
  if (!App.state.user && !['login','signup'].includes(r.name)) { location.hash = '#/login'; return; }
  if (App.state.user && ['login','signup'].includes(r.name)) { location.hash = '#/dashboard'; return; }

  if (r.name === 'login') return Pages.login();
  if (r.name === 'signup') return Pages.signup();

  renderLayout(r.name);
  const content = el('page-content');
  content.innerHTML = loadingHtml();
  try {
    switch (r.name) {
      case 'dashboard': return Pages.dashboard(content);
      case 'orgs': return Pages.orgs(content, r.sub[0], r.sub[1]);
      case 'attendance': return Pages.attendance(content, r.sub);
      case 'addressbook': return Pages.addressbook(content);
      case 'members': return Pages.memberDetail(content, r.sub[0]);
      case 'households': return Pages.households(content, r.sub[0]);
      case 'admin': return Pages.admin(content, r.sub[0] || 'users');
      default: content.innerHTML = '<div class="p-8 text-center text-slate-400">페이지를 찾을 수 없습니다.</div>';
    }
  } catch (e) {
    console.error(e);
    content.innerHTML = `<div class="p-8 text-center text-red-500">오류가 발생했습니다: ${esc(e.message)}</div>`;
  }
}

window.addEventListener('hashchange', router);

/* ---------- lazy Chart.js loader (so slow CDN never blocks app boot) ---------- */
let __chartPromise = null;
function ensureChart() {
  if (typeof Chart !== 'undefined') return Promise.resolve(true);
  if (__chartPromise) return __chartPromise;
  __chartPromise = new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
  return __chartPromise;
}

function hideBoot() {
  const b = el('boot');
  if (b) { b.style.opacity = '0'; setTimeout(() => b.remove(), 300); }
}

/* ---------- start ---------- */
(async function start() {
  try {
    await loadMe();
  } catch (e) {
    console.error('init failed', e);
  } finally {
    hideBoot();
  }
  if (!location.hash) location.hash = App.state.user ? '#/dashboard' : '#/login';
  router();
})();
