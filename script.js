/* ======================================================================
   KONFIGURASI BACKEND
   ----------------------------------------------------------------------
   Isi dengan URL Web App Apps Script yang SAMA PERSIS dengan yang
   dipakai di website pendaftaran (script.js). Panduan lengkap ada di
   SETUP.md.
   ====================================================================== */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzQSBhasUBzhhQnXWN2ernSVZLUlWG_ezi-WrhpfQZIEl4Oob8NLiRktKrNawkds_7d/exec";

const SESSION_KEYS = {
  token: 'icosa14_admin_token',
  expiry: 'icosa14_admin_token_expiry',
  role: 'icosa14_admin_role',
  lombaList: 'icosa14_admin_lomba_list'
};

const LOMBA_LABELS = {
  'MHQ': 'MHQ',
  'BADMINTON': 'Badminton',
  'LCCU': 'LCCU',
  'KALIGRAFI': 'Kaligrafi',
  'PIDATO': 'Pidato',
  'FUTSAL': 'Futsal',
  'POSTER DIGITAL': 'Poster Digital'
};

const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const roleLabel = document.getElementById('roleLabel');
const tabsNav = document.getElementById('tabs');
const panelCount = document.getElementById('panelCount');
const refreshBtn = document.getElementById('refreshBtn');
const downloadBtn = document.getElementById('downloadBtn');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
const tableWrap = document.getElementById('tableWrap');
const emptyState = document.getElementById('emptyState');
const dataTable = document.getElementById('dataTable');
const tableHead = document.getElementById('tableHead');
const tableBody = document.getElementById('tableBody');

let currentLomba = null;
let currentHeaders = [];
let currentRows = [];
let currentRowNumbers = [];
let selectedRows = new Set();

function getToken(){ return sessionStorage.getItem(SESSION_KEYS.token); }
function getTokenExpiry(){ return Number(sessionStorage.getItem(SESSION_KEYS.expiry) || 0); }
function getRole(){ return sessionStorage.getItem(SESSION_KEYS.role); }
function getLombaList(){
  try{ return JSON.parse(sessionStorage.getItem(SESSION_KEYS.lombaList) || '[]'); }
  catch(e){ return []; }
}

function isSessionValid(){
  return getToken() && Date.now() < getTokenExpiry() && getLombaList().length > 0;
}

function showDashboard(){
  loginScreen.classList.add('hidden');
  dashboard.classList.remove('hidden');

  const role = getRole();
  roleLabel.textContent = 'PANITIA · DATA PENDAFTAR' + (role === 'AKHWAT' ? ' (AKHWAT)' : ' (IKHWAN)');

  buildTabs();
}

function showLogin(message){
  dashboard.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  loginError.textContent = message || '';
  Object.values(SESSION_KEYS).forEach(k => sessionStorage.removeItem(k));
}

/* ---------------- LOGIN ---------------- */

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';

  if(APPS_SCRIPT_URL.includes('PASTE_URL')){
    loginError.textContent = 'Backend belum dikonfigurasi (APPS_SCRIPT_URL kosong).';
    return;
  }

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  loginBtn.disabled = true;
  loginBtn.textContent = 'Memeriksa...';

  try{
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'login', username, password })
    });
    const result = await res.json();

    if(result.ok){
      sessionStorage.setItem(SESSION_KEYS.token, result.token);
      sessionStorage.setItem(SESSION_KEYS.expiry, String(result.expiry));
      sessionStorage.setItem(SESSION_KEYS.role, result.role);
      sessionStorage.setItem(SESSION_KEYS.lombaList, JSON.stringify(result.lombaList || []));
      loginForm.reset();
      showDashboard();
    } else {
      loginError.textContent = result.error || 'Login gagal.';
    }
  } catch(err){
    loginError.textContent = 'Gagal terhubung ke server (' + err.message + ').';
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Masuk';
  }
});

logoutBtn.addEventListener('click', () => {
  showLogin('');
});

/* ---------------- TABS (dibangun sesuai akun yang login) ---------------- */

function buildTabs(){
  const lombaList = getLombaList();
  tabsNav.innerHTML = '';

  lombaList.forEach((lomba, idx) => {
    const btn = document.createElement('button');
    btn.className = 'tab' + (idx === 0 ? ' active' : '');
    btn.dataset.lomba = lomba;
    btn.textContent = LOMBA_LABELS[lomba] || lomba;
    tabsNav.appendChild(btn);
  });

  currentLomba = lombaList[0] || null;
  if(currentLomba) loadLombaData(currentLomba);
}

tabsNav.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if(!btn) return;
  tabsNav.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  currentLomba = btn.dataset.lomba;
  loadLombaData(currentLomba);
});

refreshBtn.addEventListener('click', () => currentLomba && loadLombaData(currentLomba));

/* ---------------- LOAD DATA ---------------- */

