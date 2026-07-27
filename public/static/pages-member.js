/* ============================================================
 * Member detail page (photo upload, contacts as tel:, address -> google maps, family)
 * ============================================================ */
Pages.memberDetail = async function (content, memberId) {
  content.innerHTML = loadingHtml();
  const [{ data }, { data: mnData }] = await Promise.all([
    api.get(`/members/${memberId}`),
    api.get(`/members/${memberId}/meeting-notes`, { params: { type: 'prayer,testimony' } }).catch(() => ({ data: { notes: [] } })),
  ]);
  const m = data.member;
  const addr = data.address;
  const name = nativeName(m);
  const canEdit = hasPerm('member.edit');
  const meetingNotes = mnData.notes || [];
  const standaloneTestimonies = data.testimonies || [];

  const fullAddr = [addr.line1, addr.line2, addr.city, addr.state, addr.zip].filter(Boolean).join(', ');
  const mapsUrl = fullAddr ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddr)}` : null;

  const contactsHtml = data.contacts.map((ct) => {
    if (ct.contact_type === 'email') {
      return `<a href="mailto:${esc(ct.value)}" class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100">
        <i class="fas fa-envelope w-5 text-brand-600"></i><div><div class="text-xs text-slate-400">${t('member.contact_email')}</div><div class="text-sm font-medium text-slate-700">${esc(ct.value)}</div></div></a>`;
    }
    const labelMap = { mobile:t('member.contact_mobile'), home:t('member.contact_home'), office:t('member.contact_office') };
    return `<a href="tel:${esc(ct.value.replace(/[^0-9+]/g,''))}" class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-emerald-50">
      <i class="fas fa-phone w-5 text-emerald-600"></i><div><div class="text-xs text-slate-400">${labelMap[ct.contact_type]||ct.contact_type}${ct.is_primary?' · '+t('member.contact_primary'):''}</div><div class="text-sm font-medium text-slate-700">${esc(ct.value)}</div></div>
      <i class="fas fa-arrow-up-right-from-square text-slate-300 text-xs ml-auto"></i></a>`;
  }).join('') || `<div class="text-sm text-slate-400 p-3">${t('member.no_contacts')}</div>`;

  const assignHtml = data.assignments.map((a) => {
    const cm = CATEGORY_META[a.category_code] || {};
    return `<div class="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100">
      <i class="fas ${cm.icon||'fa-folder'} ${cm.color||''} w-5"></i>
      <div class="flex-1"><div class="text-sm font-medium text-slate-700">${esc(a.group_name)}</div><div class="text-xs text-slate-400">${esc(a.category_name)} · ${esc(a.position_name)}${a.sub_role?` (${esc(a.sub_role)})`:''}</div></div>
      ${a.is_primary?`<span class="badge bg-brand-50 text-brand-700">${t('member.primary_affiliation')}</span>`:''}
      ${canEdit?`<button onclick="deleteAssignment(${a.assignment_id},${m.member_id})" class="text-slate-300 hover:text-red-500"><i class="fas fa-times"></i></button>`:''}
    </div>`;
  }).join('') || `<div class="text-sm text-slate-400">${t('member.no_affiliation')}</div>`;

  const famHtml = data.relationships.map((rel) => {
    const rn = nativeName(rel);
    const relLabel = t('rel.' + rel.relation_type) || rel.relation_type;
    return `<div class="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100">
      <a href="#/members/${rel.related_id}" class="flex items-center gap-3 flex-1 min-w-0">
        ${avatar(rel.photo_url, rel.first_name, rel.last_name, 'w-9 h-9')}
        <div class="min-w-0"><div class="text-sm font-medium text-slate-700 truncate">${esc(rn)}</div><div class="text-xs text-slate-400">${relLabel}${rel.title?` · ${esc(rel.title)}`:''}</div></div>
      </a>
      ${canEdit?`<button onclick="deleteRelationship(${rel.relationship_id},${m.member_id})" class="text-slate-300 hover:text-red-500"><i class="fas fa-times"></i></button>`:''}
    </div>`;
  }).join('') || `<div class="text-sm text-slate-400">${t('member.no_family')}</div>`;

  const langHtml = data.languages.map((l) => `<span class="badge bg-slate-100 text-slate-600">${esc(l.name_native||l.name_en)}${l.is_primary?' ★':''}</span>`).join(' ');
  const prayers = data.prayers || [];

  // Separate meeting-linked notes by type
  const meetingPrayers = meetingNotes.filter((n) => n.note_type === 'prayer');
  const meetingTestimonies = meetingNotes.filter((n) => n.note_type === 'testimony');

  // Merge standalone prayers + meeting-linked prayers, sorted by date desc
  const allPrayerItems = [
    ...prayers.map((p) => ({ _type: 'standalone', _date: p.prayer_date || '', ...p })),
    ...meetingPrayers.map((n) => ({ _type: 'meeting', _date: (n.meeting_date || '').slice(0, 10), ...n })),
  ].sort((a, b) => (b._date > a._date ? 1 : b._date < a._date ? -1 : 0));

  // Merge standalone testimonies + meeting-linked testimonies, sorted by date desc
  const allTestimonyItems = [
    ...standaloneTestimonies.map((p) => ({ _type: 'standalone', _date: p.prayer_date || '', ...p })),
    ...meetingTestimonies.map((n) => ({ _type: 'meeting', _date: (n.meeting_date || '').slice(0, 10), ...n })),
  ].sort((a, b) => (b._date > a._date ? 1 : b._date < a._date ? -1 : 0));

  content.innerHTML = `
    <div class="mb-4"><a href="javascript:history.back()" class="text-sm text-slate-500 hover:text-brand-600"><i class="fas fa-arrow-left mr-1"></i>${t('common.back')}</a></div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Profile -->
      <div class="card p-6 text-center">
        <div class="relative inline-block">
          <div id="photo-holder">${avatar(m.photo_url, m.first_name, m.last_name, 'w-28 h-28 mx-auto text-3xl')}</div>
          ${canEdit?`<button onclick="document.getElementById('photo-input').click()" class="absolute bottom-0 right-0 w-8 h-8 bg-brand-600 text-white rounded-full flex items-center justify-center shadow hover:bg-brand-700"><i class="fas fa-camera text-xs"></i></button>
          <input type="file" id="photo-input" accept="image/*" class="hidden" onchange="uploadPhoto(${m.member_id}, this)" />`:''}
        </div>
        <h2 class="text-xl font-bold text-slate-800 mt-3">${esc(name)}</h2>
        <div class="flex items-center justify-center gap-2 mt-2">
          ${m.title?`<span class="badge bg-brand-50 text-brand-700">${esc(m.title)}</span>`:''}
          ${statusBadge(m.status)}
          ${m.member_type?`<span class="badge bg-slate-100 text-slate-600">${esc(metaLabel('memberTypes', m.member_type) || m.member_type)}</span>`:''}
        </div>
        ${langHtml?`<div class="mt-3">${langHtml}</div>`:''}
        ${canEdit?`<button onclick="editMember(${m.member_id})" class="mt-4 w-full py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"><i class="fas fa-pen mr-1"></i>${t('member.edit_info')}</button>
        <button onclick='deleteMember(${m.member_id}, ${JSON.stringify(name)})' class="mt-2 w-full py-2 rounded-lg border border-red-200 text-sm text-red-500 hover:bg-red-50"><i class="fas fa-trash mr-1"></i>${t('member.delete')}</button>`:''}
      </div>

      <!-- Details -->
      <div class="lg:col-span-2 space-y-4">
        <div class="card p-5">
          <h3 class="font-bold text-slate-700 mb-3"><i class="fas fa-address-card text-brand-500 mr-2"></i>${t('member.contacts_address')}</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${contactsHtml}</div>
          <div class="mt-2">
            ${fullAddr ? `<a href="${mapsUrl}" target="_blank" class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-blue-50">
              <i class="fas fa-location-dot w-5 text-blue-600"></i>
              <div class="flex-1"><div class="text-xs text-slate-400">${t('member.address')} ${m.use_own_address?t('member.address_personal'):t('member.address_household')}</div><div class="text-sm font-medium text-slate-700">${esc(fullAddr)}</div></div>
              <i class="fas fa-map-location-dot text-slate-300 ml-auto"></i></a>`
              : `<div class="text-sm text-slate-400 p-3">${t('member.no_address')}</div>`}
          </div>
          ${m.birth_date?`<div class="text-sm text-slate-500 mt-3 px-1"><i class="fas fa-cake-candles mr-2 text-pink-400"></i>${esc(m.birth_date)}${m.gender?` · ${t('gender.' + m.gender)}`:''}</div>`:''}
        </div>

        <div class="card p-5">
          <h3 class="font-bold text-slate-700 mb-3"><i class="fas fa-sitemap text-brand-500 mr-2"></i>${t('member.affiliation_position')}</h3>
          <div class="space-y-2">${assignHtml}</div>
          ${canEdit?`<button onclick="addAssignment(${m.member_id})" class="mt-3 text-sm text-brand-600 font-medium"><i class="fas fa-plus mr-1"></i>${t('member.add_affiliation')}</button>`:''}
        </div>

        <div class="card p-5">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-bold text-slate-700"><i class="fas fa-people-roof text-brand-500 mr-2"></i>${t('member.family_members')}</h3>
            ${canEdit?`<button onclick="addRelationship(${m.member_id})" class="text-sm text-brand-600 font-medium"><i class="fas fa-user-plus mr-1"></i>${t('member.add_family')}</button>`:''}
          </div>
          <div class="space-y-2">${famHtml}</div>
          ${m.household_id?`<a href="#/households/${m.household_id}" class="mt-3 inline-block text-sm text-slate-500 hover:text-brand-600"><i class="fas fa-house-user mr-1"></i>${t('member.view_household')}</a>`:''}
        </div>

        <div class="card p-5" id="prayer-section-card">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-bold text-slate-700"><i class="fas fa-hands-praying text-brand-500 mr-2"></i>${t('member.prayer_requests')}</h3>
            ${canEdit?`<button onclick="addPrayerRequest(${m.member_id})" class="text-sm text-brand-600 font-medium"><i class="fas fa-plus mr-1"></i>${t('member.add_prayer')}</button>`:''}
          </div>
          <div id="prayer-paged-root"></div>
        </div>

        <div class="card p-5" id="testimony-section-card">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-bold text-slate-700"><i class="fas fa-star text-amber-500 mr-2"></i>${t('member.testimonies')}</h3>
            ${canEdit ? `<button onclick="addTestimony(${m.member_id})" class="text-sm text-brand-600 font-medium"><i class="fas fa-plus mr-1"></i>${t('member.add_testimony')}</button>` : ''}
          </div>
          <div id="testimony-paged-root"></div>
        </div>

        ${m.note?`<div class="card p-5"><h3 class="font-bold text-slate-700 mb-2"><i class="fas fa-note-sticky text-brand-500 mr-2"></i>${t('member.note')}</h3><p class="text-sm text-slate-600 whitespace-pre-line">${esc(m.note)}</p></div>`:''}
      </div>
    </div>`;

  // ---- init paged sections after DOM is ready ----
  initPagedSection('prayer-paged-root', allPrayerItems, (item) => buildPrayerItem(item, m.member_id, canEdit), {
    emptyHtml: `<div class="text-sm text-slate-400">${t('member.no_prayers')}</div>`,
    noResultHtml: `<div class="text-sm text-slate-400">${t('common.no_results')}</div>`,
  });
  initPagedSection('testimony-paged-root', allTestimonyItems, (item) => buildTestimonyItem(item, m.member_id, canEdit), {
    emptyHtml: `<div class="text-sm text-slate-400">${t('member.no_testimonies')}</div>`,
    noResultHtml: `<div class="text-sm text-slate-400">${t('common.no_results')}</div>`,
  });
};

/* ---- photo upload (resize client-side, store as data URL) ---- */
async function uploadPhoto(memberId, input) {
  const file = input.files[0]; if (!file) return;
  toast(t('common.processing_image'), 'info');
  try {
    const dataUrl = await resizeImage(file, 400, 400, 0.82);
    await api.put(`/members/${memberId}/photo`, { photo_url: dataUrl });
    el('photo-holder').innerHTML = `<img src="${dataUrl}" class="w-28 h-28 mx-auto rounded-full object-cover border border-slate-200" />`;
    toast(t('member.photo_updated'), 'success');
  } catch (e) {
    toast(e.response?.data?.error || t('member.upload_failed'), 'error');
  }
}

function resizeImage(file, maxW, maxH, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.onerror = reject;
    img.onload = () => {
      let { width, height } = img;
      const ratio = Math.min(maxW / width, maxH / height, 1);
      width = Math.round(width * ratio); height = Math.round(height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---- family relationship ---- */
async function addRelationship(memberId) {
  const { data } = await api.get('/members', { params: {} });
  const others = data.members.filter((x) => x.member_id !== memberId);
  const opts = others.map((x) => `<option value="${x.member_id}">${esc(nativeName(x))}</option>`).join('');
  const relOpts = [['spouse'],['parent'],['child'],['sibling'],['grandparent'],['grandchild'],['guardian'],['other']]
    .map(([v]) => `<option value="${v}">${t('rel.' + v)}</option>`).join('');
  const box = h(`<div class="p-6">
    <h3 class="text-lg font-bold mb-4">${t('member.add_family_title')}</h3>
    <form id="rel-form" class="space-y-3">
      <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('member.target_member')}</label><select name="related_id" class="w-full px-3 py-2.5 border rounded-lg">${opts}</select></div>
      <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('member.relation_self')}</label><select name="relation_type" class="w-full px-3 py-2.5 border rounded-lg">${relOpts}</select></div>
      <label class="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" name="reciprocal" checked /> ${t('member.reciprocal')}</label>
      <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">${t('common.cancel')}</button><button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">${t('common.add')}</button></div>
    </form></div>`);
  openModal(box);
  const recipMap = { spouse:'spouse', parent:'child', child:'parent', sibling:'sibling', grandparent:'grandchild', grandchild:'grandparent', guardian:'other', other:'other' };
  box.querySelector('#rel-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const rt = fd.get('relation_type');
    try {
      await api.post(`/members/${memberId}/relationships`, {
        related_id: parseInt(fd.get('related_id'),10), relation_type: rt,
        reciprocal_type: fd.get('reciprocal') ? recipMap[rt] : null,
      });
      closeModal(); toast(t('member.family_added'), 'success'); router();
    } catch (err) { toast(err.response?.data?.error || t('common.failed'), 'error'); }
  });
}

async function deleteRelationship(relId, memberId) {
  if (!confirm(t('member.del_relationship_confirm'))) return;
  await api.delete(`/members/relationships/${relId}`);
  toast(t('common.deleted'), 'success'); router();
}

/* ---- assignments ---- */
async function addAssignment(memberId) {
  const [{ data: gd }, { data: pd }] = await Promise.all([api.get('/orgs/groups'), api.get('/admin/positions')]);
  const gOpts = gd.groups.map((g) => `<option value="${g.group_id}">[${catLabel(g.category_code)}] ${esc(g.name)}</option>`).join('');
  const pOpts = pd.positions.map((p) => `<option value="${p.position_id}">${esc(p.name)} (${esc(p.position_type)})</option>`).join('');
  const box = h(`<div class="p-6"><h3 class="text-lg font-bold mb-4">${t('member.add_affiliation_title')}</h3>
    <form id="asg-form" class="space-y-3">
      <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('member.org')}</label><select name="group_id" class="w-full px-3 py-2.5 border rounded-lg">${gOpts}</select></div>
      <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('member.position')}</label><select name="position_id" class="w-full px-3 py-2.5 border rounded-lg">${pOpts}</select></div>
      <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('member.sub_role')}</label><input name="sub_role" class="w-full px-3 py-2.5 border rounded-lg" placeholder="${t('member.sub_role_ph')}" /></div>
      <label class="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" name="is_primary" /> ${t('member.set_primary')}</label>
      <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">${t('common.cancel')}</button><button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">${t('common.add')}</button></div>
    </form></div>`);
  openModal(box);
  box.querySelector('#asg-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.post(`/members/${memberId}/assignments`, {
        group_id: parseInt(fd.get('group_id'),10), position_id: parseInt(fd.get('position_id'),10),
        sub_role: fd.get('sub_role') || null, is_primary: fd.get('is_primary') ? 1 : 0,
      });
      closeModal(); toast(t('member.affiliation_added'), 'success'); router();
    } catch (err) { toast(err.response?.data?.error || t('common.failed'), 'error'); }
  });
}
async function deleteAssignment(asgId, memberId) {
  if (!confirm(t('member.del_affiliation_confirm'))) return;
  await api.delete(`/members/assignments/${asgId}`);
  toast(t('common.deleted'), 'success'); router();
}

/* ---- edit/create member form ---- */
async function editMember(memberId) {
  let m = {};
  let contacts = [];
  let addr = {};
  if (memberId) {
    const { data } = await api.get(`/members/${memberId}`);
    m = data.member;
    contacts = data.contacts || [];
    addr = data.address || {};
  }
  const contactValue = (type) => {
    const found = contacts.find((c) => c.contact_type === type);
    return found ? found.value : '';
  };
  const useOwnAddress = m.use_own_address === 1 || !memberId;
  const personalAddress = {
    line1: m.address_line1 || '',
    line2: m.address_line2 || '',
    city: m.city || '',
    state: m.state || '',
    zip: m.zip_code || '',
  };
  const householdAddress = {
    line1: addr.line1 || '',
    line2: addr.line2 || '',
    city: addr.city || '',
    state: addr.state || '',
    zip: addr.zip || '',
  };
  const addressValue = (field) => (useOwnAddress ? personalAddress[field] : householdAddress[field]);
  const [{ data: pd }, { data: mt }, { data: et }, { data: sd }] = await Promise.all([
    api.get('/admin/positions'),
    api.get('/admin/member-types'),
    api.get('/admin/employment-types'),
    api.get('/admin/member-statuses'),
  ]);
  const titleOptions = Array.from(new Set((pd.positions || []).map((p) => p.name).filter(Boolean)));
  if (m.title && !titleOptions.includes(m.title)) titleOptions.unshift(m.title);
  const titleOpts = ['<option value="">-</option>']
    .concat(titleOptions.map((o) => `<option value="${esc(o)}" ${m.title===o?'selected':''}>${esc(o)}</option>`))
    .join('');
  const memberTypeOptions = (mt.types || []).filter((t) => t.is_active !== 0)
    .map((t) => ({ value: t.name, label: localizeMetaName(t) }));
  const employmentTypeOptions = (et.types || []).filter((t) => t.is_active !== 0)
    .map((t) => ({ value: t.name, label: localizeMetaName(t) }));
  const statusOptions = (sd.statuses || []).filter((s) => s.is_active !== 0)
    .map((s) => ({ value: s.name, label: localizeMetaName(s) }));
  const fallbackMemberTypes = ['성도','새신자','목회자','직원','학생']
    .map((value) => ({ value, label: t('mt.' + value) || value }));
  const fallbackEmploymentTypes = ['봉사자','상근직원','목회자']
    .map((value) => ({ value, label: t('emp.' + value) || value }));
  const fallbackStatuses = ['활동','휴면','이전','사망']
    .map((value) => ({ value, label: t('status.' + value) || value }));
  const memberTypeList = memberTypeOptions.length ? memberTypeOptions : fallbackMemberTypes;
  const employmentTypeList = employmentTypeOptions.length ? employmentTypeOptions : fallbackEmploymentTypes;
  const statusList = statusOptions.length ? statusOptions : fallbackStatuses;
  const ensureOption = (list, value) => {
    if (!value) return;
    const exists = list.some((item) => (item.value || item) === value);
    if (!exists) list.unshift({ value, label: value });
  };
  ensureOption(memberTypeList, m.member_type);
  ensureOption(employmentTypeList, m.employment_type);
  ensureOption(statusList, m.status);
  const sel = (val, opts) => opts.map((o) => {
    const value = o.value || o;
    const label = o.label || o;
    return `<option value="${esc(value)}" ${val===value?'selected':''}>${esc(label)}</option>`;
  }).join('');
  const box = h(`<div class="p-6 max-h-[80vh] overflow-y-auto">
    <h3 class="text-lg font-bold mb-4">${memberId?t('member.edit_title'):t('member.new_title')}</h3>
    <form id="m-form" class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">First Name *</label><input name="first_name" required value="${esc(m.first_name||'')}" class="w-full px-3 py-2 border rounded-lg" /></div>
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">Last Name *</label><input name="last_name" required value="${esc(m.last_name||'')}" class="w-full px-3 py-2 border rounded-lg" /></div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('member.korean_name')}</label><input name="korean_name" value="${esc(m.korean_name||'')}" class="w-full px-3 py-2 border rounded-lg" /></div>
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('member.title')}</label><select name="title" class="w-full px-3 py-2 border rounded-lg">${titleOpts}</select></div>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('member.gender')}</label><select name="gender" class="w-full px-3 py-2 border rounded-lg"><option value="">-</option><option value="M" ${m.gender==='M'?'selected':''}>${t('gender.M')}</option><option value="F" ${m.gender==='F'?'selected':''}>${t('gender.F')}</option></select></div>
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('member.birth_date')}</label><input type="date" name="birth_date" value="${esc(m.birth_date||'')}" class="w-full px-3 py-2 border rounded-lg" /></div>
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('member.status')}</label><select name="status" class="w-full px-3 py-2 border rounded-lg">${sel(m.status || statusList[0], statusList)}</select></div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('member.member_type')}</label><select name="member_type" class="w-full px-3 py-2 border rounded-lg"><option value="">-</option>${sel(m.member_type || '', memberTypeList)}</select></div>
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('member.employment_type')}</label><select name="employment_type" class="w-full px-3 py-2 border rounded-lg"><option value="">-</option>${sel(m.employment_type || '', employmentTypeList)}</select></div>
      </div>
      <div class="pt-2 border-t border-slate-100">
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('member.contact_mobile')}</label><input name="mobile" value="${esc(contactValue('mobile'))}" class="w-full px-3 py-2 border rounded-lg" /></div>
          <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('member.contact_home')}</label><input name="home" value="${esc(contactValue('home'))}" class="w-full px-3 py-2 border rounded-lg" /></div>
        </div>
        <div class="grid grid-cols-2 gap-3 mt-3">
          <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('member.contact_office')}</label><input name="office" value="${esc(contactValue('office'))}" class="w-full px-3 py-2 border rounded-lg" /></div>
          <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('member.contact_email')}</label><input type="email" name="email" value="${esc(contactValue('email'))}" class="w-full px-3 py-2 border rounded-lg" /></div>
        </div>
      </div>
      <div class="pt-2 border-t border-slate-100">
        <label class="flex items-center gap-2 text-sm text-slate-600 mb-2"><input type="checkbox" name="use_own_address" ${useOwnAddress?'checked':''} /> ${t('member.use_own_address')}</label>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('member.address_line1')}</label><input name="address_line1" value="${esc(addressValue('line1')||'')}" class="w-full px-3 py-2 border rounded-lg" /></div>
          <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('member.address_line2')}</label><input name="address_line2" value="${esc(addressValue('line2')||'')}" class="w-full px-3 py-2 border rounded-lg" /></div>
        </div>
        <div class="grid grid-cols-3 gap-3 mt-3">
          <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('member.city')}</label><input name="city" value="${esc(addressValue('city')||'')}" class="w-full px-3 py-2 border rounded-lg" /></div>
          <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('member.state')}</label><input name="state" value="${esc(addressValue('state')||'')}" class="w-full px-3 py-2 border rounded-lg" /></div>
          <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('member.zip_code')}</label><input name="zip_code" value="${esc(addressValue('zip')||'')}" class="w-full px-3 py-2 border rounded-lg" /></div>
        </div>
      </div>
      <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('member.note')}</label><textarea name="note" rows="2" class="w-full px-3 py-2 border rounded-lg">${esc(m.note||'')}</textarea></div>
      <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">${t('common.cancel')}</button><button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">${t('common.save')}</button></div>
    </form></div>`);
  openModal(box, { size:'max-w-xl' });
  const addressFields = {
    line1: box.querySelector('[name="address_line1"]'),
    line2: box.querySelector('[name="address_line2"]'),
    city: box.querySelector('[name="city"]'),
    state: box.querySelector('[name="state"]'),
    zip: box.querySelector('[name="zip_code"]'),
  };
  const setAddressMode = (useOwn) => {
    const source = useOwn ? personalAddress : householdAddress;
    Object.entries(addressFields).forEach(([key, input]) => {
      if (!input) return;
      input.value = source[key] || '';
      input.disabled = !useOwn;
      input.classList.toggle('bg-slate-100', !useOwn);
    });
  };
  const useOwnToggle = box.querySelector('[name="use_own_address"]');
  if (useOwnToggle) {
    setAddressMode(useOwnToggle.checked);
    useOwnToggle.addEventListener('change', (e) => setAddressMode(e.target.checked));
  }
  box.querySelector('#m-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target));
    const useOwn = !!payload.use_own_address;
    payload.use_own_address = useOwn ? 1 : 0;
    if (!useOwn && memberId) {
      payload.address_line1 = personalAddress.line1 || '';
      payload.address_line2 = personalAddress.line2 || '';
      payload.city = personalAddress.city || '';
      payload.state = personalAddress.state || '';
      payload.zip_code = personalAddress.zip || '';
    }
    try {
      if (memberId) { await api.put(`/members/${memberId}`, payload); }
      else { const { data } = await api.post('/members', payload); memberId = data.member_id; }
      closeModal(); toast(t('common.saved'), 'success');
      location.hash = `#/members/${memberId}`; router();
    } catch (err) { toast(err.response?.data?.error || t('common.failed'), 'error'); }
  });
}

