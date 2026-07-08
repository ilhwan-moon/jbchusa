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
      <h2 class="text-2xl font-bold">${t('dash.greeting', { name: esc(u.display_name||u.username) })}</h2>
      <p class="text-blue-100 text-sm mt-1">${t('dash.welcome')}</p>
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      ${statCard(t('dash.total_members'),'fa-users','text-brand-600', mem.members.length)}
      ${statCard(t('dash.active_members'),'fa-user-check','text-emerald-600', att.totalMembers)}
      ${statCard(t('dash.registered_meetings'),'fa-calendar','text-purple-600', att.totalMeetings)}
      ${statCard(t('dash.orgs'),'fa-sitemap','text-amber-600', (cats.categories||[]).length)}
    </div>

    <h3 class="font-bold text-slate-700 mb-3">${t('dash.org_shortcuts')}</h3>
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">${catCards}</div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="card p-5">
        <div class="flex items-center justify-between mb-3"><h3 class="font-bold text-slate-700">${t('dash.recent_meetings')}</h3><a href="#/attendance" class="text-xs text-brand-600">${t('dash.view_all')}</a></div>
        <div class="space-y-2">${(att.recentMeetings||[]).slice(0,5).map(meetingRow).join('') || `<div class="text-sm text-slate-400 py-4 text-center">${t('dash.no_meetings')}</div>`}</div>
      </div>
      <div class="card p-5">
        <div class="flex items-center justify-between mb-3"><h3 class="font-bold text-slate-700">${t('dash.quick_menu')}</h3></div>
        <div class="grid grid-cols-2 gap-2">
          <a href="#/addressbook" class="p-4 rounded-xl bg-slate-50 hover:bg-brand-50 text-center"><i class="fas fa-address-book text-brand-600 text-xl"></i><div class="text-sm font-medium text-slate-700 mt-2">${t('nav.addressbook')}</div></a>
          <a href="#/households" class="p-4 rounded-xl bg-slate-50 hover:bg-brand-50 text-center"><i class="fas fa-house-user text-brand-600 text-xl"></i><div class="text-sm font-medium text-slate-700 mt-2">${t('nav.households')}</div></a>
          <a href="#/attendance" class="p-4 rounded-xl bg-slate-50 hover:bg-brand-50 text-center"><i class="fas fa-clipboard-check text-brand-600 text-xl"></i><div class="text-sm font-medium text-slate-700 mt-2">${t('nav.attendance')}</div></a>
          ${isAdmin()?`<a href="#/admin/users" class="p-4 rounded-xl bg-slate-50 hover:bg-brand-50 text-center"><i class="fas fa-screwdriver-wrench text-brand-600 text-xl"></i><div class="text-sm font-medium text-slate-700 mt-2">${t('nav.admin')}</div></a>`:`<a href="#/orgs/PARISH" class="p-4 rounded-xl bg-slate-50 hover:bg-brand-50 text-center"><i class="fas fa-map-location-dot text-brand-600 text-xl"></i><div class="text-sm font-medium text-slate-700 mt-2">${t('nav.parish')}</div></a>`}
        </div>
      </div>
    </div>`;
};

/* ---------------- Address Book ---------------- */
Pages.addressbook = async function (content) {
  const canEdit = hasPerm('member.edit');
  content.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div><h2 class="text-xl font-bold text-slate-800">${t('ab.title')}</h2><p class="text-sm text-slate-500">${t('ab.desc')}</p></div>
      <div class="flex items-center gap-2">
        <button onclick="downloadAddressbook()" class="px-3 py-2 rounded-lg text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50"><i class="fas fa-file-excel mr-1 text-emerald-600"></i>${t('ab.export')}</button>
        <button onclick="downloadAddressbookTemplate()" class="px-3 py-2 rounded-lg text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50"><i class="fas fa-download mr-1"></i>${t('ab.template')}</button>
        ${canEdit?`<button onclick="openAddressbookUpload()" class="px-3 py-2 rounded-lg text-sm font-semibold border border-brand-200 text-brand-700 hover:bg-brand-50"><i class="fas fa-upload mr-1"></i>${t('ab.import')}</button>
        <button onclick="editMember(null)" class="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"><i class="fas fa-user-plus mr-1"></i>${t('ab.add_member')}</button>`:''}
      </div>
    </div>
    <div class="card p-3 mb-4">
      <div class="flex gap-2">
        <div class="relative flex-1"><i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input id="ab-search" placeholder="${t('ab.search_ph')}" class="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg" /></div>
        <select id="ab-status" class="px-3 py-2.5 border border-slate-200 rounded-lg text-sm"><option value="">${t('ab.all_status')}</option><option value="활동">${t('status.활동')}</option><option value="휴면">${t('status.휴면')}</option><option value="이전">${t('status.이전')}</option></select>
      </div>
    </div>
    <div id="ab-list">${loadingHtml('')}</div>`;

  async function load() {
    const q = el('ab-search').value.trim();
    const status = el('ab-status').value;
    const { data } = await api.get('/members', { params: { q, status } });
    const list = el('ab-list');
    if (!data.members.length) { list.innerHTML = `<div class="card p-12 text-center text-slate-400"><i class="fas fa-user-slash text-2xl mb-2"></i><p>${t('ab.no_members')}</p></div>`; return; }
    list.innerHTML = `<div class="text-xs text-slate-400 mb-2 px-1">${data.members.length}${t('common.people_unit')}</div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">${data.members.map(abCard).join('')}</div>`;
  }
  function abCard(m) {
    const englishName = `${m.first_name} ${m.last_name}`.trim();
    const name = m.korean_name ? `${m.korean_name} (${englishName})` : englishName;
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

const ADDRESSBOOK_COLUMNS = [
  { key: 'first_name', label: 'First Name', required: true },
  { key: 'last_name', label: 'Last Name', required: true },
  { key: 'korean_name', label: 'Korean Name' },
  { key: 'preferred_name', label: 'Preferred Name' },
  { key: 'gender', label: 'Gender (M/F)' },
  { key: 'title', label: 'Title' },
  { key: 'status', label: 'Status' },
  { key: 'member_type', label: 'Member Type' },
  { key: 'employment_type', label: 'Employment Type' },
  { key: 'birth_date', label: 'Birth Date (YYYY-MM-DD)' },
  { key: 'organizations', label: 'Organizations' },
  { key: 'positions', label: 'Positions' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'email', label: 'Email' },
  { key: 'home', label: 'Home Phone' },
  { key: 'office', label: 'Office Phone' },
  { key: 'address_line1', label: 'Address Line 1' },
  { key: 'address_line2', label: 'Address Line 2' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'zip_code', label: 'ZIP' },
  { key: 'note', label: 'Note' },
];

function normalizeHeader(value) {
  if (value == null) return '';
  return String(value).trim().toLowerCase().replace(/\n/g, ' ');
}

function mapAddressbookHeader(headerRow) {
  const headerMap = {};
  const keyLookup = {};
  ADDRESSBOOK_COLUMNS.forEach((col) => {
    keyLookup[normalizeHeader(col.key)] = col.key;
    keyLookup[normalizeHeader(col.label)] = col.key;
  });
  headerRow.forEach((cell, idx) => {
    const key = keyLookup[normalizeHeader(cell)];
    if (key) headerMap[key] = idx;
  });
  return headerMap;
}

async function downloadAddressbook() {
  const ok = await ensureXlsx();
  if (!ok) { toast(t('common.failed'), 'error'); return; }
  const q = el('ab-search')?.value?.trim() || '';
  const status = el('ab-status')?.value || '';
  try {
    const { data } = await api.get('/members/export', { params: { q, status } });
    const rows = (data.members || []).map((m) => {
      const out = {};
      ADDRESSBOOK_COLUMNS.forEach((col) => { out[col.key] = m[col.key] ?? ''; });
      return out;
    });
    const ws = XLSX.utils.json_to_sheet(rows, { header: ADDRESSBOOK_COLUMNS.map((c) => c.key) });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'AddressBook');
    XLSX.writeFile(wb, `addressbook_${new Date().toISOString().slice(0,10)}.xlsx`);
  } catch (err) {
    console.error('addressbook export failed', err);
    toast(err.response?.data?.error || t('common.failed'), 'error');
  }
}

