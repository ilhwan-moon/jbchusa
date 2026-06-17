/* ============================================================
 * Misc pages: dashboard, address book, households, admin
 * ============================================================ */

/* ---------------- Dashboard ---------------- */
Pages.dashboard = async function (content) {
  content.innerHTML = loadingHtml();
  const [{ data: cats }, { data: att }, { data: mem }] = await Promise.all([
    api.get('/orgs/categories'),
    api.get('/attendance/dashboard'),
    api.get('/members', { params: {} }),
  ]);
  const u = App.state.user;

  const catCards = (cats.categories||[]).map((c) => {
    const meta = CATEGORY_META[c.code] || {};
    return `<a href="#/orgs/${c.code}" class="card p-5 hover:shadow-md transition group">
      <div class="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center ${meta.color||''} group-hover:scale-105 transition"><i class="fas ${meta.icon||'fa-folder'} text-xl"></i></div>
      <div class="mt-3 font-bold text-slate-800">${esc(c.name)}</div>
      <div class="text-xs text-slate-400">${esc(c.description||'')}</div>
    </a>`;
  }).join('');

  content.innerHTML = `
    <div class="bg-gradient-to-r from-brand-700 to-brand-500 rounded-2xl p-6 text-white mb-5">
      <h2 class="text-2xl font-bold">안녕하세요, ${esc(u.display_name||u.username)}님 👋</h2>
      <p class="text-blue-100 text-sm mt-1">JBCHUSA 교인관리시스템에 오신 것을 환영합니다.</p>
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      ${statCard('전체 교인','fa-users','text-brand-600', mem.members.length)}
      ${statCard('활동 교인','fa-user-check','text-emerald-600', att.totalMembers)}
      ${statCard('등록 모임','fa-calendar','text-purple-600', att.totalMeetings)}
      ${statCard('조직','fa-sitemap','text-amber-600', (cats.categories||[]).length)}
    </div>

    <h3 class="font-bold text-slate-700 mb-3">조직 바로가기</h3>
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">${catCards}</div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="card p-5">
        <div class="flex items-center justify-between mb-3"><h3 class="font-bold text-slate-700">최근 모임</h3><a href="#/attendance" class="text-xs text-brand-600">전체보기</a></div>
        <div class="space-y-2">${(att.recentMeetings||[]).slice(0,5).map(meetingRow).join('') || '<div class="text-sm text-slate-400 py-4 text-center">모임 없음</div>'}</div>
      </div>
      <div class="card p-5">
        <div class="flex items-center justify-between mb-3"><h3 class="font-bold text-slate-700">빠른 메뉴</h3></div>
        <div class="grid grid-cols-2 gap-2">
          <a href="#/addressbook" class="p-4 rounded-xl bg-slate-50 hover:bg-brand-50 text-center"><i class="fas fa-address-book text-brand-600 text-xl"></i><div class="text-sm font-medium text-slate-700 mt-2">주소록</div></a>
          <a href="#/households" class="p-4 rounded-xl bg-slate-50 hover:bg-brand-50 text-center"><i class="fas fa-house-user text-brand-600 text-xl"></i><div class="text-sm font-medium text-slate-700 mt-2">가족관리</div></a>
          <a href="#/attendance" class="p-4 rounded-xl bg-slate-50 hover:bg-brand-50 text-center"><i class="fas fa-clipboard-check text-brand-600 text-xl"></i><div class="text-sm font-medium text-slate-700 mt-2">출석관리</div></a>
          ${isAdmin()?`<a href="#/admin/users" class="p-4 rounded-xl bg-slate-50 hover:bg-brand-50 text-center"><i class="fas fa-screwdriver-wrench text-brand-600 text-xl"></i><div class="text-sm font-medium text-slate-700 mt-2">관리자</div></a>`:`<a href="#/orgs/PARISH" class="p-4 rounded-xl bg-slate-50 hover:bg-brand-50 text-center"><i class="fas fa-map-location-dot text-brand-600 text-xl"></i><div class="text-sm font-medium text-slate-700 mt-2">교구구역</div></a>`}
        </div>
      </div>
    </div>`;
};