/* ---- Paged section utility (search + pagination) ---- */
const PAGE_SIZE = 5;

function initPagedSection(rootId, items, renderFn, opts = {}) {
  const root = document.getElementById(rootId);
  if (!root) return;

  let query = '';
  let page  = 1;

  function getTextContent(item) {
    // Strip HTML tags for search
    const raw = (item.content || '').replace(/<[^>]+>/g, ' ');
    const date = item._date || '';
    const title = item.meeting_title || '';
    return (raw + ' ' + date + ' ' + title).toLowerCase();
  }

  function filtered() {
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter((item) => getTextContent(item).includes(q));
  }

  function render() {
    const list = filtered();
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (page > totalPages) page = totalPages;
    const start = (page - 1) * PAGE_SIZE;
    const slice = list.slice(start, start + PAGE_SIZE);

    const itemsHtml = slice.length
      ? slice.map(renderFn).join('')
      : (query ? (opts.noResultHtml || '') : (opts.emptyHtml || ''));

    const pageLabel = t('common.page_of')
      .replace('{cur}', page).replace('{total}', totalPages);
    const countLabel = t('common.items_count').replace('{n}', total);

    const pagerHtml = total > PAGE_SIZE ? `
      <div class="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <span class="text-xs text-slate-400">${countLabel}</span>
        <div class="flex items-center gap-1">
          <button id="${rootId}-prev" class="px-2 py-1 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed" ${page <= 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i> ${t('common.prev')}
          </button>
          <span class="text-xs text-slate-500 px-2">${pageLabel}</span>
          <button id="${rootId}-next" class="px-2 py-1 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed" ${page >= totalPages ? 'disabled' : ''}>
            ${t('common.next')} <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>` : (total > 0 ? `<div class="mt-2 text-right"><span class="text-xs text-slate-400">${countLabel}</span></div>` : '');

    root.innerHTML = `
      <div class="mb-2">
        <div class="relative">
          <i class="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
          <input id="${rootId}-search" type="text" value="${esc(query)}"
            placeholder="${esc(t('common.search_ph'))}"
            class="w-full pl-7 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-brand-400 bg-white" />
          ${query ? `<button id="${rootId}-clear" class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"><i class="fas fa-times"></i></button>` : ''}
        </div>
      </div>
      <div class="space-y-3">${itemsHtml}</div>
      ${pagerHtml}`;

    // Bind events
    const searchEl = document.getElementById(`${rootId}-search`);
    if (searchEl) {
      searchEl.addEventListener('input', (e) => {
        query = e.target.value;
        page = 1;
        render();
        // Re-focus after re-render with cursor at end
        const el2 = document.getElementById(`${rootId}-search`);
        if (el2) { el2.focus(); const len = el2.value.length; el2.setSelectionRange(len, len); }
      });
    }
    const clearEl = document.getElementById(`${rootId}-clear`);
    if (clearEl) {
      clearEl.addEventListener('click', () => { query = ''; page = 1; render(); });
    }
    const prevEl = document.getElementById(`${rootId}-prev`);
    if (prevEl) {
      prevEl.addEventListener('click', () => { if (page > 1) { page--; render(); } });
    }
    const nextEl = document.getElementById(`${rootId}-next`);
    if (nextEl) {
      nextEl.addEventListener('click', () => { if (page < totalPages) { page++; render(); } });
    }
  }

  render();
}

/* ---- Prayer item renderer ---- */
function buildPrayerItem(item, memberId, canEdit) {
  if (item._type === 'meeting') return buildMeetingNoteItem(item, memberId, canEdit);
  const p = item;
  const pId = `pr-${p.prayer_id}`;
  const pJson = JSON.stringify(p).replace(/'/g, '&#39;');
  const isHtml = /<[a-z][\s\S]*>/i.test(p.content || '');
  const contentHtml = isHtml ? (p.content || '') : `<p class="whitespace-pre-line">${esc(p.content || '')}</p>`;
  return `
  <div class="p-3 rounded-lg border border-slate-100" id="prayer-item-${p.prayer_id}">
    <div class="flex items-start justify-between mb-2">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-xs font-medium text-brand-600"><i class="fas fa-calendar-alt mr-1"></i>${esc(p.prayer_date || '')}</span>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button onclick="togglePrayerContent('${pId}')" class="text-xs text-slate-400 hover:text-brand-600 px-2 py-0.5 rounded border border-slate-200 hover:border-brand-200">
          <i class="fas fa-chevron-down" id="prayer-chevron-${pId}"></i>
        </button>
        ${canEdit ? `<button onclick='editPrayerRequest(${memberId}, ${pJson})' class="text-slate-400 hover:text-brand-600" title="${t('common.edit')}"><i class="fas fa-pen text-xs"></i></button>
        <button onclick='deletePrayerRequest(${memberId}, ${p.prayer_id})' class="text-slate-400 hover:text-red-500" title="${t('common.delete')}"><i class="fas fa-trash text-xs"></i></button>` : ''}
      </div>
    </div>
    <div id="prayer-content-${pId}" class="hidden">
      <div class="text-sm text-slate-700 prose prose-sm max-w-none mt-2 pt-2 border-t border-slate-100">${contentHtml}</div>
    </div>
  </div>`;
}

/* ---- Testimony item renderer ---- */
function buildTestimonyItem(item, memberId, canEdit) {
  if (item._type === 'meeting') return buildMeetingNoteItem(item, memberId, canEdit);
  const p = item;
  const pId = `ts-${p.prayer_id}`;
  const pJson = JSON.stringify(p).replace(/'/g, '&#39;');
  const isHtml = /<[a-z][\s\S]*>/i.test(p.content || '');
  const contentHtml = isHtml ? (p.content || '') : `<p class="whitespace-pre-line">${esc(p.content || '')}</p>`;
  return `
  <div class="p-3 rounded-lg border border-slate-100" id="testimony-item-${p.prayer_id}">
    <div class="flex items-start justify-between mb-2">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-xs font-medium text-brand-600"><i class="fas fa-calendar-alt mr-1"></i>${esc(p.prayer_date || '')}</span>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button onclick="toggleTestimonyContent('${pId}')" class="text-xs text-slate-400 hover:text-brand-600 px-2 py-0.5 rounded border border-slate-200 hover:border-brand-200">
          <i class="fas fa-chevron-down" id="testimony-chevron-${pId}"></i>
        </button>
        ${canEdit ? `<button onclick='editTestimony(${memberId}, ${pJson})' class="text-slate-400 hover:text-brand-600" title="${t('common.edit')}"><i class="fas fa-pen text-xs"></i></button>
        <button onclick='deleteTestimony(${memberId}, ${p.prayer_id})' class="text-slate-400 hover:text-red-500" title="${t('common.delete')}"><i class="fas fa-trash text-xs"></i></button>` : ''}
      </div>
    </div>
    <div id="testimony-content-${pId}" class="hidden">
      <div class="text-sm text-slate-700 prose prose-sm max-w-none mt-2 pt-2 border-t border-slate-100">${contentHtml}</div>
    </div>
  </div>`;
}

/* ---- Meeting-linked note item renderer (prayer / testimony) ---- */
function buildMeetingNoteItem(n, memberId, canEdit) {
  const noteId = n.note_id;
  const meetingDate = (n.meeting_date || '').slice(0, 10);
  const meetingTitle = n.meeting_title || '';
  const isHtml = /<[a-z][\s\S]*>/i.test(n.content || '');
  const contentHtml = isHtml ? (n.content || '') : `<p class="whitespace-pre-line">${esc(n.content || '')}</p>`;
  const nJson = JSON.stringify(n).replace(/'/g, '&#39;');
  return `
    <div class="p-3 rounded-lg border border-slate-100 bg-slate-50/50" id="meeting-note-item-${noteId}">
      <div class="flex items-start justify-between mb-2">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs font-medium text-brand-600"><i class="fas fa-calendar-alt mr-1"></i>${esc(meetingDate)}</span>
          <span class="text-xs text-slate-500 font-medium">${esc(meetingTitle)}</span>
          <span class="badge bg-purple-50 text-purple-500 text-xs">${t('member.meeting_linked')}</span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button onclick="toggleMeetingNoteContent(${noteId})" class="text-xs text-slate-400 hover:text-brand-600 px-2 py-0.5 rounded border border-slate-200 hover:border-brand-200">
            <i class="fas fa-chevron-down" id="meeting-note-chevron-${noteId}"></i>
          </button>
          ${canEdit ? `<button onclick="editMeetingLinkedNote(${memberId}, ${nJson})" class="text-slate-400 hover:text-brand-600" title="${t('common.edit')}"><i class="fas fa-pen text-xs"></i></button>
          <button onclick="deleteMeetingLinkedNote(${memberId}, ${noteId})" class="text-slate-400 hover:text-red-500" title="${t('common.delete')}"><i class="fas fa-trash text-xs"></i></button>` : ''}
        </div>
      </div>
      <div id="meeting-note-content-${noteId}" class="hidden">
        <div class="text-sm text-slate-700 prose prose-sm max-w-none mt-2 pt-2 border-t border-slate-100">${contentHtml}</div>
      </div>
    </div>
  `;
}

function toggleMeetingNoteContent(noteId) {
  const contentEl = document.getElementById(`meeting-note-content-${noteId}`);
  const chevron = document.getElementById(`meeting-note-chevron-${noteId}`);
  if (contentEl) {
    const isHidden = contentEl.classList.contains('hidden');
    contentEl.classList.toggle('hidden', !isHidden);
    if (chevron) {
      chevron.className = isHidden ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
    }
  }
}

function togglePrayerContent(pId) {
  const contentEl = document.getElementById(`prayer-content-${pId}`);
  const chevron = document.getElementById(`prayer-chevron-${pId}`);
  if (contentEl) {
    const isHidden = contentEl.classList.contains('hidden');
    contentEl.classList.toggle('hidden', !isHidden);
    if (chevron) {
      chevron.className = isHidden ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
    }
  }
}

function toggleTestimonyContent(pId) {
  const contentEl = document.getElementById(`testimony-content-${pId}`);
  const chevron = document.getElementById(`testimony-chevron-${pId}`);
  if (contentEl) {
    const isHidden = contentEl.classList.contains('hidden');
    contentEl.classList.toggle('hidden', !isHidden);
    if (chevron) {
      chevron.className = isHidden ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
    }
  }
}

async function addTestimony(memberId) {
  openTestimonyForm(memberId, null);
}

async function editTestimony(memberId, testimony) {
  openTestimonyForm(memberId, testimony);
}

async function deleteTestimony(memberId, testimonyId) {
  if (!confirm(t('member.testimony_delete_confirm'))) return;
  try {
    await api.delete(`/members/${memberId}/testimonies/${testimonyId}`);
    toast(t('member.testimony_deleted'), 'success');
    router();
  } catch (err) {
    toast(err.response?.data?.error || t('common.failed'), 'error');
  }
}

function openTestimonyForm(memberId, testimony) {
  const p = testimony || {};
  const today = new Date().toISOString().slice(0, 10);
  const box = h(`<div class="p-6 max-h-[80vh] overflow-y-auto">
    <h3 class="text-lg font-bold mb-4">${testimony ? t('member.edit_testimony_title') : t('member.add_testimony_title')}</h3>
    <form id="testimony-form" class="space-y-3">
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1">${t('member.testimony_date')} *</label>
        <input type="date" name="prayer_date" required value="${esc(p.prayer_date || today)}" class="w-full px-3 py-2.5 border rounded-lg" />
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1">${t('member.testimony_content')} *</label>
        <div id="testimony-editor-toolbar" class="flex flex-wrap gap-1 p-2 bg-slate-50 border border-slate-200 rounded-t-lg text-slate-600">
          <button type="button" class="testimony-tool px-2 py-1 rounded hover:bg-slate-200 text-xs font-bold" data-cmd="bold" title="Bold"><b>B</b></button>
          <button type="button" class="testimony-tool px-2 py-1 rounded hover:bg-slate-200 text-xs italic" data-cmd="italic" title="Italic"><i>I</i></button>
          <button type="button" class="testimony-tool px-2 py-1 rounded hover:bg-slate-200 text-xs underline" data-cmd="underline" title="Underline"><u>U</u></button>
          <span class="border-l border-slate-300 mx-1"></span>
          <button type="button" class="testimony-tool px-2 py-1 rounded hover:bg-slate-200 text-xs" data-cmd="insertUnorderedList" title="List">&#8226; List</button>
          <button type="button" class="testimony-tool px-2 py-1 rounded hover:bg-slate-200 text-xs" data-cmd="insertOrderedList" title="Numbered">1. List</button>
        </div>
        <div id="testimony-editor"
          contenteditable="true"
          class="min-h-[140px] max-h-[340px] overflow-y-auto w-full px-3 py-2.5 border border-t-0 border-slate-200 rounded-b-lg focus:outline-none focus:border-brand-400 text-sm text-slate-700 whitespace-pre-wrap"
          placeholder="${esc(t('member.testimony_content_ph'))}"></div>
        <input type="hidden" name="content" />
      </div>
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">${t('common.cancel')}</button>
        <button type="submit" class="flex-1 py-2.5 bg-amber-500 text-white rounded-lg font-semibold">${t('common.save')}</button>
      </div>
    </form>
  </div>`);
  openModal(box, { size: 'max-w-xl' });

  const editor = box.querySelector('#testimony-editor');
  const contentInput = box.querySelector('input[name="content"]');

  if (p.content) {
    if (/<[a-z][\s\S]*>/i.test(p.content)) {
      editor.innerHTML = p.content;
    } else {
      editor.innerHTML = p.content.split('\n').map((l) => `<p>${esc(l) || '<br>'}</p>`).join('');
    }
  }

  const updatePlaceholder = () => {
    editor.classList.toggle('empty', editor.textContent.trim() === '');
  };
  updatePlaceholder();
  editor.addEventListener('input', updatePlaceholder);

  box.querySelectorAll('.testimony-tool').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      document.execCommand(btn.dataset.cmd, false, null);
      editor.focus();
    });
  });

  box.querySelector('#testimony-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const htmlContent = editor.innerHTML.trim();
    if (!htmlContent || htmlContent === '<br>') {
      toast(t('member.testimony_content_ph'), 'error');
      return;
    }
    contentInput.value = htmlContent;
    const fd = new FormData(e.target);
    const payload = { prayer_date: fd.get('prayer_date'), content: fd.get('content') };
    try {
      if (testimony) {
        await api.put(`/members/${memberId}/testimonies/${p.prayer_id}`, payload);
        toast(t('member.testimony_updated'), 'success');
      } else {
        await api.post(`/members/${memberId}/testimonies`, payload);
        toast(t('member.testimony_added'), 'success');
      }
      closeModal();
      router();
    } catch (err) {
      toast(err.response?.data?.error || t('common.failed'), 'error');
    }
  });
}

async function deleteMeetingLinkedNote(memberId, noteId) {
  const confirmMsg = t('att.note_delete_confirm');
  if (!confirm(confirmMsg)) return;
  try {
    await api.delete(`/members/${memberId}/meeting-notes/${noteId}`);
    toast(t('common.deleted'), 'success');
    router();
  } catch (err) {
    toast(err.response?.data?.error || t('common.failed'), 'error');
  }
}

async function editMeetingLinkedNote(memberId, note) {
  const n = note;
  const meetingId = n.meeting_id;
  const box = h(`<div class="p-6 max-h-[85vh] overflow-y-auto">
    <h3 class="text-lg font-bold mb-1">${t('att.edit_note')}</h3>
    <p class="text-xs text-slate-400 mb-4"><i class="fas fa-calendar-alt mr-1"></i>${esc((n.meeting_date||'').slice(0,10))} &middot; ${esc(n.meeting_title||'')}</p>
    <form id="meeting-note-edit-form" class="space-y-3">
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1">${t('att.note_content')}</label>
        <div id="mne-toolbar" class="flex flex-wrap gap-1 p-2 bg-slate-50 border border-slate-200 rounded-t-lg text-slate-600">
          <button type="button" class="mne-tool px-2 py-1 rounded hover:bg-slate-200 text-xs font-bold" data-cmd="bold"><b>B</b></button>
          <button type="button" class="mne-tool px-2 py-1 rounded hover:bg-slate-200 text-xs italic" data-cmd="italic"><i>I</i></button>
          <button type="button" class="mne-tool px-2 py-1 rounded hover:bg-slate-200 text-xs underline" data-cmd="underline"><u>U</u></button>
          <span class="border-l border-slate-300 mx-1"></span>
          <button type="button" class="mne-tool px-2 py-1 rounded hover:bg-slate-200 text-xs" data-cmd="insertUnorderedList">&#8226; List</button>
          <button type="button" class="mne-tool px-2 py-1 rounded hover:bg-slate-200 text-xs" data-cmd="insertOrderedList">1. List</button>
        </div>
        <div id="mne-editor" contenteditable="true"
          class="min-h-[140px] max-h-[340px] overflow-y-auto w-full px-3 py-2.5 border border-t-0 border-slate-200 rounded-b-lg focus:outline-none focus:border-brand-400 text-sm text-slate-700"
          placeholder="${esc(t('att.note_content_ph'))}"></div>
        <input type="hidden" name="content" />
      </div>
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">${t('common.cancel')}</button>
        <button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">${t('common.save')}</button>
      </div>
    </form>
  </div>`);
  openModal(box, { size: 'max-w-xl' });
  const editor = box.querySelector('#mne-editor');
  const contentInput = box.querySelector('input[name="content"]');
  if (n.content) {
    if (/<[a-z][\s\S]*>/i.test(n.content)) {
      editor.innerHTML = n.content;
    } else {
      editor.innerHTML = n.content.split('\n').map((l) => `<p>${esc(l) || '<br>'}</p>`).join('');
    }
  }
  box.querySelectorAll('.mne-tool').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      document.execCommand(btn.dataset.cmd, false, null);
      editor.focus();
    });
  });
  box.querySelector('#meeting-note-edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const htmlContent = editor.innerHTML.trim();
    if (!htmlContent || htmlContent === '<br>') { toast(t('att.note_content_ph'), 'error'); return; }
    contentInput.value = htmlContent;
    const payload = { note_type: n.note_type, content: htmlContent, member_id: memberId };
    try {
      await api.put(`/attendance/meetings/${meetingId}/notes/${n.note_id}`, payload);
      closeModal();
      toast(t('common.saved'), 'success');
      router();
    } catch (err) {
      toast(err.response?.data?.error || t('common.failed'), 'error');
    }
  });
}

/* ---- prayer requests ---- */
async function addPrayerRequest(memberId) {
  openPrayerRequestForm(memberId, null);
}

async function editPrayerRequest(memberId, prayer) {
  openPrayerRequestForm(memberId, prayer);
}

function openPrayerRequestForm(memberId, prayer) {
  const p = prayer || {};
  const today = new Date().toISOString().slice(0, 10);
  const box = h(`<div class="p-6 max-h-[80vh] overflow-y-auto">
    <h3 class="text-lg font-bold mb-4">${prayer ? t('member.edit_prayer_title') : t('member.add_prayer_title')}</h3>
    <form id="prayer-form" class="space-y-3">
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1">${t('member.prayer_date')} *</label>
        <input type="date" name="prayer_date" required value="${esc(p.prayer_date || today)}" class="w-full px-3 py-2.5 border rounded-lg" />
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1">${t('member.prayer_content')} *</label>
        <div id="prayer-editor-toolbar" class="flex flex-wrap gap-1 p-2 bg-slate-50 border border-slate-200 rounded-t-lg text-slate-600">
          <button type="button" class="prayer-tool px-2 py-1 rounded hover:bg-slate-200 text-xs font-bold" data-cmd="bold" title="Bold"><b>B</b></button>
          <button type="button" class="prayer-tool px-2 py-1 rounded hover:bg-slate-200 text-xs italic" data-cmd="italic" title="Italic"><i>I</i></button>
          <button type="button" class="prayer-tool px-2 py-1 rounded hover:bg-slate-200 text-xs underline" data-cmd="underline" title="Underline"><u>U</u></button>
          <span class="border-l border-slate-300 mx-1"></span>
          <button type="button" class="prayer-tool px-2 py-1 rounded hover:bg-slate-200 text-xs" data-cmd="insertUnorderedList" title="List">&#8226; List</button>
          <button type="button" class="prayer-tool px-2 py-1 rounded hover:bg-slate-200 text-xs" data-cmd="insertOrderedList" title="Numbered">1. List</button>
        </div>
        <div id="prayer-editor"
          contenteditable="true"
          class="min-h-[120px] max-h-[300px] overflow-y-auto w-full px-3 py-2.5 border border-t-0 border-slate-200 rounded-b-lg focus:outline-none focus:border-brand-400 text-sm text-slate-700 whitespace-pre-wrap"
          placeholder="${esc(t('member.prayer_content_ph'))}"></div>
        <input type="hidden" name="content" />
      </div>
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">${t('common.cancel')}</button>
        <button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">${t('common.save')}</button>
      </div>
    </form>
  </div>`);
  openModal(box, { size: 'max-w-xl' });

  const editor = box.querySelector('#prayer-editor');
  const contentInput = box.querySelector('input[name="content"]');

  // Set initial content (supports both HTML and plain text from DB)
  if (p.content) {
    // If content looks like HTML, use it directly; otherwise treat as plain text
    if (/<[a-z][\s\S]*>/i.test(p.content)) {
      editor.innerHTML = p.content;
    } else {
      editor.innerHTML = p.content.split('\n').map((l) => `<p>${esc(l) || '<br>'}</p>`).join('');
    }
  }

  // Add placeholder behavior
  const updatePlaceholder = () => {
    if (editor.textContent.trim() === '') {
      editor.classList.add('empty');
    } else {
      editor.classList.remove('empty');
    }
  };
  updatePlaceholder();
  editor.addEventListener('input', updatePlaceholder);

  // Toolbar buttons
  box.querySelectorAll('.prayer-tool').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      document.execCommand(btn.dataset.cmd, false, null);
      editor.focus();
    });
  });

  box.querySelector('#prayer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const htmlContent = editor.innerHTML.trim();
    if (!htmlContent || htmlContent === '<br>') {
      toast(t('member.prayer_content_ph'), 'error');
      return;
    }
    contentInput.value = htmlContent;
    const fd = new FormData(e.target);
    const payload = { prayer_date: fd.get('prayer_date'), content: fd.get('content') };
    try {
      if (prayer) {
        await api.put(`/members/${memberId}/prayers/${p.prayer_id}`, payload);
      } else {
        await api.post(`/members/${memberId}/prayers`, payload);
      }
      closeModal();
      toast(t('common.saved'), 'success');
      router();
    } catch (err) {
      toast(err.response?.data?.error || t('common.failed'), 'error');
    }
  });
}

async function deletePrayerRequest(memberId, prayerId) {
  if (!confirm(t('member.prayer_delete_confirm'))) return;
  try {
    await api.delete(`/members/${memberId}/prayers/${prayerId}`);
    toast(t('common.deleted'), 'success');
    router();
  } catch (err) {
    toast(err.response?.data?.error || t('common.failed'), 'error');
  }
}

/* ---- delete a member ---- */
async function deleteMember(memberId, name) {
  if (!confirm(t('member.del_confirm', { name }))) return;
  try {
    await api.delete(`/members/${memberId}`);
    toast(t('member.deleted'), 'success');
    location.hash = '#/addressbook';
    router();
  } catch (err) {
    toast(err.response?.data?.error || t('common.failed'), 'error');
  }
}
