/* ============================================================
 * Org browse pages (PARISH / FELLOWSHIP / SCHOOL / MINISTRY)
 * Layout: left = group list, right = members of selected group
 * ============================================================ */
Pages.orgs = async function (content, sub0, sub1) {
  // route format: #/orgs/PARISH or #/orgs/PARISH/<groupId>
  const cat = sub0 || 'PARISH';
  const meta = CATEGORY_META[cat] || { icon:'fa-folder', color:'text-slate-600' };
  const metaLabel = CATEGORY_META[cat] ? catLabel(cat) : cat;
  const selectedGroup = sub1 ? parseInt(sub1, 10) : null;

  const canManage = hasPerm('org.manage');
  const addLabel = t('orgs.add.' + cat) || t('orgs.add.default');
  content.innerHTML = `
    <div class="mb-4 flex items-center gap-3">
      <div class="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center ${meta.color}"><i class="fas ${meta.icon} text-xl"></i></div>
      <div class="flex-1"><h2 class="text-xl font-bold text-slate-800">${metaLabel}</h2><p class="text-sm text-slate-500">${t('orgs.browse_desc')}</p></div>
      ${canManage?`<button onclick="addOrgGroup('${cat}')" class="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap"><i class="fas fa-plus mr-1"></i>${addLabel}</button>`:''}
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-1">
        <div class="card p-3">
          <input id="org-search" placeholder="${t('orgs.search_placeholder')}" class="w-full px-3 py-2 mb-3 border border-slate-200 rounded-lg text-sm" />
          <div id="group-list" class="space-y-1 max-h-[65vh] overflow-y-auto">${loadingHtml('')}</div>
        </div>
      </div>
      <div class="lg:col-span-2">
        <div class="card p-4" id="group-members">
          <div class="text-center text-slate-400 py-16"><i class="fas fa-hand-pointer text-3xl mb-3"></i><p>${t('orgs.select_left')}</p></div>
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
    if (!list.length) { gl.innerHTML = `<div class="text-center text-slate-400 py-8 text-sm">${t('orgs.no_groups')}</div>`; return; }
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

  // group by position_type for nicer display (keys match DB values)
  const order = ['교역자','임원','조직장','교사','직원','일반','학생'];
  const grouped = {};
  members.forEach((m) => { (grouped[m.position_type] = grouped[m.position_type] || []).push(m); });

  const canManage = hasPerm('org.manage');
  box.innerHTML = `
    <div class="flex items-start justify-between mb-4 pb-3 border-b border-slate-100">
      <div>
        <h3 class="text-lg font-bold text-slate-800">${esc(g.name)}</h3>
        <p class="text-sm text-slate-500">${esc(g.category_name)} · ${esc(g.level_type)}${g.service_area?` · ${esc(g.service_area)}`:''}</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="badge bg-brand-50 text-brand-700"><i class="fas fa-users mr-1"></i>${members.length}${t('common.people_unit')}</span>
        ${canManage?`<button onclick='editOrgGroup(${JSON.stringify(g.category_code)}, ${JSON.stringify(g)})' title="${t('common.edit')}" class="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-brand-600"><i class="fas fa-pen text-xs"></i></button>
        <button onclick='deleteOrgGroup(${g.group_id}, ${JSON.stringify(g.name)}, ${JSON.stringify(g.category_code)})' title="${t('common.delete')}" class="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-500"><i class="fas fa-trash text-xs"></i></button>`:''}
      </div>
    </div>
    ${members.length===0 ? `<div class="text-center text-slate-400 py-12"><i class="fas fa-user-slash text-2xl mb-2"></i><p>${t('orgs.no_members')}</p></div>`
      : order.filter((pt)=>grouped[pt]).map((pt) => `
        <div class="mb-4">
          <div class="text-xs font-bold text-slate-400 uppercase mb-2">${t('ptype.' + pt)}</div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            ${grouped[pt].map(memberCardHtml).join('')}
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

/* ---- create / edit an org group, scoped to a category (교구/교제부서/교회학교/봉사부서) ---- */
async function addOrgGroup(categoryCode, defaults) { return orgGroupForm(categoryCode, defaults || {}, null); }
async function editOrgGroup(categoryCode, group) { return orgGroupForm(categoryCode, group || {}, group); }

async function orgGroupForm(categoryCode, defaults, editing) {
  defaults = defaults || {};
  const [{ data: cd }, { data: gd }] = await Promise.all([
    api.get('/orgs/categories'),
    api.get('/orgs/groups', { params: { category: categoryCode } }),
  ]);
  const cat = (cd.categories || []).find((c) => c.code === categoryCode);
  if (!cat) { toast(t('orgs.cat_not_found'), 'error'); return; }

  // category-specific level types
  const levelMap = {
    PARISH: ['교구', '구역', '조'],
    FELLOWSHIP: ['부서', '팀', '기타'],
    SCHOOL: ['부서', '반', '기타'],
    MINISTRY: ['팀', '부서', '기타'],
    STAFF: ['부서', '팀', '기타'],
  };
  let levels = levelMap[categoryCode] || ['기타'];
  // ensure current level_type is selectable even if not in the preset list
  if (defaults.level_type && !levels.includes(defaults.level_type)) levels = [defaults.level_type, ...levels];
  const meta = CATEGORY_META[categoryCode] || {};
  // exclude self (and avoid being its own parent) from parent options when editing
  const parentOpts = `<option value="">${t('orgs.top_level')}</option>` +
    (gd.groups || []).filter((g) => !editing || g.group_id !== editing.group_id)
      .map((g) => `<option value="${g.group_id}" ${defaults.parent_id==g.group_id?'selected':''}>${esc(g.name)} (${esc(g.level_type)})</option>`).join('');

  const title = editing ? t('orgs.edit_title') : t('orgs.register_title', { name: esc(cat.name) });
  const box = h(`<div class="p-6">
    <h3 class="text-lg font-bold mb-1"><i class="fas ${meta.icon||'fa-folder'} ${meta.color||''} mr-2"></i>${title}</h3>
    <p class="text-sm text-slate-500 mb-4">${esc(cat.description||'')}</p>
    <form id="og-form" class="space-y-3">
      <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('orgs.org_name')} *</label>
        <input name="name" required value="${esc(defaults.name||'')}" class="w-full px-3 py-2.5 border rounded-lg" placeholder="${t('orgs.org_name_ph')}" /></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('orgs.level_type')}</label>
          <select name="level_type" class="w-full px-3 py-2.5 border rounded-lg">${levels.map((l)=>`<option ${defaults.level_type===l?'selected':''}>${l}</option>`).join('')}</select></div>
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('orgs.sort_order')}</label>
          <input name="sort_order" type="number" value="${defaults.sort_order??0}" class="w-full px-3 py-2.5 border rounded-lg" /></div>
      </div>
      <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('orgs.parent_org')}</label>
        <select name="parent_id" class="w-full px-3 py-2.5 border rounded-lg">${parentOpts}</select></div>
      <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('orgs.service_area')}</label>
        <input name="service_area" value="${esc(defaults.service_area||'')}" class="w-full px-3 py-2.5 border rounded-lg" placeholder="${categoryCode==='PARISH'?t('orgs.service_area_parish'):t('orgs.service_area_other')}" /></div>
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">${t('common.cancel')}</button>
        <button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">${editing?t('common.save'):t('common.register')}</button>
      </div>
    </form></div>`);
  openModal(box);
  box.querySelector('#og-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      category_id: cat.category_id,
      name: fd.get('name'),
      level_type: fd.get('level_type'),
      parent_id: fd.get('parent_id') || null,
      service_area: fd.get('service_area') || null,
      sort_order: parseInt(fd.get('sort_order') || '0', 10),
    };
    try {
      if (editing) {
        await api.put(`/admin/groups/${editing.group_id}`, { ...payload, is_active: 1 });
        toast(t('orgs.updated'), 'success');
      } else {
        await api.post('/admin/groups', payload);
        toast(t('orgs.registered'), 'success');
      }
      closeModal();
      router();
    } catch (err) {
      toast(err.response?.data?.error || t('common.failed'), 'error');
    }
  });
}

/* ---- delete (soft) an org group ---- */
async function deleteOrgGroup(groupId, name, categoryCode) {
  if (!confirm(t('orgs.del_confirm', { name }))) return;
  try {
    await api.delete(`/admin/groups/${groupId}`);
    toast(t('orgs.deleted'), 'success');
    // navigate back to category list (drop the selected group from the hash)
    location.hash = `#/orgs/${categoryCode || ''}`;
    router();
  } catch (err) {
    toast(err.response?.data?.error || t('common.failed'), 'error');
  }
}