/* ---------------- Address Book ---------------- */
Pages.addressbook = async function (content) {
  const canEdit = hasPerm('member.edit');
  content.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div><h2 class="text-xl font-bold text-slate-800">주소록</h2><p class="text-sm text-slate-500">전체 교인을 조회합니다.</p></div>
      ${canEdit?`<button onclick="editMember(null)" class="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"><i class="fas fa-user-plus mr-1"></i>교인 등록</button>`:''}
    </div>
    <div class="card p-3 mb-4">
      <div class="flex gap-2">
        <div class="relative flex-1"><i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input id="ab-search" placeholder="이름으로 검색..." class="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg" /></div>
        <select id="ab-status" class="px-3 py-2.5 border border-slate-200 rounded-lg text-sm"><option value="">전체상태</option><option>활동</option><option>휴면</option><option>이전</option></select>
      </div>
    </div>
    <div id="ab-list">${loadingHtml('')}</div>`;

  async function load() {
    const q = el('ab-search').value.trim();
    const status = el('ab-status').value;
    const { data } = await api.get('/members', { params: { q, status } });
    const list = el('ab-list');
    if (!data.members.length) { list.innerHTML = '<div class="card p-12 text-center text-slate-400"><i class="fas fa-user-slash text-2xl mb-2"></i><p>교인이 없습니다.</p></div>'; return; }
    list.innerHTML = `<div class="text-xs text-slate-400 mb-2 px-1">${data.members.length}명</div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">${data.members.map(abCard).join('')}</div>`;
  }
  function abCard(m) {
    const name = m.korean_name || `${m.first_name} ${m.last_name}`;
    return `<a href="#/members/${m.member_id}" class="card p-3 flex items-center gap-3 hover:border-brand-300 hover:shadow-sm transition">
      ${avatar(m.photo_url, m.first_name, m.last_name, 'w-11 h-11')}
      <div class="flex-1 min-w-0">
        <div class="font-semibold text-slate-800 text-sm truncate">${esc(name)} ${m.title?`<span class="text-xs text-slate-400 font-normal">${esc(m.title)}</span>`:''}</div>
        <div class="text-xs text-slate-500 truncate">${m.mobile?`<i class="fas fa-phone text-[10px] mr-1"></i>${esc(m.mobile)}`:(m.email?esc(m.email):(m.household_name||''))}</div>
      </div>
      ${statusBadge(m.status)}
    </a>`;
  }
  let timer;
  el('ab-search').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 250); });
  el('ab-status').addEventListener('change', load);
  load();
};

/* ---------------- Households ---------------- */
Pages.households = async function (content, id) {
  if (id) return householdDetail(content, id);
  const canEdit = hasPerm('member.edit');
  content.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div><h2 class="text-xl font-bold text-slate-800">가족(세대) 관리</h2><p class="text-sm text-slate-500">세대별 가족 구성원을 관리합니다.</p></div>
      ${canEdit?`<button onclick="createHousehold()" class="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"><i class="fas fa-plus mr-1"></i>세대 등록</button>`:''}
    </div>
    <div class="card p-3 mb-4"><div class="relative"><i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
      <input id="hh-search" placeholder="세대 검색..." class="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg" /></div></div>
    <div id="hh-list">${loadingHtml('')}</div>`;

  async function load() {
    const q = el('hh-search').value.trim();
    const { data } = await api.get('/households', { params: { q } });
    const list = el('hh-list');
    if (!data.households.length) { list.innerHTML = '<div class="card p-12 text-center text-slate-400">세대가 없습니다.</div>'; return; }
    list.innerHTML = `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">${data.households.map((hh)=>`
      <a href="#/households/${hh.household_id}" class="card p-4 hover:border-brand-300 hover:shadow-sm transition">
        <div class="flex items-center gap-3"><div class="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center"><i class="fas fa-house-user"></i></div>
          <div class="flex-1 min-w-0"><div class="font-bold text-slate-800 truncate">${esc(hh.household_name)}</div><div class="text-xs text-slate-400">${esc([hh.city,hh.state].filter(Boolean).join(', ')||'주소 미등록')}</div></div>
          <span class="badge bg-slate-100 text-slate-500">${hh.member_count}명</span></div>
      </a>`).join('')}</div>`;
  }
  let timer; el('hh-search').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 250); });
  load();
};