async function loadLombaData(lomba){
  if(!isSessionValid()){
    showLogin('Sesi berakhir, silakan login ulang.');
    return;
  }

  selectedRows = new Set();
  updateDeleteButton();

  emptyState.textContent = 'Memuat data pendaftar...';
  emptyState.classList.remove('hidden');
  dataTable.classList.add('hidden');
  panelCount.textContent = 'Memuat data...';
  downloadBtn.disabled = true;

  try{
    const url = APPS_SCRIPT_URL
      + '?action=getData'
      + '&lomba=' + encodeURIComponent(lomba)
      + '&token=' + encodeURIComponent(getToken());

    const res = await fetch(url, { method: 'GET' });
    const result = await res.json();

    if(!result.ok){
      if((result.error || '').toLowerCase().includes('sesi')){
        showLogin(result.error);
        return;
      }
      emptyState.textContent = 'Gagal memuat data: ' + (result.error || 'error tidak diketahui');
      panelCount.textContent = '';
      return;
    }

    currentHeaders = result.headers || [];
    currentRows = result.rows || [];
    currentRowNumbers = result.rowNumbers || [];
    renderTable();
  } catch(err){
    emptyState.textContent = 'Gagal terhubung ke server (' + err.message + ').';
    panelCount.textContent = '';
  }
}

function renderTable(){
  const label = LOMBA_LABELS[currentLomba] || currentLomba;
  panelCount.textContent = currentRows.length + ' baris — ' + label;

  if(currentRows.length === 0){
    emptyState.textContent = 'Belum ada pendaftar untuk lomba ini.';
    emptyState.classList.remove('hidden');
    dataTable.classList.add('hidden');
    downloadBtn.disabled = true;
    return;
  }

  emptyState.classList.add('hidden');
  dataTable.classList.remove('hidden');
  downloadBtn.disabled = false;

  const headRow = document.createElement('tr');
  const selectTh = document.createElement('th');
  selectTh.className = 'select-col';
  const selectAllCb = document.createElement('input');
  selectAllCb.type = 'checkbox';
  selectAllCb.id = 'selectAllCb';
  selectAllCb.addEventListener('change', () => {
    if(selectAllCb.checked){
      currentRowNumbers.forEach(rn => selectedRows.add(rn));
    } else {
      selectedRows.clear();
    }
    renderTable();
  });
  selectTh.appendChild(selectAllCb);
  headRow.appendChild(selectTh);

  currentHeaders.forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    headRow.appendChild(th);
  });
  tableHead.innerHTML = '';
  tableHead.appendChild(headRow);

  tableBody.innerHTML = '';
  currentRows.forEach((row, idx) => {
    const rowNumber = currentRowNumbers[idx];
    const tr = document.createElement('tr');
    if(selectedRows.has(rowNumber)) tr.classList.add('row-selected');

    const selectTd = document.createElement('td');
    selectTd.className = 'select-col';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = selectedRows.has(rowNumber);
    cb.addEventListener('change', () => {
      if(cb.checked) selectedRows.add(rowNumber);
      else selectedRows.delete(rowNumber);
      tr.classList.toggle('row-selected', cb.checked);
      updateDeleteButton();
    });
    selectTd.appendChild(cb);
    tr.appendChild(selectTd);

    currentHeaders.forEach(h => {
      const td = document.createElement('td');
      const val = row[h] !== undefined && row[h] !== null ? row[h] : '';
      td.textContent = val;
      td.title = val;
      tr.appendChild(td);
    });

    tableBody.appendChild(tr);
  });

  updateDeleteButton();
}

function updateDeleteButton(){
  const n = selectedRows.size;
  deleteSelectedBtn.textContent = 'Hapus Terpilih (' + n + ')';
  deleteSelectedBtn.disabled = n === 0;
}

/* ---------------- HAPUS DATA TERPILIH ---------------- */

deleteSelectedBtn.addEventListener('click', () => {
  const n = selectedRows.size;
  if(n === 0) return;
  const sure = window.confirm('Hapus ' + n + ' baris data dari ' + (LOMBA_LABELS[currentLomba] || currentLomba) + '? Tindakan ini tidak bisa dibatalkan.');
  if(sure) deleteSelectedRows();
});

async function deleteSelectedRows(){
  if(!isSessionValid()){
    showLogin('Sesi berakhir, silakan login ulang.');
    return;
  }

  deleteSelectedBtn.disabled = true;
  deleteSelectedBtn.textContent = 'Menghapus...';

  try{
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'deleteRows',
        token: getToken(),
        lomba: currentLomba,
        rowNumbers: Array.from(selectedRows)
      })
    });
    const result = await res.json();

    if(result.ok){
      loadLombaData(currentLomba);
    } else {
      if((result.error || '').toLowerCase().includes('sesi')){
        showLogin(result.error);
        return;
      }
      alert('Gagal menghapus: ' + (result.error || 'error tidak diketahui'));
      updateDeleteButton();
    }
  } catch(err){
    alert('Gagal terhubung ke server (' + err.message + ').');
    updateDeleteButton();
  }
}

/* ---------------- DOWNLOAD EXCEL ---------------- */

downloadBtn.addEventListener('click', () => {
  if(currentRows.length === 0) return;

  const aoa = [currentHeaders];
  currentRows.forEach(row => {
    aoa.push(currentHeaders.map(h => row[h] !== undefined && row[h] !== null ? row[h] : ''));
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  const sheetLabel = (LOMBA_LABELS[currentLomba] || currentLomba).substring(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetLabel);

  const fileName = 'Pendaftar_' + currentLomba.replace(/\s+/g, '_') + '.xlsx';
  XLSX.writeFile(wb, fileName);
});

/* ---------------- INIT ---------------- */

if(isSessionValid()){
  showDashboard();
} else {
  showLogin('');
}
