/* ============================================================
 * Auth pages: login + signup (with OAuth options)
 * ============================================================ */
function authShellHtml(inner) {
  return `
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 p-4">
    <div class="w-full max-w-md">
      <div class="text-center mb-6">
        <img src="/static/logo.png" class="w-16 h-16 mx-auto rounded-2xl bg-white/10 p-2 mb-3" />
        <h1 class="text-2xl font-bold text-white">JBCHUSA</h1>
        <p class="text-blue-200 text-sm mt-1">교인관리시스템</p>
      </div>
      <div class="bg-white rounded-2xl shadow-2xl p-7">${inner}</div>
      <p class="text-center text-blue-200 text-xs mt-6">© JBCHUSA Church Management System</p>
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
    <h2 class="text-xl font-bold text-slate-800 mb-1">로그인</h2>
    <p class="text-sm text-slate-500 mb-5">계정으로 로그인하세요.</p>
    <form id="login-form" class="space-y-3">
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1">아이디 또는 이메일</label>
        <input name="username" required class="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500" placeholder="admin" />
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1">비밀번호</label>
        <input name="password" type="password" required class="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500" placeholder="••••••••" />
      </div>
      <button type="submit" class="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-lg transition">로그인</button>
    </form>
    <div class="flex items-center gap-3 my-5"><div class="flex-1 h-px bg-slate-200"></div><span class="text-xs text-slate-400">외부 계정으로 로그인</span><div class="flex-1 h-px bg-slate-200"></div></div>
    ${oauthButtons()}
    <p class="text-center text-sm text-slate-500 mt-6">계정이 없으신가요? <a href="#/signup" class="text-brand-600 font-semibold">회원가입</a></p>
    <div class="mt-4 text-center text-[11px] text-slate-400">데모 계정: <b>admin</b> / <b>admin1234</b></div>
  `);

  el('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch spin"></i>';
    try {
      const { data } = await api.post('/auth/login', { username: fd.get('username'), password: fd.get('password') });
      App.state.user = data.user;
      toast('로그인 성공', 'success');
      location.hash = '#/dashboard';
    } catch (err) {
      toast(err.response?.data?.error || '로그인 실패', 'error');
      btn.disabled = false; btn.textContent = '로그인';
    }
  });
};

Pages.signup = function () {
  const app = el('app');
  app.dataset.shell = '';
  app.innerHTML = authShellHtml(`
    <h2 class="text-xl font-bold text-slate-800 mb-1">회원가입</h2>
    <p class="text-sm text-slate-500 mb-5">새 계정을 만드세요.</p>
    <form id="signup-form" class="space-y-3">
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1">이름 *</label>
        <input name="display_name" required class="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500" placeholder="홍길동" />
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1">아이디 *</label>
        <input name="username" required class="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500" placeholder="user01" />
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1">이메일</label>
        <input name="email" type="email" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500" placeholder="user@example.com" />
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1">비밀번호 * (6자 이상)</label>
        <input name="password" type="password" required minlength="6" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500" placeholder="••••••••" />
      </div>
      <button type="submit" class="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-lg transition">가입하기</button>
    </form>
    <div class="flex items-center gap-3 my-5"><div class="flex-1 h-px bg-slate-200"></div><span class="text-xs text-slate-400">외부 계정으로 가입</span><div class="flex-1 h-px bg-slate-200"></div></div>
    ${oauthButtons()}
    <p class="text-center text-sm text-slate-500 mt-6">이미 계정이 있으신가요? <a href="#/login" class="text-brand-600 font-semibold">로그인</a></p>
  `);

  el('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch spin"></i>';
    try {
      const { data } = await api.post('/auth/signup', Object.fromEntries(fd));
      App.state.user = data.user;
      toast('가입 완료', 'success');
      location.hash = '#/dashboard';
    } catch (err) {
      toast(err.response?.data?.error || '가입 실패', 'error');
      btn.disabled = false; btn.textContent = '가입하기';
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
      <h3 class="text-lg font-bold">${labels[provider]} 계정으로 계속</h3>
    </div>
    <p class="text-sm text-slate-500 mb-4">실제 서비스에서는 ${labels[provider]} 로그인 화면으로 이동합니다. 데모에서는 연동할 이메일을 입력하세요.</p>
    <form id="oauth-form" class="space-y-3">
      <input name="name" class="w-full px-3 py-2.5 border rounded-lg" placeholder="이름 (선택)" />
      <input name="email" type="email" required class="w-full px-3 py-2.5 border rounded-lg" placeholder="${provider}-user@example.com" />
      <div class="flex gap-2 pt-1">
        <button type="button" onclick="closeModal()" class="flex-1 py-2.5 rounded-lg border text-slate-600">취소</button>
        <button type="submit" class="flex-1 py-2.5 rounded-lg bg-brand-600 text-white font-semibold">계속</button>
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
      toast('로그인 성공', 'success');
      location.hash = '#/dashboard';
    } catch (err) {
      toast(err.response?.data?.error || '실패', 'error');
    }
  });
}