async function householdDetail(content, id) {
  content.innerHTML = loadingHtml();
  const { data } = await api.get(`/households/${id}`);
  const hh = data.household;
  const canEdit = hasPerm('member.edit');
  const fullAddr = [hh.address_line1, hh.address_line2, hh.city, hh.state, hh.zip_code].filter(Boolean).join(', ');
  const mapsUrl = fullAddr ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddr)}` : null;
  const roleLabel = { head:'세대주', spouse:'배우자', child:'자녀', parent:'부모', relative:'친척', other:'기타' };

  content.innerHTML = `
    <div class="mb-4"><a href="#/households" class="text-sm text-slate-500 hover:text-brand-600"><i class="fas fa-arrow-left mr-1"></i>세대 목록</a></div>
    <div class="card p-6 mb-4">
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center text-2xl"><i class="fas fa-house-user"></i></div>
          <div><h2 class="text-xl font-bold text-slate-800">${esc(hh.household_name)}</h2>
            ${fullAddr?`<a href="${mapsUrl}" target="_blank" class="text-sm text-blue-600 hover:underline"><i class="fas fa-location-dot mr-1"></i>${esc(fullAddr)}</a>`:'<span class="text-sm text-slate-400">주소 미등록</span>'}
            ${hh.home_phone?`<div class="text-sm text-slate-500 mt-1"><a href="tel:${esc(hh.home_phone.replace(/[^0-9+]/g,''))}"><i class="fas fa-phone mr-1 text-emerald-600"></i>${esc(hh.home_phone)}</a></div>`:''}
          </div>
        </div>
        ${canEdit?`<button onclick="editHousehold(${hh.household_id})" class="text-slate-400 hover:text-brand-600"><i class="fas fa-pen"></i></button>`:''}
      </div>
    </div>
    <div class="card p-5">
      <div class="flex items-center justify-between mb-3"><h3 class="font-bold text-slate-700">가족 구성원 (${data.members.length}명)</h3>
        ${canEdit?`<button onclick="addMemberToHousehold(${hh.household_id})" class="text-sm text-brand-600 font-medium"><i class="fas fa-user-plus mr-1"></i>구성원 추가</button>`:''}</div>
      <div class="space-y-2">${data.members.map((m)=>`
        <div class="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100">
          <a href="#/members/${m.member_id}" class="flex items-center gap-3 flex-1 min-w-0">
            ${avatar(m.photo_url, m.first_name, m.last_name, 'w-10 h-10')}
            <div class="min-w-0"><div class="text-sm font-medium text-slate-800 truncate">${esc(m.korean_name||m.first_name+' '+m.last_name)} ${m.title?`<span class="text-xs text-slate-400">${esc(m.title)}</span>`:''}</div>
              <div class="text-xs text-slate-400">${roleLabel[m.household_role]||'구성원'}${m.birth_date?` · ${esc(m.birth_date)}`:''}</div></div>
          </a>
          ${canEdit?`<button onclick="removeFromHousehold(${hh.household_id},${m.member_id})" class="text-slate-300 hover:text-red-500"><i class="fas fa-times"></i></button>`:''}
        </div>`).join('') || '<div class="text-sm text-slate-400 py-4 text-center">구성원이 없습니다.</div>'}</div>
    </div>`;
}

async function createHousehold() {
  const box = h(`<div class="p-6"><h3 class="text-lg font-bold mb-4">세대 등록</h3>
    <form id="hh-form" class="space-y-3">
      <input name="household_name" required class="w-full px-3 py-2.5 border rounded-lg" placeholder="세대 이름 (예: The Kim Family)" />
      <input name="address_line1" class="w-full px-3 py-2.5 border rounded-lg" placeholder="Street address" />
      <div class="grid grid-cols-3 gap-2">
        <input name="city" class="px-3 py-2.5 border rounded-lg" placeholder="City" />
        <input name="state" maxlength="2" class="px-3 py-2.5 border rounded-lg" placeholder="CA" />
        <input name="zip_code" class="px-3 py-2.5 border rounded-lg" placeholder="ZIP" />
      </div>
      <input name="home_phone" class="w-full px-3 py-2.5 border rounded-lg" placeholder="집 전화" />
      <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">취소</button><button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">등록</button></div>
    </form></div>`);
  openModal(box);
  box.querySelector('#hh-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { const { data } = await api.post('/households', Object.fromEntries(new FormData(e.target)));
      closeModal(); toast('세대가 등록되었습니다.', 'success'); location.hash = `#/households/${data.household_id}`; }
    catch (err) { toast(err.response?.data?.error || '실패', 'error'); }
  });
}