async function downloadAddressbookTemplate() {
  const ok = await ensureXlsx();
  if (!ok) { toast(t('common.failed'), 'error'); return; }
  try {
    const header = ADDRESSBOOK_COLUMNS.map((c) => c.key);
    const labels = ADDRESSBOOK_COLUMNS.map((c) => `${c.label}${c.required ? ' *' : ''}`);
    const example = ['John','Doe','홍길동','John','M','집사','활동','성도','봉사자','1990-01-01','청년부','집사','010-1234-5678','john@example.com','','','123 Street','Apt 101','Los Angeles','CA','90001','메모'];
    const ws = XLSX.utils.aoa_to_sheet([header, labels, example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'addressbook_template.xlsx');
  } catch (err) {
    console.error('addressbook template failed', err);
    toast(t('common.failed'), 'error');
  }
}

function openAddressbookUpload() {
  const box = h(`<div class="p-6">
    <h3 class="text-lg font-bold mb-2">${t('ab.upload_title')}</h3>
    <p class="text-sm text-slate-500 mb-4">${t('ab.upload_desc')}</p>
    <form id="ab-upload-form" class="space-y-3">
      <input type="file" id="ab-upload-file" accept=".xlsx,.xls" class="w-full px-3 py-2.5 border rounded-lg" />
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">${t('common.cancel')}</button>
        <button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">${t('ab.upload_btn')}</button>
      </div>
    </form>
  </div>`);
  openModal(box);
  box.querySelector('#ab-upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = box.querySelector('#ab-upload-file');
    const file = input.files?.[0];
    if (!file) { toast(t('ab.file_required'), 'error'); return; }
    const ok = await ensureXlsx();
    if (!ok) { toast(t('common.failed'), 'error'); return; }
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (!rows.length) throw new Error(t('ab.file_required'));
      const headerRow = rows[0];
      const headerMap = mapAddressbookHeader(headerRow);
      const labelRow = rows[1] || [];
      const labelMatches = labelRow.some((cell) => ADDRESSBOOK_COLUMNS.some((col) => normalizeHeader(col.label) === normalizeHeader(cell)));
      const dataStartIndex = labelMatches ? 2 : 1;
      const dataRows = rows.slice(dataStartIndex).filter((r) => r.some((v) => String(v).trim() !== ''));
      const payload = dataRows.map((r) => {
        const obj = {};
        ADDRESSBOOK_COLUMNS.forEach((col) => {
          const idx = headerMap[col.key];
          if (idx != null) obj[col.key] = r[idx];
        });
        return obj;
      }).filter((r) => r.first_name || r.last_name || r.korean_name);
      if (!payload.length) { toast(t('ab.file_required'), 'error'); return; }
      const { data } = await api.post('/members/bulk', { members: payload });
      if (data.errors && data.errors.length) {
        toast(`${t('ab.import_success', { n: data.created })} (${data.errors.length}${t('ab.import_errors')})`, 'warn');
      } else {
        toast(t('ab.import_success', { n: data.created }), 'success');
      }
      closeModal();
      router();
    } catch (err) {
      toast(err.response?.data?.error || t('ab.import_failed'), 'error');
    }
  });
}

/* ---------------- Account ---------------- */
Pages.account = async function (content) {
  content.innerHTML = loadingHtml();
  const { data } = await api.get('/auth/profile');
  const profile = data.profile || {};
  content.innerHTML = `
    <div class="mb-4"><h2 class="text-xl font-bold text-slate-800">${t('account.title')}</h2><p class="text-sm text-slate-500">${t('account.desc')}</p></div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="card p-5">
        <h3 class="font-bold text-slate-700 mb-3">${t('account.profile_title')}</h3>
        <form id="account-profile" class="space-y-3">
          <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('account.name')}</label>
            <input name="display_name" value="${esc(profile.display_name || '')}" class="w-full px-3 py-2.5 border rounded-lg" />
          </div>
          <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('account.email')}</label>
            <input name="email" type="email" required value="${esc(profile.email || '')}" class="w-full px-3 py-2.5 border rounded-lg" />
          </div>
          <div class="flex justify-end"><button type="submit" class="px-4 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">${t('common.save')}</button></div>
        </form>
      </div>
      <div class="card p-5">
        <h3 class="font-bold text-slate-700 mb-3">${t('account.password_title')}</h3>
        <form id="account-password" class="space-y-3">
          <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('account.current_password')}</label>
            <input name="current_password" type="password" required class="w-full px-3 py-2.5 border rounded-lg" />
          </div>
          <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('account.new_password')}</label>
            <input name="new_password" type="password" required minlength="6" class="w-full px-3 py-2.5 border rounded-lg" />
          </div>
          <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('account.confirm_password')}</label>
            <input name="confirm_password" type="password" required minlength="6" class="w-full px-3 py-2.5 border rounded-lg" />
          </div>
          <div class="flex justify-end"><button type="submit" class="px-4 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">${t('account.change_password')}</button></div>
        </form>
      </div>
    </div>`;

  el('account-profile').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target));
    try {
      const { data: resp } = await api.put('/auth/profile', payload);
      App.state.user = resp.user || App.state.user;
      toast(t('account.profile_saved'), 'success');
      router();
    } catch (err) {
      toast(err.response?.data?.error || t('common.failed'), 'error');
    }
  });

  el('account-password').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const newPw = fd.get('new_password');
    const confirm = fd.get('confirm_password');
    if (newPw !== confirm) { toast(t('account.password_mismatch'), 'error'); return; }
    try {
      await api.put('/auth/password', {
        current_password: fd.get('current_password'),
        new_password: newPw,
      });
      toast(t('account.password_saved'), 'success');
      e.target.reset();
    } catch (err) {
      toast(err.response?.data?.error || t('common.failed'), 'error');
    }
  });
};

