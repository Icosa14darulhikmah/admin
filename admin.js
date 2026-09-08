const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyAcBcHbrayot7S2c329_nwkGtN9uSarfOSXbE-uGBwPgL8c7XCrwvlALa953genb85/exec";

const SESSION_KEY = 'icosa14_admin_token';
const SESSION_EXPIRY_KEY = 'icosa14_admin_token_expiry';

const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const tabsNav = document.getElementById('tabs');
const panelCount = document.getElementById('panelCount');
const refreshBtn = document.getElementById('refreshBtn');
const downloadBtn = document.getElementById('downloadBtn');
const emptyState = document.getElementById('emptyState');
const dataTable = document.getElementById('dataTable');
const tableHead = document.getElementById('tableHead');
const tableBody = document.getElementById('tableBody');

let currentLomba = 'MHQ';
let currentHeaders = [];
let currentRows = [];

function getToken(){ return sessionStorage.getItem(SESSION_KEY); }
function getTokenExpiry(){ return Number(sessionStorage.getItem(SESSION_EXPIRY_KEY) || 0); }
function isSessionValid(){ return getToken() && Date.now() < getTokenExpiry(); }

function showDashboard(){
  loginScreen.classList.add('hidden');
  dashboard.classList.remove('hidden');
  loadLombaData(currentLomba);
}

function showLogin(message){
  dashboard.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  loginError.textContent = message || '';
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_EXPIRY_KEY);
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
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
      sessionStorage.setItem(SESSION_KEY, result.token);
      sessionStorage.setItem(SESSION_EXPIRY_KEY, String(result.expiry));
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

logoutBtn.addEventListener('click', () => showLogin(''));

tabsNav.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if(!btn) return;
  tabsNav.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  currentLomba = btn.dataset.lomba;
  loadLombaData(currentLomba);
});

refreshBtn.addEventListener('click', () => loadLombaData(currentLomba));

async function loadLombaData(lomba){
  if(!isSessionValid()){
    showLogin('Sesi berakhir, silakan login ulang.');
    return;
  }

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
      emptyState.textContent = 'Gagal memuat data: ' + (result.error || 'error');
      panelCount.textContent = '';
      return;
    }

    currentHeaders = result.headers || [];
    currentRows = result.rows || [];
    renderTable();
  } catch(err){
    emptyState.textContent = 'Gagal terhubung ke server (' + err.message + ').';
    panelCount.textContent = '';
  }
}

function renderTable(){
  const mainCount = currentRows.filter(r => r['Peran'] === 'Ketua Tim' || r['Peran'] === 'Peserta').length;
  panelCount.textContent = mainCount + ' Registrasi (' + currentRows.length + ' Baris Data) — ' + currentLomba;

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
  
  // Kolom Aksi Hapus
  const thAction = document.createElement('th');
  thAction.textContent = 'Aksi';
  headRow.appendChild(thAction);

  currentHeaders.forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    headRow.appendChild(th);
  });
  tableHead.innerHTML = '';
  tableHead.appendChild(headRow);

  tableBody.innerHTML = '';
  currentRows.forEach(row => {
    const tr = document.createElement('tr');
    
    // Penanda visual jika baris merupakan Anggota Tim
    const isMember = (row['Peran'] || '').startsWith('Anggota');
    if (isMember) {
      tr.classList.add('row-member');
    }

    // Tombol Delete hanya di baris utama (Ketua/Peserta)
    const tdAction = document.createElement('td');
    if (!isMember) {
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Hapus';
      delBtn.className = 'btn-delete';
      delBtn.onclick = () => deleteRegistration(row['No. Registrasi'], row['Nama Lengkap']);
      tdAction.appendChild(delBtn);
    }
    tr.appendChild(tdAction);

    currentHeaders.forEach(h => {
      const td = document.createElement('td');
      td.textContent = row[h] !== undefined && row[h] !== null ? row[h] : '';
      td.title = td.textContent;
      tr.appendChild(td);
    });

    tableBody.appendChild(tr);
  });
}

async function deleteRegistration(regId, nama) {
  if (!confirm('Apakah Anda yakin ingin menghapus data registrasi "' + nama + '" (' + regId + ')? Semua anggota dalam tim ini juga akan terhapus.')) {
    return;
  }

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'delete',
        token: getToken(),
        lomba: currentLomba,
        regId: regId
      })
    });
    const result = await res.json();
    if (result.ok) {
      alert('Data berhasil dihapus.');
      loadLombaData(currentLomba);
    } else {
      alert('Gagal menghapus: ' + (result.error || 'Terjadi kesalahan.'));
    }
  } catch (err) {
    alert('Terjadi kesalahan jaringan: ' + err.message);
  }
}

downloadBtn.addEventListener('click', () => {
  if(currentRows.length === 0) return;

  const aoa = [currentHeaders];
  currentRows.forEach(row => {
    aoa.push(currentHeaders.map(h => row[h] !== undefined && row[h] !== null ? row[h] : ''));
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, currentLomba.substring(0, 31));

  const fileName = 'Pendaftar_' + currentLomba.replace(/\s+/g, '_') + '.xlsx';
  XLSX.writeFile(wb, fileName);
});

if(isSessionValid()){
  showDashboard();
} else {
  showLogin('');
}