async function editHousehold(id) {
  const { data } = await api.get(`/households/${id}`);
  const hh = data.household;
  const box = h(`<div class="p-6"><h3 class="text-lg font-bold mb-4">세대 수정</h3>
    <form id="hhe-form" class="space-y-3">
      <input name="household_name" required value="${esc(hh.household_name)}" class="w-full px-3 py-2.5 border rounded-lg" />
      <input name="address_line1" value="${esc(hh.address_line1||'')}" class="w-full px-3 py-2.5 border rounded-lg" placeholder="Street address" />
      <input name="address_line2" value="${esc(hh.address_line2||'')}" class="w-full px-3 py-2.5 border rounded-lg" placeholder="Apt/Suite" />
      <div class="grid grid-cols-3 gap-2">
        <input name="city" value="${esc(hh.city||'')}" class="px-3 py-2.5 border rounded-lg" placeholder="City" />
        <input name="state" maxlength="2" value="${esc(hh.state||'')}" class="px-3 py-2.5 border rounded-lg" placeholder="CA" />
        <input name="zip_code" value="${esc(hh.zip_code||'')}" class="px-3 py-2.5 border rounded-lg" placeholder="ZIP" />
      </div>
      <input name="home_phone" value="${esc(hh.home_phone||'')}" class="w-full px-3 py-2.5 border rounded-lg" placeholder="집 전화" />
      <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">취소</button><button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">저장</button></div>
    </form></div>`);
  openModal(box);
  box.querySelector('#hhe-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.put(`/households/${id}`, Object.fromEntries(new FormData(e.target)));
      closeModal(); toast('저장되었습니다.', 'success'); router(); }
    catch (err) { toast(err.response?.data?.error || '실패', 'error'); }
  });
}

async function addMemberToHousehold(hhId) {
  const { data } = await api.get('/members', { params: {} });
  const opts = data.members.map((m)=>`<option value="${m.member_id}">${esc(m.korean_name||m.first_name+' '+m.last_name)}</option>`).join('');
  const box = h(`<div class="p-6"><h3 class="text-lg font-bold mb-4">구성원 추가</h3>
    <form id="hm-form" class="space-y-3">
      <select name="member_id" class="w-full px-3 py-2.5 border rounded-lg">${opts}</select>
      <select name="household_role" class="w-full px-3 py-2.5 border rounded-lg">
        <option value="head">세대주</option><option value="spouse">배우자</option><option value="child">자녀</option><option value="parent">부모</option><option value="relative">친척</option><option value="other">기타</option></select>
      <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">취소</button><button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">추가</button></div>
    </form></div>`);
  openModal(box);
  box.querySelector('#hm-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.post(`/households/${hhId}/members`, Object.fromEntries(new FormData(e.target)));
      closeModal(); toast('구성원이 추가되었습니다.', 'success'); router(); }
    catch (err) { toast(err.response?.data?.error || '실패', 'error'); }
  });
}
async function removeFromHousehold(hhId, memberId) {
  if (!confirm('이 구성원을 세대에서 제외하시겠습니까?')) return;
  await api.delete(`/households/${hhId}/members/${memberId}`);
  toast('제외되었습니다.', 'success'); router();
}