/* ---------------- Households ---------------- */
Pages.households = async function (content, id) {
  if (id) return householdDetail(content, id);
  const canEdit = hasPerm('member.edit');
  content.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div><h2 class="text-xl font-bold text-slate-800">${t('hh.title')}</h2><p class="text-sm text-slate-500">${t('hh.desc')}</p></div>
    </div>
    <div class="card p-3 mb-4"><div class="relative"><i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
      <input id="hh-search" placeholder="${t('hh.search_ph')}" class="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg" /></div></div>
    <div id="hh-list">${loadingHtml('')}</div>`;

  async function load() {
    const q = el('hh-search').value.trim();
    const { data } = await api.get('/households', { params: { q } });
    const list = el('hh-list');
    if (!data.households.length) { list.innerHTML = `<div class="card p-12 text-center text-slate-400">${t('hh.none')}</div>`; return; }
    list.innerHTML = `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">${data.households.map((hh)=>`
      <a href="#/households/${hh.household_id}" class="card p-4 hover:border-brand-300 hover:shadow-sm transition">
        <div class="flex items-center gap-3"><div class="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center"><i class="fas fa-house-user"></i></div>
          <div class="flex-1 min-w-0"><div class="font-bold text-slate-800 truncate">${esc(hh.household_name)}</div><div class="text-xs text-slate-400">${esc([hh.city,hh.state].filter(Boolean).join(', ')||t('hh.no_address'))}</div></div>
          <span class="badge bg-slate-100 text-slate-500">${hh.member_count}${t('common.people_unit')}</span></div>
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
  const head = data.head_member || null;
  const headContacts = data.head_contacts || [];
  const headAddress = data.head_address || {};
  const headName = head ? (head.korean_name || `${head.first_name} ${head.last_name}`) : '-';
  const fullAddr = [headAddress.address_line1, headAddress.address_line2, headAddress.city, headAddress.state, headAddress.zip_code].filter(Boolean).join(', ');
  const mapsUrl = fullAddr ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddr)}` : null;
  const roleLabel = (rc) => t('hhrole.' + rc) || t('hhrole.member');
  const contactLabelMap = { mobile:t('member.contact_mobile'), home:t('member.contact_home'), office:t('member.contact_office'), email:t('member.contact_email') };
  const headContactHtml = headContacts.map((ct) => {
    if (ct.contact_type === 'email') {
      return `<div class="text-sm text-slate-500"><i class="fas fa-envelope text-slate-400 mr-2"></i>${esc(ct.value)}</div>`;
    }
    return `<div class="text-sm text-slate-500"><i class="fas fa-phone text-slate-400 mr-2"></i>${contactLabelMap[ct.contact_type]||ct.contact_type}: ${esc(ct.value)}</div>`;
  }).join('') || `<div class="text-sm text-slate-400">${t('member.no_contacts')}</div>`;

  content.innerHTML = `
    <div class="mb-4"><a href="#/households" class="text-sm text-slate-500 hover:text-brand-600"><i class="fas fa-arrow-left mr-1"></i>${t('hh.list')}</a></div>
    <div class="card p-6 mb-4">
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center text-2xl"><i class="fas fa-house-user"></i></div>
          <div><h2 class="text-xl font-bold text-slate-800">${esc(hh.household_name)}</h2>
            <div class="text-sm text-slate-500 mt-1"><span class="font-semibold text-slate-600">${t('hh.head_member')}</span>: ${esc(headName)}</div>
            ${fullAddr?`<a href="${mapsUrl}" target="_blank" class="text-sm text-blue-600 hover:underline"><i class="fas fa-location-dot mr-1"></i>${esc(fullAddr)}</a>`:`<span class="text-sm text-slate-400">${t('hh.no_address')}</span>`}
            <div class="mt-2 space-y-1">${headContactHtml}</div>
          </div>
        </div>
        ${canEdit?`<div class="flex items-center gap-2">
          <button onclick="setHouseholdHead(${hh.household_id})" class="px-3 py-1.5 rounded-lg text-xs font-semibold border border-brand-200 text-brand-600 hover:bg-brand-50">${t('hh.set_head')}</button>
          <button onclick="editHousehold(${hh.household_id})" class="text-slate-400 hover:text-brand-600"><i class="fas fa-pen"></i></button>
        </div>`:''}
      </div>
    </div>
    <div class="card p-5">
      <div class="flex items-center justify-between mb-3"><h3 class="font-bold text-slate-700">${t('hh.members')} (${data.members.length}${t('common.people_unit')})</h3></div>
      <div class="space-y-2">${data.members.map((m)=>{
        const isHead = head && m.member_id === head.member_id;
        return `
        <div class="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100">
          <a href="#/members/${m.member_id}" class="flex items-center gap-3 flex-1 min-w-0">
            ${avatar(m.photo_url, m.first_name, m.last_name, 'w-10 h-10')}
            <div class="min-w-0"><div class="text-sm font-medium text-slate-800 truncate">${esc(m.korean_name||m.first_name+' '+m.last_name)} ${m.title?`<span class="text-xs text-slate-400">${esc(m.title)}</span>`:''}
              ${isHead?`<span class="ml-2 badge bg-brand-50 text-brand-700">${t('hh.head_badge')}</span>`:''}</div>
              <div class="text-xs text-slate-400">${roleLabel(m.household_role)}${m.birth_date?` · ${esc(m.birth_date)}`:''}</div></div>
          </a>
          ${canEdit?`<div class="flex items-center gap-2">
            <button onclick="editHouseholdMemberRole(${hh.household_id}, ${m.member_id}, '${m.household_role || ''}')" class="text-slate-300 hover:text-brand-600" title="${t('common.edit')}"><i class="fas fa-pen"></i></button>
            <button onclick="removeFromHousehold(${hh.household_id},${m.member_id})" class="text-slate-300 hover:text-red-500"><i class="fas fa-times"></i></button>
          </div>`:''}
        </div>`;
      }).join('') || `<div class="text-sm text-slate-400 py-4 text-center">${t('hh.no_members')}</div>`}</div>
    </div>`;
}

async function createHousehold() {
  const box = h(`<div class="p-6"><h3 class="text-lg font-bold mb-4">${t('hh.add')}</h3>
    <form id="hh-form" class="space-y-3">
      <input name="household_name" required class="w-full px-3 py-2.5 border rounded-lg" placeholder="${t('hh.name_ph')}" />
      <input name="address_line1" class="w-full px-3 py-2.5 border rounded-lg" placeholder="Street address" />
      <div class="grid grid-cols-3 gap-2">
        <input name="city" class="px-3 py-2.5 border rounded-lg" placeholder="City" />
        <input name="state" maxlength="2" class="px-3 py-2.5 border rounded-lg" placeholder="CA" />
        <input name="zip_code" class="px-3 py-2.5 border rounded-lg" placeholder="ZIP" />
      </div>
      <input name="home_phone" class="w-full px-3 py-2.5 border rounded-lg" placeholder="${t('hh.home_phone')}" />
      <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">${t('common.cancel')}</button><button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">${t('common.register')}</button></div>
    </form></div>`);
  openModal(box);
  box.querySelector('#hh-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { const { data } = await api.post('/households', Object.fromEntries(new FormData(e.target)));
      closeModal(); toast(t('hh.registered'), 'success'); location.hash = `#/households/${data.household_id}`; }
    catch (err) { toast(err.response?.data?.error || t('common.failed'), 'error'); }
  });
}

