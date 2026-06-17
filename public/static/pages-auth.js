/* ============================================================
 * Auth pages: login + signup (with OAuth options)
 * ============================================================ */
function authShellHtml(inner) {
  return `
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 p-4">
    <div class="w-full max-w-md">
      <div class="flex justify-end mb-3">
        <select onchange="setLang(this.value)" title="Language" class="text-xs rounded-lg border bg-white/10 text-white border-white/20 px-2 py-1.5 cursor-pointer focus:outline-none">${I18N.langOptionsHtml()}</select>
      </div>
      <div class="text-center mb-6">
        <img src="/static/logo.png" class="w-16 h-16 mx-auto rounded-2xl bg-white/10 p-2 mb-3" />
        <h1 class="text-2xl font-bold text-white">JBCHUSA</h1>
        <p class="text-blue-200 text-sm mt-1">${t('app.subtitle')}</p>
      </div>
      <div class="bg-white rounded-2xl shadow-2xl p-7">${inner}</div>
      <p class="text-center text-blue-200 text-xs mt-6">© ${t('app.footer')}</p>
    </div>
  </div>`;
}

function oauthButtons() {
  const providers = [
    { id:'google',   label:'Google',   icon:'fa-google',     color:'text-red-500',   brand:'bg-white border' },
    { id:'facebook', label:'Facebook', icon:'fa-facebook-f', color:'text-white',     brand:'bg-[#1877f2] text-white border-transparent' },
    { id:'instagram',label:'Instagram',icon:'fa-instagram',  color:'text-white',     brand:'bg-gradient-to-r from-purple-500 via-pink-500 to-amber-400 text-white border-transparent' },
    { id:'outlook',  label:'Outlook',  icon:'fa-microsoft',  color:'text-[#0078d4]', brand:'bg-white border' },
  ];
  return `<div class="grid grid-cols-2 gap-2.5">${providers.map((p) => `
    <button onclick="oauthLogin('${p.id}')" class="flex items-center justify-center gap-2 py-2.5 rounded-lg ${p.brand} text-sm font-medium hover:opacity-90 transition">
      <i class="fab ${p.icon} ${p.brand.includes('text-white')?'':p.color}"></i><span>${p.label}</span>
    </button>`).join('')}</div>`;
}

Pages.login = function () {
  const app = el('app');
  app.dataset.shell = '';
  app.innerHTML = authShellHtml(`
    <h2 class="text-xl font-bold text-slate-800 mb-1">${t('auth.login')}</h2>
    <p class="text-sm text-slate-500 mb-5">${t('auth.login_desc')}</p>
    <form id="login-form" class="space-y-3">
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1">${t('auth.id_or_email')}</label>
        <input name="username" required class="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500" placeholder="admin" />
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1">${t('auth.password')}</label>
        <input name="password" type="password" required class="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500" placeholder="••••••••" />
      </div>
      <button type="submit" class="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-lg transition">${t('auth.login')}</button>
    </form>
    <div class="flex items-center gap-3 my-5"><div class="flex-1 h-px bg-slate-200"></div><span class="text-xs text-slate-400">${t('auth.login_with_external')}</span><div class="flex-1 h-px bg-slate-200"></div></div>
    ${oauthButtons()}
    <p class="text-center text-sm text-slate-500 mt-6">${t('auth.no_account')} <a href="#/signup" class="text-brand-600 font-semibold">${t('auth.signup')}</a></p>
    <div class="mt-4 text-center text-[11px] text-slate-400">${t('auth.demo_account')} <b>admin</b> / <b>admin1234</b></div>
  `);

  el('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch spin"></i>';
    try {
      const { data } = await api.post('/auth/login', { username: fd.get('username'), password: fd.get('password') });
      App.state.user = data.user;
      toast(t('auth.login_success'), 'success');
      location.hash = '#/dashboard';
    } catch (err) {
      toast(err.response?.data?.error || t('auth.login_failed'), 'error');
      btn.disabled = false; btn.textContent = t('auth.login');
    }
  });
};

Pages.signup = function () {
  const app = el('app');
  app.dataset.shell = '';
  app.innerHTML = authShellHtml(`
    <h2 class="text-xl font-bold text-slate-800 mb-1">${t('auth.signup')}</h2>
    <p class="text-sm text-slate-500 mb-5">${t('auth.signup_desc')}</p>
    <form id="signup-form" class="space-y-3">
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1">${t('auth.name')} *</label>
        <input name="display_name" required class="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500" placeholder="홍길동" />
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1">${t('auth.id')} *</label>
        <input name="username" required class="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500" placeholder="user01" />
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1">${t('auth.email')}</label>
        <input name="email" type="email" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500" placeholder="user@example.com" />
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1">${t('auth.password_min')}</label>
        <input name="password" type="password" required minlength="6" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500" placeholder="••••••••" />
      </div>
      <button type="submit" class="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-lg transition">${t('auth.do_signup')}</button>
    </form>
    <div class="flex items-center gap-3 my-5"><div class="flex-1 h-px bg-slate-200"></div><span class="text-xs text-slate-400">${t('auth.signup_with_external')}</span><div class="flex-1 h-px bg-slate-200"></div></div>
    ${oauthButtons()}
    <p class="text-center text-sm text-slate-500 mt-6">${t('auth.have_account')} <a href="#/login" class="text-brand-600 font-semibold">${t('auth.login')}</a></p>
  `);

  el('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch spin"></i>';
    try {
      const { data } = await api.post('/auth/signup', Object.fromEntries(fd));
      App.state.user = data.user;
      toast(t('auth.signup_done'), 'success');
      location.hash = '#/dashboard';
    } catch (err) {
      toast(err.response?.data?.error || t('auth.signup_failed'), 'error');
      btn.disabled = false; btn.textContent = t('auth.do_signup');
    }
  });
};

/* OAuth demo flow: in production this redirects to provider; here we collect the email
   the provider would return, and provision/link the account server-side. */
async function oauthLogin(provider) {
  const labels = { google:'Google', facebook:'Facebook', instagram:'Instagram', outlook:'Outlook' };
  const box = h(`<div class="p-6">
    <div class="flex items-center gap-3 mb-4">
      <i class="fab fa-${provider==='outlook'?'microsoft':provider} text-2xl"></i>
      <h3 class="text-lg font-bold">${t('auth.oauth_continue', { p: labels[provider] })}</h3>
    </div>
    <p class="text-sm text-slate-500 mb-4">${t('auth.oauth_desc', { p: labels[provider] })}</p>
    <form id="oauth-form" class="space-y-3">
      <input name="name" class="w-full px-3 py-2.5 border rounded-lg" placeholder="${t('auth.name_optional')}" />
      <input name="email" type="email" required class="w-full px-3 py-2.5 border rounded-lg" placeholder="${provider}-user@example.com" />
      <div class="flex gap-2 pt-1">
        <button type="button" onclick="closeModal()" class="flex-1 py-2.5 rounded-lg border text-slate-600">${t('common.cancel')}</button>
        <button type="submit" class="flex-1 py-2.5 rounded-lg bg-brand-600 text-white font-semibold">${t('common.continue')}</button>
      </div>
    </form>
  </div>`);
  openModal(box, { size:'max-w-md' });
  box.querySelector('#oauth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const { data } = await api.post(`/auth/oauth/${provider}`, { email: fd.get('email'), name: fd.get('name'), sub: `${provider}_${Date.now()}` });
      App.state.user = data.user;
      closeModal();
      toast(t('auth.login_success'), 'success');
      location.hash = '#/dashboard';
    } catch (err) {
      toast(err.response?.data?.error || t('common.failed'), 'error');
    }
  });
}