/* ---------------- Admin ---------------- */
Pages.admin = async function (content, tab) {
  if (!isAdmin()) { content.innerHTML = '<div class="card p-12 text-center text-slate-400"><i class="fas fa-lock text-2xl mb-2"></i><p>접근 권한이 없습니다.</p></div>'; return; }
  const tabs = [['users','사용자','fa-users-gear'],['positions','직분코드','fa-id-badge'],['languages','언어코드','fa-language'],['orgs','조직관리','fa-sitemap']];
  content.innerHTML = `
    <h2 class="text-xl font-bold text-slate-800 mb-4">관리자</h2>
    <div class="flex gap-2 mb-4 overflow-x-auto">${tabs.map(([t,l,i])=>`
      <a href="#/admin/${t}" class="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${t===tab?'bg-brand-600 text-white':'bg-white border text-slate-600'}"><i class="fas ${i} mr-1"></i>${l}</a>`).join('')}</div>
    <div id="admin-body">${loadingHtml('')}</div>`;
  const body = el('admin-body');
  if (tab === 'users') return adminUsers(body);
  if (tab === 'positions') return adminPositions(body);
  if (tab === 'languages') return adminLanguages(body);
  if (tab === 'orgs') return adminOrgs(body);
};

async function adminUsers(body) {
  const [{ data: ud }, { data: rd }] = await Promise.all([api.get('/admin/users'), api.get('/admin/roles')]);
  body.innerHTML = `
    <div class="flex justify-end mb-3"><button onclick="createUser()" class="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"><i class="fas fa-user-plus mr-1"></i>사용자 추가</button></div>
    <div class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-slate-500 text-xs"><tr><th class="text-left p-3">사용자</th><th class="text-left p-3 hidden sm:table-cell">이메일</th><th class="text-left p-3">역할</th><th class="text-left p-3 hidden md:table-cell">로그인</th><th class="p-3">상태</th></tr></thead>
        <tbody>${(ud.users||[]).map((u)=>`
          <tr class="border-t border-slate-100">
            <td class="p-3"><div class="font-medium text-slate-800">${esc(u.display_name||u.username)}</div><div class="text-xs text-slate-400">@${esc(u.username)}${u.oauth_provider?` · ${esc(u.oauth_provider)}`:''}</div></td>
            <td class="p-3 hidden sm:table-cell text-slate-500">${esc(u.email||'-')}</td>
            <td class="p-3"><span class="text-xs text-slate-600">${esc(u.roles||'없음')}</span></td>
            <td class="p-3 hidden md:table-cell text-xs text-slate-400">${u.last_login_at?esc(u.last_login_at.slice(0,10)):'-'}</td>
            <td class="p-3 text-center">
              <div class="flex items-center justify-center gap-2">
                <button onclick="editUserRoles(${u.user_id}, '${esc(u.roles||'')}')" class="text-slate-400 hover:text-brand-600" title="역할"><i class="fas fa-user-tag"></i></button>
                <button onclick="resetUserPw(${u.user_id})" class="text-slate-400 hover:text-amber-600" title="비밀번호"><i class="fas fa-key"></i></button>
                <button onclick="toggleUser(${u.user_id}, ${u.is_active?0:1})" class="${u.is_active?'text-emerald-500':'text-slate-300'}" title="활성화"><i class="fas fa-power-off"></i></button>
              </div>
            </td>
          </tr>`).join('')}</tbody>
      </table>
    </div>
    <input type="hidden" id="roles-cache" value='${esc(JSON.stringify(rd.roles))}' />`;
}

async function createUser() {
  const { data: rd } = await api.get('/admin/roles');
  const roleOpts = rd.roles.map((r)=>`<option value="${r.role_id}">${esc(r.name)}</option>`).join('');
  const box = h(`<div class="p-6"><h3 class="text-lg font-bold mb-4">사용자 추가</h3>
    <form id="u-form" class="space-y-3">
      <input name="display_name" class="w-full px-3 py-2.5 border rounded-lg" placeholder="이름" />
      <input name="username" required class="w-full px-3 py-2.5 border rounded-lg" placeholder="아이디" />
      <input name="email" class="w-full px-3 py-2.5 border rounded-lg" placeholder="이메일" />
      <input name="password" type="password" required class="w-full px-3 py-2.5 border rounded-lg" placeholder="비밀번호 (6자+)" />
      <select name="role_id" class="w-full px-3 py-2.5 border rounded-lg">${roleOpts}</select>
      <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">취소</button><button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">추가</button></div>
    </form></div>`);
  openModal(box);
  box.querySelector('#u-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.post('/admin/users', Object.fromEntries(new FormData(e.target)));
      closeModal(); toast('사용자가 추가되었습니다.', 'success'); router(); }
    catch (err) { toast(err.response?.data?.error || '실패', 'error'); }
  });
}