async function setHouseholdHead(hhId) {
  const { data } = await api.get(`/households/${hhId}`);
  const members = data.members || [];
  const headId = data.head_member?.member_id;
  const opts = members.map((m)=>`<option value="${m.member_id}" ${String(m.member_id)===String(headId)?'selected':''}>${esc(m.korean_name||m.first_name+' '+m.last_name)}</option>`).join('');
  const box = h(`<div class="p-6"><h3 class="text-lg font-bold mb-4">${t('hh.set_head')}</h3>
    <form id="hh-head-form" class="space-y-3">
      <select name="head_member_id" class="w-full px-3 py-2.5 border rounded-lg">${opts}</select>
      <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">${t('common.cancel')}</button><button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">${t('common.save')}</button></div>
    </form></div>`);
  openModal(box);
  box.querySelector('#hh-head-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target));
    try { await api.put(`/households/${hhId}/head`, payload);
      closeModal(); toast(t('common.saved'), 'success'); router(); }
    catch (err) { toast(err.response?.data?.error || t('common.failed'), 'error'); }
  });
}

async function editHouseholdMemberRole(hhId, memberId, currentRole) {
  const roleOptions = ['head','spouse','child','parent','relative','other']
    .map((role) => `<option value="${role}" ${role===currentRole?'selected':''}>${t('hhrole.' + role)}</option>`)
    .join('');
  const box = h(`<div class="p-6"><h3 class="text-lg font-bold mb-4">${t('common.edit')}</h3>
    <form id="hh-role-form" class="space-y-3">
      <select name="household_role" class="w-full px-3 py-2.5 border rounded-lg">${roleOptions}</select>
      <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">${t('common.cancel')}</button><button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">${t('common.save')}</button></div>
    </form></div>`);
  openModal(box);
  box.querySelector('#hh-role-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target));
    try { await api.put(`/households/${hhId}/members/${memberId}`, payload);
      closeModal(); toast(t('common.saved'), 'success'); router(); }
    catch (err) { toast(err.response?.data?.error || t('common.failed'), 'error'); }
  });
}

async function editHousehold(id) {
  const { data } = await api.get(`/households/${id}`);
  const hh = data.household;
  const box = h(`<div class="p-6"><h3 class="text-lg font-bold mb-4">${t('hh.edit')}</h3>
    <form id="hhe-form" class="space-y-3">
      <input name="household_name" required value="${esc(hh.household_name)}" class="w-full px-3 py-2.5 border rounded-lg" />
      <input name="address_line1" value="${esc(hh.address_line1||'')}" class="w-full px-3 py-2.5 border rounded-lg" placeholder="Street address" />
      <input name="address_line2" value="${esc(hh.address_line2||'')}" class="w-full px-3 py-2.5 border rounded-lg" placeholder="Apt/Suite" />
      <div class="grid grid-cols-3 gap-2">
        <input name="city" value="${esc(hh.city||'')}" class="px-3 py-2.5 border rounded-lg" placeholder="City" />
        <input name="state" maxlength="2" value="${esc(hh.state||'')}" class="px-3 py-2.5 border rounded-lg" placeholder="CA" />
        <input name="zip_code" value="${esc(hh.zip_code||'')}" class="px-3 py-2.5 border rounded-lg" placeholder="ZIP" />
      </div>
      <input name="home_phone" value="${esc(hh.home_phone||'')}" class="w-full px-3 py-2.5 border rounded-lg" placeholder="${t('hh.home_phone')}" />
      <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">${t('common.cancel')}</button><button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">${t('common.save')}</button></div>
    </form></div>`);
  openModal(box);
  box.querySelector('#hhe-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.put(`/households/${id}`, Object.fromEntries(new FormData(e.target)));
      closeModal(); toast(t('common.saved'), 'success'); router(); }
    catch (err) { toast(err.response?.data?.error || t('common.failed'), 'error'); }
  });
}

