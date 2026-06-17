/* ============================================================
 * Org browse pages (PARISH / FELLOWSHIP / SCHOOL / MINISTRY)
 * Layout: left = group list, right = members of selected group
 * ============================================================ */
Pages.orgs = async function (content, sub0, sub1) {
  // route format: #/orgs/PARISH or #/orgs/PARISH/<groupId>
  const cat = sub0 || 'PARISH';
  const meta = CATEGORY_META[cat] || { icon:'fa-folder', color:'text-slate-600', label:cat };
  const selectedGroup = sub1 ? parseInt(sub1, 10) : null;

  const canManage = hasPerm('org.manage');
  const addLabelMap = { PARISH:'교구/구역 등록', FELLOWSHIP:'부서 등록', SCHOOL:'부서/반 등록', MINISTRY:'팀 등록', STAFF:'조직 등록' };
  content.innerHTML = `
    <div class="mb-4 flex items-center gap-3">
      <div class="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center ${meta.color}"><i class="fas ${meta.icon} text-xl"></i></div>
      <div class="flex-1"><h2 class="text-xl font-bold text-slate-800">${meta.label}</h2><p class="text-sm text-slate-500">조직별 교인을 조회합니다.</p></div>
      ${canManage?`<button onclick="addOrgGroup('${cat}')" class="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap"><i class="fas fa-plus mr-1"></i>${addLabelMap[cat]||'조직 등록'}</button>`:''}
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-1">
        <div class="card p-3">
          <input id="org-search" placeholder="조직 검색..." class="w-full px-3 py-2 mb-3 border border-slate-200 rounded-lg text-sm" />
          <div id="group-list" class="space-y-1 max-h-[65vh] overflow-y-auto">${loadingHtml('')}</div>
        </div>
      </div>
      <div class="lg:col-span-2">
        <div class="card p-4" id="group-members">
          <div class="text-center text-slate-400 py-16"><i class="fas fa-hand-pointer text-3xl mb-3"></i><p>왼쪽에서 조직을 선택하세요.</p></div>
        </div>
      </div>
    </div>`;

  const { data } = await api.get('/orgs/groups', { params: { category: cat } });
  let groups = data.groups || [];

  function renderGroupList(filter = '') {
    const f = filter.toLowerCase();
    const list = groups.filter((g) => !f || g.name.toLowerCase().includes(f) || (g.service_area||'').toLowerCase().includes(f));
    // build tree (parent -> children)
    const byId = {}; list.forEach((g) => byId[g.group_id] = { ...g, children: [] });
    const roots = [];
    list.forEach((g) => {
      if (g.parent_id && byId[g.parent_id]) byId[g.parent_id].children.push(byId[g.group_id]);
      else roots.push(byId[g.group_id]);
    });
    const gl = el('group-list');
    if (!list.length) { gl.innerHTML = '<div class="text-center text-slate-400 py-8 text-sm">조직이 없습니다.</div>'; return; }
    function node(g, depth) {
      const active = g.group_id === selectedGroup;
      return `<a href="#/orgs/${cat}/${g.group_id}" class="block px-3 py-2 rounded-lg text-sm ${active?'bg-brand-600 text-white':'hover:bg-slate-100 text-slate-700'}" style="margin-left:${depth*12}px">
          <div class="flex items-center justify-between">
            <span class="font-medium"><i class="fas ${g.level_type==='교구'?'fa-sitemap':g.level_type==='구역'?'fa-location-dot':'fa-circle text-[6px] align-middle'} mr-2 opacity-70"></i>${esc(g.name)}</span>
            <span class="badge ${active?'bg-white/20 text-white':'bg-slate-100 text-slate-500'}">${g.member_count}</span>
          </div>
          ${g.service_area?`<div class="text-[11px] ${active?'text-blue-100':'text-slate-400'} mt-0.5 ml-5">${esc(g.service_area)}</div>`:''}
        </a>` + g.children.map((ch) => node(ch, depth+1)).join('');
    }
    gl.innerHTML = roots.map((r) => node(r, 0)).join('');
  }
  renderGroupList();
  el('org-search').addEventListener('input', (e) => renderGroupList(e.target.value));

  if (selectedGroup) loadGroupMembers(selectedGroup, cat);
};

async function loadGroupMembers(groupId, cat) {
  const box = el('group-members');
  if (!box) return;
  box.innerHTML = loadingHtml('');
  const [{ data: gd }, { data: md }] = await Promise.all([
    api.get(`/orgs/groups/${groupId}`),
    api.get(`/orgs/groups/${groupId}/members`),
  ]);
  const g = gd.group; const members = md.members || [];

  // group by position_type for nicer display
  const order = ['교역자','임원','조직장','교사','직원','일반','학생'];
  const grouped = {};
  members.forEach((m) => { (grouped[m.position_type] = grouped[m.position_type] || []).push(m); });

  box.innerHTML = `
    <div class="flex items-start justify-between mb-4 pb-3 border-b border-slate-100">
      <div>
        <h3 class="text-lg font-bold text-slate-800">${esc(g.name)}</h3>
        <p class="text-sm text-slate-500">${esc(g.category_name)} · ${esc(g.level_type)}${g.service_area?` · ${esc(g.service_area)}`:''}</p>
      </div>
      <span class="badge bg-brand-50 text-brand-700"><i class="fas fa-users mr-1"></i>${members.length}명</span>
    </div>
    ${members.length===0 ? '<div class="text-center text-slate-400 py-12"><i class="fas fa-user-slash text-2xl mb-2"></i><p>등록된 교인이 없습니다.</p></div>'
      : order.filter((t)=>grouped[t]).map((t) => `
        <div class="mb-4">
          <div class="text-xs font-bold text-slate-400 uppercase mb-2">${t}</div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            ${grouped[t].map(memberCardHtml).join('')}
          </div>
        </div>`).join('')}
  `;
}