async function editUserRoles(userId) {
  const { data: rd } = await api.get('/admin/roles');
  const box = h(`<div class="p-6"><h3 class="text-lg font-bold mb-4">역할 설정</h3>
    <form id="ur-form" class="space-y-2">
      ${rd.roles.map((r)=>`<label class="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50"><input type="checkbox" name="role" value="${r.role_id}" /> <span class="text-sm font-medium text-slate-700">${esc(r.name)}</span> <span class="text-xs text-slate-400">${esc(r.code)}</span></label>`).join('')}
      <div class="flex gap-2 pt-3"><button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">취소</button><button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">저장</button></div>
    </form></div>`);
  openModal(box);
  box.querySelector('#ur-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const role_ids = [...e.target.querySelectorAll('input[name=role]:checked')].map((c)=>parseInt(c.value,10));
    try { await api.put(`/admin/users/${userId}/roles`, { role_ids });
      closeModal(); toast('역할이 저장되었습니다.', 'success'); router(); }
    catch (err) { toast(err.response?.data?.error || '실패', 'error'); }
  });
}
async function resetUserPw(userId) {
  const pw = prompt('새 비밀번호 (6자 이상):'); if (!pw) return;
  try { await api.put(`/admin/users/${userId}/password`, { password: pw }); toast('비밀번호가 변경되었습니다.', 'success'); }
  catch (err) { toast(err.response?.data?.error || '실패', 'error'); }
}
async function toggleUser(userId, active) {
  await api.put(`/admin/users/${userId}/active`, { is_active: active });
  toast('상태가 변경되었습니다.', 'success'); router();
}

async function adminPositions(body) {
  const { data } = await api.get('/admin/positions');
  const grouped = {};
  data.positions.forEach((p)=>{ (grouped[p.position_type]=grouped[p.position_type]||[]).push(p); });
  body.innerHTML = `
    <div class="flex justify-end mb-3"><button onclick="addPosition()" class="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"><i class="fas fa-plus mr-1"></i>직분 추가</button></div>
    ${Object.keys(grouped).map((t)=>`<div class="card p-4 mb-3"><div class="text-xs font-bold text-slate-400 uppercase mb-2">${t}</div>
      <div class="flex flex-wrap gap-2">${grouped[t].map((p)=>`<span class="badge bg-slate-100 text-slate-600 text-sm py-1.5">${esc(p.name)} <button onclick="delPosition(${p.position_id})" class="ml-1 text-slate-300 hover:text-red-500"><i class="fas fa-times"></i></button></span>`).join('')}</div></div>`).join('')}`;
}
async function addPosition() {
  const box = h(`<div class="p-6"><h3 class="text-lg font-bold mb-4">직분 추가</h3>
    <form id="p-form" class="space-y-3">
      <input name="name" required class="w-full px-3 py-2.5 border rounded-lg" placeholder="직분명" />
      <select name="position_type" class="w-full px-3 py-2.5 border rounded-lg">${['임원','조직장','교역자','교사','학생','직원','일반'].map((t)=>`<option>${t}</option>`).join('')}</select>
      <input name="rank_order" type="number" value="99" class="w-full px-3 py-2.5 border rounded-lg" placeholder="서열" />
      <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">취소</button><button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">추가</button></div>
    </form></div>`);
  openModal(box);
  box.querySelector('#p-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.post('/admin/positions', Object.fromEntries(new FormData(e.target)));
      closeModal(); toast('추가되었습니다.', 'success'); router(); } catch (err) { toast('실패', 'error'); }
  });
}
async function delPosition(id) { if (!confirm('삭제하시겠습니까?')) return; await api.delete(`/admin/positions/${id}`); toast('삭제됨','success'); router(); }

