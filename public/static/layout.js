/* ============================================================
 * Layout: sidebar + topbar + Pages namespace
 * ============================================================ */
window.Pages = window.Pages || {};

const NAV = [
  { name:'dashboard',   label:'대시보드',   icon:'fa-gauge-high' },
  { name:'orgs/PARISH', label:'교구구역',   icon:'fa-map-location-dot', match:'orgs' },
  { name:'orgs/FELLOWSHIP', label:'교제부서', icon:'fa-people-group', match:'orgs' },
  { name:'orgs/SCHOOL', label:'교회학교',   icon:'fa-graduation-cap', match:'orgs' },
  { name:'orgs/MINISTRY', label:'봉사부서', icon:'fa-hands-praying', match:'orgs' },
  { name:'attendance',  label:'출석관리',   icon:'fa-clipboard-check' },
  { name:'addressbook', label:'주소록',     icon:'fa-address-book' },
  { name:'households',  label:'가족관리',   icon:'fa-house-user' },
  { name:'admin/users', label:'관리자',     icon:'fa-screwdriver-wrench', match:'admin', adminOnly:true },
];

function hasPerm(perm) {
  const u = App.state.user; if (!u) return false;
  return u.roles.includes('SUPER_ADMIN') || u.permissions.includes(perm);
}
function isAdmin() {
  const u = App.state.user; if (!u) return false;
  return u.roles.includes('SUPER_ADMIN') || u.permissions.includes('user.manage');
}

function renderLayout(activeName) {
  const u = App.state.user;
  const app = el('app');
  if (app.dataset.shell === '1') { highlightNav(activeName); return; }
  app.dataset.shell = '1';

  const navItems = NAV.filter((n) => !n.adminOnly || isAdmin()).map((n) => {
    return `<a href="#/${n.name}" data-nav="${n.match || n.name}" class="nav-link flex items-center gap-3 px-4 py-2.5 rounded-lg text-blue-100 hover:bg-white/10 transition text-sm font-medium">
      <i class="fas ${n.icon} w-5 text-center text-blue-200"></i><span>${n.label}</span></a>`;
  }).join('');

  app.innerHTML = `
  <div class="min-h-screen flex">
    <!-- Sidebar (desktop) -->
    <aside id="sidebar" class="hidden md:flex md:flex-col w-64 bg-brand-900 fixed inset-y-0 left-0 z-40">
      <div class="flex items-center gap-3 px-5 h-16 border-b border-white/10">
        <img src="/static/logo.png" class="w-9 h-9 rounded-lg bg-white/10 p-1" />
        <div class="text-white"><div class="font-bold leading-tight">JBCHUSA</div><div class="text-[11px] text-blue-200">교인관리시스템</div></div>
      </div>
      <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">${navItems}</nav>
      <div class="p-3 border-t border-white/10">
        <div class="flex items-center gap-3 px-2 py-2 text-blue-100">
          <div class="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center font-bold text-white">${esc((u.display_name||u.username)[0])}</div>
          <div class="flex-1 min-w-0"><div class="text-sm text-white truncate">${esc(u.display_name||u.username)}</div><div class="text-[11px] text-blue-200 truncate">${esc(u.roles[0]||'MEMBER')}</div></div>
          <button onclick="doLogout()" class="text-blue-200 hover:text-white" title="로그아웃"><i class="fas fa-right-from-bracket"></i></button>
        </div>
      </div>
    </aside>

    <!-- Mobile drawer -->
    <div id="mobile-drawer" class="fixed inset-0 z-50 hidden md:hidden">
      <div class="absolute inset-0 bg-black/50" onclick="toggleDrawer(false)"></div>
      <aside class="absolute inset-y-0 left-0 w-64 bg-brand-900 flex flex-col">
        <div class="flex items-center gap-3 px-5 h-16 border-b border-white/10">
          <img src="/static/logo.png" class="w-9 h-9 rounded-lg bg-white/10 p-1" />
          <div class="text-white"><div class="font-bold">JBCHUSA</div></div>
        </div>
        <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">${navItems}</nav>
        <div class="p-3 border-t border-white/10">
          <button onclick="doLogout()" class="w-full text-left px-3 py-2 text-blue-100 text-sm"><i class="fas fa-right-from-bracket mr-2"></i>로그아웃</button>
        </div>
      </aside>
    </div>

    <!-- Main -->
    <div class="flex-1 md:ml-64 flex flex-col min-h-screen">
      <header class="h-16 bg-white border-b border-slate-200 flex items-center px-4 md:px-6 sticky top-0 z-30">
        <button class="md:hidden text-slate-600 mr-3 text-xl" onclick="toggleDrawer(true)"><i class="fas fa-bars"></i></button>
        <h1 id="page-title" class="text-lg font-bold text-slate-800">대시보드</h1>
        <div class="ml-auto flex items-center gap-2">
          <a href="#/addressbook" class="md:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600"><i class="fas fa-search"></i></a>
        </div>
      </header>
      <main id="page-content" class="flex-1 p-4 md:p-6"></main>
      <footer class="text-center text-xs text-slate-400 py-4">JBCHUSA Church Management System</footer>
    </div>
  </div>`;

  // close drawer on nav click (mobile)
  app.querySelectorAll('#mobile-drawer a').forEach((a) => a.addEventListener('click', () => toggleDrawer(false)));
  highlightNav(activeName);
}

function highlightNav(activeName) {
  const r = parseHash();
  const key = r.name === 'orgs' ? `orgs/${r.params.cat || ''}` : r.name;
  document.querySelectorAll('.nav-link').forEach((a) => {
    a.classList.remove('active');
  });
  // match by href containing current route
  const cur = location.hash.replace('#/','');
  document.querySelectorAll('.nav-link').forEach((a) => {
    const href = a.getAttribute('href').replace('#/','');
    if (href === cur || (href.split('/')[0] === cur.split('/')[0] && href.split('/')[1] === cur.split('/')[1])) a.classList.add('active');
    else if (href.split('/')[0] === cur.split('/')[0] && !href.includes('/') ) a.classList.add('active');
  });
  const titleMap = { dashboard:'대시보드', attendance:'출석관리', addressbook:'주소록', households:'가족관리', admin:'관리자', members:'교인 상세', orgs:'조직 조회' };
  const t = el('page-title'); if (t) t.textContent = titleMap[r.name] || 'JBCHUSA';
}

function toggleDrawer(show) {
  const d = el('mobile-drawer'); if (!d) return;
  d.classList.toggle('hidden', !show);
}

async function doLogout() {
  await api.post('/auth/logout');
  App.state.user = null;
  el('app').dataset.shell = '';
  location.hash = '#/login';
  location.reload();
}