async function addMemberToHousehold(hhId) {
  const { data } = await api.get('/members', { params: {} });
  const opts = data.members.map((m)=>`<option value="${m.member_id}">${esc(m.korean_name||m.first_name+' '+m.last_name)}</option>`).join('');
  const box = h(`<div class="p-6"><h3 class="text-lg font-bold mb-4">${t('hh.add_member')}</h3>
    <form id="hm-form" class="space-y-3">
      <select name="member_id" class="w-full px-3 py-2.5 border rounded-lg">${opts}</select>
      <select name="household_role" class="w-full px-3 py-2.5 border rounded-lg">
        <option value="head">${t('hhrole.head')}</option><option value="spouse">${t('hhrole.spouse')}</option><option value="child">${t('hhrole.child')}</option><option value="parent">${t('hhrole.parent')}</option><option value="relative">${t('hhrole.relative')}</option><option value="other">${t('hhrole.other')}</option></select>
      <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">${t('common.cancel')}</button><button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">${t('common.add')}</button></div>
    </form></div>`);
  openModal(box);
  box.querySelector('#hm-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.post(`/households/${hhId}/members`, Object.fromEntries(new FormData(e.target)));
      closeModal(); toast(t('hh.member_added'), 'success'); router(); }
    catch (err) { toast(err.response?.data?.error || t('common.failed'), 'error'); }
  });
}
async function removeFromHousehold(hhId, memberId) {
  if (!confirm(t('hh.remove_confirm'))) return;
  await api.delete(`/households/${hhId}/members/${memberId}`);
  toast(t('hh.removed'), 'success'); router();
}

/* ---------------- Admin ---------------- */
Pages.admin = async function (content, tab) {
  if (!isAdmin()) { content.innerHTML = `<div class="card p-12 text-center text-slate-400"><i class="fas fa-lock text-2xl mb-2"></i><p>${t('common.no_permission')}</p></div>`; return; }
  const tabs = [['users',t('admin.tab.users'),'fa-users-gear'],['positions',t('admin.tab.positions'),'fa-id-badge'],['languages',t('admin.tab.languages'),'fa-language'],['orgs',t('admin.tab.orgs'),'fa-sitemap'],['calendar',t('admin.tab.calendar'),'fa-calendar-days'],['email',t('admin.tab.email'),'fa-envelope']];
  content.innerHTML = `
    <h2 class="text-xl font-bold text-slate-800 mb-4">${t('admin.title')}</h2>
    <div class="flex gap-2 mb-4 overflow-x-auto">${tabs.map(([t,l,i])=>`
      <a href="#/admin/${t}" class="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${t===tab?'bg-brand-600 text-white':'bg-white border text-slate-600'}"><i class="fas ${i} mr-1"></i>${l}</a>`).join('')}</div>
    <div id="admin-body">${loadingHtml('')}</div>`;
  const body = el('admin-body');
  if (tab === 'users') return adminUsers(body);
  if (tab === 'positions') return adminPositions(body);
  if (tab === 'languages') return adminLanguages(body);
  if (tab === 'orgs') return adminOrgs(body);
  if (tab === 'calendar') return adminCalendar(body);
  if (tab === 'email') return adminEmail(body);
};