function memberCardHtml(m) {
  const name = m.korean_name || `${m.first_name} ${m.last_name}`;
  return `<a href="#/members/${m.member_id}" class="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:border-brand-300 hover:bg-brand-50/40 transition">
    ${avatar(m.photo_url, m.first_name, m.last_name)}
    <div class="flex-1 min-w-0">
      <div class="font-semibold text-slate-800 text-sm truncate">${esc(name)} ${m.title?`<span class="text-xs text-slate-400 font-normal">${esc(m.title)}</span>`:''}</div>
      <div class="text-xs text-slate-500 truncate">${esc(m.position_name||'')}${m.sub_role?` (${esc(m.sub_role)})`:''}${m.mobile?` · ${esc(m.mobile)}`:''}</div>
    </div>
    <i class="fas fa-chevron-right text-slate-300 text-xs"></i>
  </a>`;
}

/* ---- create a new org group, scoped to a category (교구/교제부서/교회학교/봉사부서 등록) ---- */
async function addOrgGroup(categoryCode, defaults) {
  defaults = defaults || {};
  const [{ data: cd }, { data: gd }] = await Promise.all([
    api.get('/orgs/categories'),
    api.get('/orgs/groups', { params: { category: categoryCode } }),
  ]);
  const cat = (cd.categories || []).find((c) => c.code === categoryCode);
  if (!cat) { toast('분류를 찾을 수 없습니다.', 'error'); return; }

  // category-specific level types
  const levelMap = {
    PARISH: ['교구', '구역', '조'],
    FELLOWSHIP: ['부서', '팀', '기타'],
    SCHOOL: ['부서', '반', '기타'],
    MINISTRY: ['팀', '부서', '기타'],
    STAFF: ['부서', '팀', '기타'],
  };
  const levels = levelMap[categoryCode] || ['기타'];
  const meta = CATEGORY_META[categoryCode] || {};
  const parentOpts = '<option value="">(최상위)</option>' +
    (gd.groups || []).map((g) => `<option value="${g.group_id}" ${defaults.parent_id==g.group_id?'selected':''}>${esc(g.name)} (${esc(g.level_type)})</option>`).join('');

  const box = h(`<div class="p-6">
    <h3 class="text-lg font-bold mb-1"><i class="fas ${meta.icon||'fa-folder'} ${meta.color||''} mr-2"></i>${esc(cat.name)} 등록</h3>
    <p class="text-sm text-slate-500 mb-4">${esc(cat.description||'')}</p>
    <form id="og-form" class="space-y-3">
      <div><label class="block text-xs font-semibold text-slate-600 mb-1">조직명 *</label>
        <input name="name" required class="w-full px-3 py-2.5 border rounded-lg" placeholder="예: 1교구 / 청년부 / 초등 3학년반 / 찬양팀" /></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">구분</label>
          <select name="level_type" class="w-full px-3 py-2.5 border rounded-lg">${levels.map((l)=>`<option ${defaults.level_type===l?'selected':''}>${l}</option>`).join('')}</select></div>
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">정렬순서</label>
          <input name="sort_order" type="number" value="0" class="w-full px-3 py-2.5 border rounded-lg" /></div>
      </div>
      <div><label class="block text-xs font-semibold text-slate-600 mb-1">상위 조직</label>
        <select name="parent_id" class="w-full px-3 py-2.5 border rounded-lg">${parentOpts}</select></div>
      <div><label class="block text-xs font-semibold text-slate-600 mb-1">담당 지역 / 설명 (선택)</label>
        <input name="service_area" class="w-full px-3 py-2.5 border rounded-lg" placeholder="${categoryCode==='PARISH'?'City / ZIP 권역':'설명'}" /></div>
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">취소</button>
        <button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">등록</button>
      </div>
    </form></div>`);
  openModal(box);
  box.querySelector('#og-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.post('/admin/groups', {
        category_id: cat.category_id,
        name: fd.get('name'),
        level_type: fd.get('level_type'),
        parent_id: fd.get('parent_id') || null,
        service_area: fd.get('service_area') || null,
        sort_order: parseInt(fd.get('sort_order') || '0', 10),
      });
      closeModal();
      toast('조직이 등록되었습니다.', 'success');
      router();
    } catch (err) {
      toast(err.response?.data?.error || '등록 실패', 'error');
    }
  });
}