async function adminLanguages(body) {
  const { data } = await api.get('/admin/languages');
  body.innerHTML = `
    <div class="flex justify-end mb-3"><button onclick="addLanguage()" class="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"><i class="fas fa-plus mr-1"></i>언어 추가</button></div>
    <div class="card p-4"><div class="flex flex-wrap gap-2">${data.languages.map((l)=>`<span class="badge bg-slate-100 text-slate-600 text-sm py-1.5">${esc(l.name_native||l.name_en)} <span class="text-xs text-slate-400">${esc(l.code)}</span></span>`).join('')}</div></div>`;
}
async function addLanguage() {
  const box = h(`<div class="p-6"><h3 class="text-lg font-bold mb-4">언어 추가</h3>
    <form id="l-form" class="space-y-3">
      <input name="code" required class="w-full px-3 py-2.5 border rounded-lg" placeholder="코드 (예: vi)" />
      <input name="name_en" required class="w-full px-3 py-2.5 border rounded-lg" placeholder="영문명" />
      <input name="name_native" class="w-full px-3 py-2.5 border rounded-lg" placeholder="원어명" />
      <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">취소</button><button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">추가</button></div>
    </form></div>`);
  openModal(box);
  box.querySelector('#l-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.post('/admin/languages', Object.fromEntries(new FormData(e.target)));
      closeModal(); toast('추가되었습니다.', 'success'); router(); } catch (err) { toast('실패','error'); }
  });
}

async function adminOrgs(body) {
  const [{ data: gd }, { data: cd }] = await Promise.all([api.get('/orgs/groups'), api.get('/admin/categories')]);
  const byCat = {};
  gd.groups.forEach((g)=>{ (byCat[g.category_code]=byCat[g.category_code]||[]).push(g); });
  body.innerHTML = `
    <div class="flex justify-end mb-3"><button onclick='addGroup(${esc(JSON.stringify(cd.categories))})' class="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"><i class="fas fa-plus mr-1"></i>조직 추가</button></div>
    ${Object.keys(byCat).map((code)=>{ const meta=CATEGORY_META[code]||{};
      return `<div class="card p-4 mb-3"><div class="font-bold text-slate-700 mb-2"><i class="fas ${meta.icon||'fa-folder'} ${meta.color||''} mr-2"></i>${meta.label||code}</div>
      <div class="space-y-1">${byCat[code].map((g)=>`<div class="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-sm" style="margin-left:${g.parent_id?'16px':'0'}">
        <span class="text-slate-700">${esc(g.name)} <span class="text-xs text-slate-400">(${esc(g.level_type)}${g.service_area?' · '+esc(g.service_area):''}) · ${g.member_count}명</span></span>
        <button onclick="delGroup(${g.group_id})" class="text-slate-300 hover:text-red-500"><i class="fas fa-trash text-xs"></i></button></div>`).join('')}</div></div>`;
    }).join('')}`;
}
async function addGroup(categories) {
  const { data: gd } = await api.get('/orgs/groups');
  const catOpts = categories.map((c)=>`<option value="${c.category_id}">${esc(c.name)}</option>`).join('');
  const parentOpts = '<option value="">(최상위)</option>' + gd.groups.map((g)=>`<option value="${g.group_id}">${esc(g.name)}</option>`).join('');
  const box = h(`<div class="p-6"><h3 class="text-lg font-bold mb-4">조직 추가</h3>
    <form id="g-form" class="space-y-3">
      <select name="category_id" class="w-full px-3 py-2.5 border rounded-lg">${catOpts}</select>
      <input name="name" required class="w-full px-3 py-2.5 border rounded-lg" placeholder="조직명" />
      <select name="level_type" class="w-full px-3 py-2.5 border rounded-lg">${['교구','구역','조','부서','반','팀','기타'].map((t)=>`<option>${t}</option>`).join('')}</select>
      <select name="parent_id" class="w-full px-3 py-2.5 border rounded-lg">${parentOpts}</select>
      <input name="service_area" class="w-full px-3 py-2.5 border rounded-lg" placeholder="담당 지역 (선택)" />
      <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">취소</button><button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">추가</button></div>
    </form></div>`);
  openModal(box);
  box.querySelector('#g-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target));
    try { await api.post('/admin/groups', payload); closeModal(); toast('조직이 추가되었습니다.', 'success'); router(); }
    catch (err) { toast(err.response?.data?.error || '실패', 'error'); }
  });
}
async function delGroup(id) { if (!confirm('이 조직을 비활성화하시겠습니까?')) return; await api.delete(`/admin/groups/${id}`); toast('처리됨','success'); router(); }