async function adminUsers(body) {
  const [{ data: ud }, { data: rd }] = await Promise.all([api.get('/admin/users'), api.get('/admin/roles')]);
  body.innerHTML = `
    <div class="flex justify-end mb-3"><button onclick="createUser()" class="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"><i class="fas fa-user-plus mr-1"></i>${t('admin.add_user')}</button></div>
    <div class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-slate-500 text-xs"><tr><th class="text-left p-3">${t('admin.th.user')}</th><th class="text-left p-3 hidden sm:table-cell">${t('admin.th.email')}</th><th class="text-left p-3">${t('admin.th.role')}</th><th class="text-left p-3 hidden md:table-cell">${t('admin.th.login')}</th><th class="p-3">${t('admin.th.status')}</th></tr></thead>
        <tbody>${(ud.users||[]).map((u)=>{
          const statusLabel = u.is_active ? t('admin.active') : t('admin.pending');
          const statusClass = u.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600';
          return `
          <tr class="border-t border-slate-100">
            <td class="p-3"><div class="font-medium text-slate-800">${esc(u.display_name||u.username)}</div><div class="text-xs text-slate-400">@${esc(u.username)}${u.oauth_provider?` · ${esc(u.oauth_provider)}`:''}</div></td>
            <td class="p-3 hidden sm:table-cell text-slate-500">${esc(u.email||'-')}</td>
            <td class="p-3"><span class="text-xs text-slate-600">${esc(u.roles||t('admin.no_roles'))}</span></td>
            <td class="p-3 hidden md:table-cell text-xs text-slate-400">${u.last_login_at?esc(u.last_login_at.slice(0,10)):'-'}</td>
            <td class="p-3 text-center">
              <div class="flex items-center justify-center gap-2">
                <span class="badge ${statusClass}">${statusLabel}</span>
                ${u.is_active ? '' : `<button onclick="approveUser(${u.user_id})" class="text-emerald-500" title="${t('admin.tip.approve')}"><i class="fas fa-user-check"></i></button>`}
                <button onclick="editUserRoles(${u.user_id}, '${esc(u.roles||'')}')" class="text-slate-400 hover:text-brand-600" title="${t('admin.tip.role')}"><i class="fas fa-user-tag"></i></button>
                <button onclick="resetUserPw(${u.user_id})" class="text-slate-400 hover:text-amber-600" title="${t('admin.tip.password')}"><i class="fas fa-key"></i></button>
                <button onclick="toggleUser(${u.user_id}, ${u.is_active?0:1})" class="${u.is_active?'text-emerald-500':'text-slate-300'}" title="${u.is_active ? t('admin.tip.deactivate') : t('admin.tip.activate')}"><i class="fas fa-power-off"></i></button>
                <button onclick="deleteUser(${u.user_id}, '${esc(u.display_name||u.username)}')" class="text-slate-400 hover:text-red-500" title="${t('admin.tip.delete')}"><i class="fas fa-trash"></i></button>
              </div>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>
    <input type="hidden" id="roles-cache" value='${esc(JSON.stringify(rd.roles))}' />`;
}

async function createUser() {
  const { data: rd } = await api.get('/admin/roles');
  const roleOpts = rd.roles.map((r)=>`<option value="${r.role_id}">${esc(r.name)}</option>`).join('');
  const box = h(`<div class="p-6"><h3 class="text-lg font-bold mb-4">${t('admin.add_user')}</h3>
    <form id="u-form" class="space-y-3">
      <input name="display_name" class="w-full px-3 py-2.5 border rounded-lg" placeholder="${t('admin.user_name_ph')}" />
      <input name="username" required class="w-full px-3 py-2.5 border rounded-lg" placeholder="${t('admin.user_id_ph')}" />
      <input name="email" type="email" required class="w-full px-3 py-2.5 border rounded-lg" placeholder="${t('admin.user_email_ph')}" />
      <input name="password" type="password" required class="w-full px-3 py-2.5 border rounded-lg" placeholder="${t('admin.user_pw_ph')}" />
      <select name="role_id" class="w-full px-3 py-2.5 border rounded-lg">${roleOpts}</select>
      <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">${t('common.cancel')}</button><button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">${t('common.add')}</button></div>
    </form></div>`);
  openModal(box);
  box.querySelector('#u-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.post('/admin/users', Object.fromEntries(new FormData(e.target)));
      closeModal(); toast(t('admin.user_added'), 'success'); router(); }
    catch (err) { toast(err.response?.data?.error || t('common.failed'), 'error'); }
  });
}

async function editUserRoles(userId) {
  const { data: rd } = await api.get('/admin/roles');
  const box = h(`<div class="p-6"><h3 class="text-lg font-bold mb-4">${t('admin.role_setting')}</h3>
    <form id="ur-form" class="space-y-2">
      ${rd.roles.map((r)=>`<label class="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50"><input type="checkbox" name="role" value="${r.role_id}" /> <span class="text-sm font-medium text-slate-700">${esc(r.name)}</span> <span class="text-xs text-slate-400">${esc(r.code)}</span></label>`).join('')}
      <div class="flex gap-2 pt-3"><button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">${t('common.cancel')}</button><button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">${t('common.save')}</button></div>
    </form></div>`);
  openModal(box);
  box.querySelector('#ur-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const role_ids = [...e.target.querySelectorAll('input[name=role]:checked')].map((c)=>parseInt(c.value,10));
    try { await api.put(`/admin/users/${userId}/roles`, { role_ids });
      closeModal(); toast(t('admin.role_saved'), 'success'); router(); }
    catch (err) { toast(err.response?.data?.error || t('common.failed'), 'error'); }
  });
}
async function resetUserPw(userId) {
  const pw = prompt(t('admin.new_pw_prompt')); if (!pw) return;
  try { await api.put(`/admin/users/${userId}/password`, { password: pw }); toast(t('admin.pw_changed'), 'success'); }
  catch (err) { toast(err.response?.data?.error || t('common.failed'), 'error'); }
}
async function approveUser(userId) {
  await api.put(`/admin/users/${userId}/active`, { is_active: 1 });
  toast(t('admin.approved'), 'success'); router();
}

async function toggleUser(userId, active) {
  await api.put(`/admin/users/${userId}/active`, { is_active: active });
  toast(t('admin.status_changed'), 'success'); router();
}

async function deleteUser(userId, name) {
  if (!confirm(t('admin.user_delete_confirm', { name }))) return;
  try {
    await api.delete(`/admin/users/${userId}`);
    toast(t('admin.user_deleted'), 'success');
    router();
  } catch (err) {
    toast(err.response?.data?.error || t('common.failed'), 'error');
  }
}

async function adminPositions(body) {
  const { data } = await api.get('/admin/positions');
  const grouped = {};
  data.positions.forEach((p)=>{ (grouped[p.position_type]=grouped[p.position_type]||[]).push(p); });
  window.__positionsCache = data.positions || [];
  body.innerHTML = `
    <div class="flex justify-end mb-3"><button onclick="addPosition()" class="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"><i class="fas fa-plus mr-1"></i>${t('admin.add_position')}</button></div>
    ${Object.keys(grouped).map((pt)=>`<div class="card p-4 mb-3"><div class="text-xs font-bold text-slate-400 uppercase mb-2">${t('ptype.' + pt)}</div>
      <div class="flex flex-wrap gap-2">${grouped[pt].map((p)=>`<span class="badge bg-slate-100 text-slate-600 text-sm py-1.5">${esc(p.name)}
        <button onclick="editPosition(${p.position_id})" class="ml-1 text-slate-300 hover:text-brand-600" title="${t('common.edit')}"><i class="fas fa-pen"></i></button>
        <button onclick="delPosition(${p.position_id})" class="ml-1 text-slate-300 hover:text-red-500" title="${t('common.delete')}"><i class="fas fa-times"></i></button>
      </span>`).join('')}</div></div>`).join('')}`;
}
async function addPosition() {
  const box = h(`<div class="p-6"><h3 class="text-lg font-bold mb-4">${t('admin.add_position')}</h3>
    <form id="p-form" class="space-y-3">
      <input name="name" required class="w-full px-3 py-2.5 border rounded-lg" placeholder="${t('admin.position_name')}" />
      <select name="position_type" class="w-full px-3 py-2.5 border rounded-lg">${['임원','조직장','교역자','교사','학생','직원','일반'].map((pt)=>`<option value="${pt}">${t('ptype.'+pt)}</option>`).join('')}</select>
      <input name="rank_order" type="number" value="99" class="w-full px-3 py-2.5 border rounded-lg" placeholder="${t('admin.rank_order')}" />
      <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">${t('common.cancel')}</button><button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">${t('common.add')}</button></div>
    </form></div>`);
  openModal(box);
  box.querySelector('#p-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.post('/admin/positions', Object.fromEntries(new FormData(e.target)));
      closeModal(); toast(t('admin.added'), 'success'); router(); } catch (err) { toast(t('common.failed'), 'error'); }
  });
}
async function editPosition(positionId) {
  const positions = window.__positionsCache || [];
  const p = positions.find((item) => String(item.position_id) === String(positionId));
  if (!p) return;
  const box = h(`<div class="p-6"><h3 class="text-lg font-bold mb-4">${t('admin.edit_position')}</h3>
    <form id="p-edit-form" class="space-y-3">
      <input name="name" required value="${esc(p.name||'')}" class="w-full px-3 py-2.5 border rounded-lg" placeholder="${t('admin.position_name')}" />
      <select name="position_type" class="w-full px-3 py-2.5 border rounded-lg">${['임원','조직장','교역자','교사','학생','직원','일반'].map((pt)=>`<option value="${pt}" ${p.position_type===pt?'selected':''}>${t('ptype.'+pt)}</option>`).join('')}</select>
      <input name="rank_order" type="number" value="${p.rank_order ?? 99}" class="w-full px-3 py-2.5 border rounded-lg" placeholder="${t('admin.rank_order')}" />
      <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">${t('common.cancel')}</button><button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">${t('common.save')}</button></div>
    </form></div>`);
  openModal(box);
  box.querySelector('#p-edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.put(`/admin/positions/${positionId}`, Object.fromEntries(new FormData(e.target)));
      closeModal(); toast(t('common.saved'), 'success'); router(); } catch (err) { toast(t('common.failed'), 'error'); }
  });
}
async function delPosition(id) { if (!confirm(t('admin.del_confirm'))) return; await api.delete(`/admin/positions/${id}`); toast(t('admin.deleted'),'success'); router(); }

async function adminLanguages(body) {
  const { data } = await api.get('/admin/languages');
  body.innerHTML = `
    <div class="flex justify-end mb-3"><button onclick="addLanguage()" class="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"><i class="fas fa-plus mr-1"></i>${t('admin.add_language')}</button></div>
    <div class="card p-4"><div class="flex flex-wrap gap-2">${data.languages.map((l)=>`<span class="badge bg-slate-100 text-slate-600 text-sm py-1.5">${esc(l.name_native||l.name_en)} <span class="text-xs text-slate-400">${esc(l.code)}</span></span>`).join('')}</div></div>`;
}

async function adminCalendar(body) {
  const { data } = await api.get('/admin/calendar');
  const c = data.calendar || {};
  body.innerHTML = `
    <div class="card p-5">
      <h3 class="text-lg font-bold text-slate-800 mb-1">${t('admin.calendar_title')}</h3>
      <p class="text-sm text-slate-500 mb-4">${t('admin.calendar_desc')}</p>
      <form id="calendar-form" class="space-y-3">
        <label class="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" name="is_enabled" ${c.is_enabled? 'checked' : ''} /> ${t('admin.calendar_enabled')}</label>
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('admin.calendar_id')}</label><input name="calendar_id" value="${esc(c.calendar_id||'')}" class="w-full px-3 py-2.5 border rounded-lg" /></div>
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('admin.calendar_timezone')}</label><input name="timezone" value="${esc(c.timezone||'America/Los_Angeles')}" class="w-full px-3 py-2.5 border rounded-lg" /></div>
        <div><label class="block text-xs font-semibold text-slate-600 mb-1">${t('admin.calendar_service_account')}</label>
          <textarea name="service_account_json" rows="6" class="w-full px-3 py-2.5 border rounded-lg" placeholder="{\n  \"type\": \"service_account\", ...\n}">${esc(c.service_account_json||'')}</textarea>
        </div>
        <div class="flex justify-end pt-2"><button type="submit" class="px-4 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">${t('common.save')}</button></div>
      </form>
    </div>`;

  const form = body.querySelector('#calendar-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(form));
    try {
      await api.put('/admin/calendar', payload);
      toast(t('admin.calendar_saved'), 'success');
    } catch (err) {
      toast(err.response?.data?.error || t('common.failed'), 'error');
    }
  });
}

async function adminEmail(body) {
  const { data } = await api.get('/admin/email/status');
  const status = data.status || {};
  const statusBadge = (ok) => `<span class="badge ${ok ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}">${ok ? t('admin.email_ready') : t('admin.email_missing')}</span>`;
  const rows = [
    { key: 'client_id', label: t('admin.email_client_id') },
    { key: 'client_secret', label: t('admin.email_client_secret') },
    { key: 'refresh_token', label: t('admin.email_refresh_token') },
    { key: 'sender', label: t('admin.email_sender') },
    { key: 'base_url', label: t('admin.email_base_url') },
  ];
  body.innerHTML = `
    <div class="card p-5 mb-4">
      <h3 class="text-lg font-bold text-slate-800 mb-1">${t('admin.email_title')}</h3>
      <p class="text-sm text-slate-500 mb-4">${t('admin.email_desc')}</p>
      <div class="space-y-2">
        ${rows.map((r)=>`
          <div class="flex items-center justify-between text-sm border-b border-slate-100 pb-2">
            <span class="text-slate-600">${r.label}</span>
            ${statusBadge(status[r.key])}
          </div>
        `).join('')}
      </div>
      <div class="mt-4 text-xs text-slate-500">
        <div>${t('admin.email_sender_value')}: <span class="font-semibold text-slate-700">${esc(data.sender || '-')}</span></div>
        <div>${t('admin.email_base_url_value')}: <span class="font-semibold text-slate-700">${esc(data.base_url || '-')}</span></div>
      </div>
    </div>
    <div class="card p-5">
      <h4 class="font-bold text-slate-700 mb-2">${t('admin.email_setup_title')}</h4>
      <div class="text-sm text-slate-600 space-y-2">
        <div>${t('admin.email_setup_local')}</div>
        <div class="text-xs text-slate-500">.dev.vars: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER, APP_BASE_URL</div>
        <div>${t('admin.email_setup_prod')}</div>
        <div class="text-xs text-slate-500">wrangler secret put GMAIL_CLIENT_ID (etc.) 또는 Cloudflare Pages 환경변수 설정</div>
      </div>
    </div>`;
}

async function addLanguage() {
  const box = h(`<div class="p-6"><h3 class="text-lg font-bold mb-4">${t('admin.add_language')}</h3>
    <form id="l-form" class="space-y-3">
      <input name="code" required class="w-full px-3 py-2.5 border rounded-lg" placeholder="${t('admin.lang_code_ph')}" />
      <input name="name_en" required class="w-full px-3 py-2.5 border rounded-lg" placeholder="${t('admin.lang_en_ph')}" />
      <input name="name_native" class="w-full px-3 py-2.5 border rounded-lg" placeholder="${t('admin.lang_native_ph')}" />
      <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">${t('common.cancel')}</button><button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">${t('common.add')}</button></div>
    </form></div>`);
  openModal(box);
  box.querySelector('#l-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.post('/admin/languages', Object.fromEntries(new FormData(e.target)));
      closeModal(); toast(t('admin.added'), 'success'); router(); } catch (err) { toast(t('common.failed'),'error'); }
  });
}

async function adminOrgs(body) {
  const [{ data: gd }, { data: cd }] = await Promise.all([api.get('/orgs/groups'), api.get('/admin/categories')]);
  const byCat = {};
  gd.groups.forEach((g)=>{ (byCat[g.category_code]=byCat[g.category_code]||[]).push(g); });
  body.innerHTML = `
    <div class="flex justify-end mb-3"><button onclick='addGroup(${esc(JSON.stringify(cd.categories))})' class="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"><i class="fas fa-plus mr-1"></i>${t('admin.add_org')}</button></div>
    ${Object.keys(byCat).map((code)=>{ const meta=CATEGORY_META[code]||{};
      return `<div class="card p-4 mb-3"><div class="font-bold text-slate-700 mb-2"><i class="fas ${meta.icon||'fa-folder'} ${meta.color||''} mr-2"></i>${catLabel(code)}</div>
      <div class="space-y-1">${byCat[code].map((g)=>`<div class="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-sm" style="margin-left:${g.parent_id?'16px':'0'}">
        <span class="text-slate-700">${esc(g.name)} <span class="text-xs text-slate-400">(${esc(g.level_type)}${g.service_area?' · '+esc(g.service_area):''}) · ${g.member_count}${t('common.people_unit')}</span></span>
        <div class="flex items-center gap-2">
          <button onclick="editGroup(${g.group_id})" class="text-slate-300 hover:text-brand-600" title="${t('common.edit')}"><i class="fas fa-pen text-xs"></i></button>
          <button onclick="delGroup(${g.group_id})" class="text-slate-300 hover:text-red-500"><i class="fas fa-trash text-xs"></i></button>
        </div></div>`).join('')}</div></div>`;
    }).join('')}`;
  window.__orgsCache = gd.groups || [];
  window.__orgCats = cd.categories || [];
}
async function addGroup(categories) {
  const { data: gd } = await api.get('/orgs/groups');
  const catOpts = categories.map((c)=>`<option value="${c.category_id}">${esc(c.name)}</option>`).join('');
  const parentOpts = `<option value="">${t('orgs.top_level')}</option>` + gd.groups.map((g)=>`<option value="${g.group_id}">${esc(g.name)}</option>`).join('');
  const box = h(`<div class="p-6"><h3 class="text-lg font-bold mb-4">${t('admin.add_org')}</h3>
    <form id="g-form" class="space-y-3">
      <select name="category_id" class="w-full px-3 py-2.5 border rounded-lg">${catOpts}</select>
      <input name="name" required class="w-full px-3 py-2.5 border rounded-lg" placeholder="${t('orgs.org_name')}" />
      <select name="level_type" class="w-full px-3 py-2.5 border rounded-lg">${['교구','구역','조','부서','반','팀','기타'].map((lv)=>`<option>${lv}</option>`).join('')}</select>
      <select name="parent_id" class="w-full px-3 py-2.5 border rounded-lg">${parentOpts}</select>
      <input name="service_area" class="w-full px-3 py-2.5 border rounded-lg" placeholder="${t('orgs.service_area')}" />
      <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">${t('common.cancel')}</button><button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">${t('common.add')}</button></div>
    </form></div>`);
  openModal(box);
  box.querySelector('#g-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target));
    try { await api.post('/admin/groups', payload); closeModal(); toast(t('admin.org_added'), 'success'); router(); }
    catch (err) { toast(err.response?.data?.error || t('common.failed'), 'error'); }
  });
}

function editGroup(groupId) {
  const groups = window.__orgsCache || [];
  const categories = window.__orgCats || [];
  const g = groups.find((item) => String(item.group_id) === String(groupId));
  if (!g) return;
  const catOpts = categories.map((c)=>`<option value="${c.category_id}" ${String(c.category_id)===String(g.category_id)?'selected':''}>${esc(c.name)}</option>`).join('');
  const parentOpts = `<option value="">${t('orgs.top_level')}</option>` +
    groups.filter((item) => item.group_id !== g.group_id)
      .map((item)=>`<option value="${item.group_id}" ${String(item.group_id)===String(g.parent_id)?'selected':''}>${esc(item.name)}</option>`).join('');
  const levelOpts = ['교구','구역','조','부서','반','팀','기타']
    .map((lv)=>`<option ${g.level_type===lv?'selected':''}>${lv}</option>`).join('');
  const box = h(`<div class="p-6"><h3 class="text-lg font-bold mb-4">${t('orgs.edit_title')}</h3>
    <form id="g-edit-form" class="space-y-3">
      <select name="category_id" class="w-full px-3 py-2.5 border rounded-lg bg-slate-50" disabled>${catOpts}</select>
      <input name="name" required value="${esc(g.name||'')}" class="w-full px-3 py-2.5 border rounded-lg" placeholder="${t('orgs.org_name')}" />
      <select name="level_type" class="w-full px-3 py-2.5 border rounded-lg">${levelOpts}</select>
      <select name="parent_id" class="w-full px-3 py-2.5 border rounded-lg">${parentOpts}</select>
      <input name="service_area" value="${esc(g.service_area||'')}" class="w-full px-3 py-2.5 border rounded-lg" placeholder="${t('orgs.service_area')}" />
      <input name="sort_order" type="number" value="${g.sort_order ?? 0}" class="w-full px-3 py-2.5 border rounded-lg" placeholder="${t('orgs.sort_order')}" />
      <label class="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" name="is_active" ${g.is_active? 'checked' : ''} /> ${t('orgs.is_active')}</label>
      <div class="flex gap-2 pt-2"><button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-slate-600">${t('common.cancel')}</button><button type="submit" class="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-semibold">${t('common.save')}</button></div>
    </form></div>`);
  openModal(box);
  box.querySelector('#g-edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      name: fd.get('name'),
      level_type: fd.get('level_type'),
      parent_id: fd.get('parent_id') || null,
      service_area: fd.get('service_area') || null,
      sort_order: fd.get('sort_order') ? parseInt(fd.get('sort_order'), 10) : 0,
      is_active: fd.get('is_active') ? 1 : 0,
    };
    try { await api.put(`/admin/groups/${g.group_id}`, payload); closeModal(); toast(t('orgs.updated'), 'success'); router(); }
    catch (err) { toast(err.response?.data?.error || t('common.failed'), 'error'); }
  });
}
async function delGroup(id) { if (!confirm(t('admin.deactivate_confirm'))) return; await api.delete(`/admin/groups/${id}`); toast(t('admin.processed'),'success'); router(); }
