/**
 * Pharma Supply Chain — Enterprise Frontend Application Logic
 * Supports JWT Authentication, Inventory Management, Atomic Shipments, and Tamper-Evident Verification.
 */

const API = '';

// Authentication state
let currentUser = null;
let authToken = localStorage.getItem('pharma_token') || null;

// ======================== UTILITIES ========================
function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Global Loading Bar Control
function setGlobalLoading(isLoading) {
  const bar = document.getElementById('globalLoadingBar');
  if (bar) {
    bar.style.opacity = isLoading ? '1' : '0';
    bar.style.width = isLoading ? '100%' : '0%';
  }
}

// Button Loading State Control
function setButtonLoading(btn, isLoading, originalText) {
  if (!btn) return;
  if (isLoading) {
    btn.disabled = true;
    btn.innerHTML = `<div class="spinner" style="width:14px;height:14px;border-width:2px;border-top-color:currentColor"></div> ${originalText}`;
  } else {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

// Role-based Access Control Matrix
const ROLE_PERMISSIONS = {
  ADMIN: { tabs: ['drugs', 'inventory', 'shipments', 'verify', 'ledger'], forms: ['drugFormCard', 'inventoryFormCard', 'shipmentFormCard'] },
  MANUFACTURER: { tabs: ['drugs', 'inventory', 'shipments', 'ledger'], forms: ['drugFormCard', 'shipmentFormCard'] },
  DISTRIBUTOR: { tabs: ['inventory', 'shipments', 'ledger'], forms: ['shipmentFormCard'] },
  WAREHOUSE: { tabs: ['inventory', 'shipments', 'ledger'], forms: ['inventoryFormCard', 'shipmentFormCard'] },
  PHARMACY: { tabs: ['drugs', 'inventory', 'shipments', 'verify', 'ledger'], forms: [] }
};

function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
}

// ======================== TOAST NOTIFICATIONS ========================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ======================== AUTHENTICATION ========================
function openAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) {
    modal.style.display = 'flex';
  }
}
window.openAuthModal = openAuthModal;

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) {
    modal.style.display = 'none';
  }
}
window.closeAuthModal = closeAuthModal;

function showAuthTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const tabLoginBtn = document.getElementById('tabLoginBtn');
  const tabRegBtn = document.getElementById('tabRegBtn');

  if (tab === 'login') {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    tabLoginBtn.className = 'btn btn-sm btn-primary';
    tabRegBtn.className = 'btn btn-sm btn-outline';
  } else {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    tabLoginBtn.className = 'btn btn-sm btn-outline';
    tabRegBtn.className = 'btn btn-sm btn-primary';
  }
}
window.showAuthTab = showAuthTab;

async function checkAuthStatus() {
  if (!authToken) {
    updateAuthUI(null);
    return;
  }
  setGlobalLoading(true);
  try {
    const res = await fetch(`${API}/auth/me`, { headers: getAuthHeaders() });
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      updateAuthUI(currentUser);
    } else {
      logout();
    }
  } catch {
    updateAuthUI(null);
  } finally {
    setGlobalLoading(false);
  }
}

function applyRoleBasedAccess(user) {
  const tabs = document.querySelectorAll('.nav-tab');
  const mainAppContainer = document.querySelector('.app-container .stats-bar');
  const mainAppNav = document.querySelector('.app-container .nav-tabs');
  const tabContents = document.querySelectorAll('.tab-content');
  
  if (!user) {
    if (mainAppContainer) mainAppContainer.style.display = 'none';
    if (mainAppNav) mainAppNav.style.display = 'none';
    tabContents.forEach(c => c.classList.remove('active'));
    // Ensure we show auth modal if not authenticated
    openAuthModal();
    return;
  }
  
  closeAuthModal();
  if (mainAppContainer) mainAppContainer.style.display = 'grid';
  if (mainAppNav) mainAppNav.style.display = 'flex';
  
  const permissions = ROLE_PERMISSIONS[user.role] || { tabs: [], forms: [] };
  const allowedTabs = permissions.tabs;
  const allowedForms = permissions.forms;
  
  let firstVisibleTab = null;

  tabs.forEach(tab => {
    const tabId = tab.dataset.tab;
    if (allowedTabs.includes(tabId)) {
      tab.style.display = 'flex';
      if (!firstVisibleTab) firstVisibleTab = tab;
    } else {
      tab.style.display = 'none';
    }
  });

  // Hide forms based on role
  const allForms = ['drugFormCard', 'inventoryFormCard', 'shipmentFormCard'];
  allForms.forEach(formId => {
    const formEl = document.getElementById(formId);
    if (formEl) {
      formEl.style.display = allowedForms.includes(formId) ? 'block' : 'none';
    }
  });

  if (firstVisibleTab) {
    firstVisibleTab.click();
  }
}

function updateAuthUI(user) {
  const roleBadge = document.getElementById('userRoleBadge');
  const authBtn = document.getElementById('authBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  if (user) {
    roleBadge.textContent = `${user.name} (${user.role})`;
    roleBadge.style.background = 'rgba(16, 185, 129, 0.2)';
    roleBadge.style.color = '#34d399';
    roleBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    authBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
  } else {
    roleBadge.textContent = 'Guest Mode';
    roleBadge.style.background = 'rgba(99, 102, 241, 0.2)';
    roleBadge.style.color = '#818cf8';
    roleBadge.style.borderColor = 'rgba(99, 102, 241, 0.4)';
    authBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
  }
  
  applyRoleBasedAccess(user);
}

function logout() {
  localStorage.removeItem('pharma_token');
  authToken = null;
  currentUser = null;
  updateAuthUI(null);
  showToast('Logged out successfully', 'info');
}
window.logout = logout;

// Auth Forms
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  setButtonLoading(btn, true, 'Sign In');
  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (res.ok) {
      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('pharma_token', authToken);
      updateAuthUI(currentUser);
      closeAuthModal();
      showToast(`Welcome back, ${currentUser.name}! (${currentUser.role})`, 'success');
    } else {
      showToast(data.error || 'Login failed', 'error');
    }
  } catch {
    showToast('Network error during login', 'error');
  } finally {
    setButtonLoading(btn, false, 'Sign In');
  }
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const role = document.getElementById('regRole').value;

  setButtonLoading(btn, true, 'Register Account');
  try {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role }),
    });
    const data = await res.json();
    if (res.ok) {
      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('pharma_token', authToken);
      updateAuthUI(currentUser);
      closeAuthModal();
      showToast(`Account registered successfully as ${role}!`, 'success');
    } else {
      showToast(data.error || 'Registration failed', 'error');
    }
  } catch {
    showToast('Network error during registration', 'error');
  } finally {
    setButtonLoading(btn, false, 'Register Account');
  }
});

// Google OAuth Callback
async function handleGoogleResponse(response) {
  const googleJwt = response.credential;
  
  try {
    const res = await fetch('/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: googleJwt })
    });
    
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('pharma_token', data.token);
      closeAuthModal();
      showToast('Google sign in successful', 'success');
      window.location.reload();
    } else {
      showToast(data.message || data.error || 'Google sign in failed', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Network error during Google sign in', 'error');
  }
}
window.handleGoogleResponse = handleGoogleResponse;

// ======================== TAB NAVIGATION ========================
document.querySelectorAll('.nav-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');

    const tabName = tab.dataset.tab;
    if (tabName === 'drugs') loadDrugs();
    else if (tabName === 'inventory') loadInventory();
    else if (tabName === 'shipments') loadShipments();
    else if (tabName === 'ledger') loadLedger();
  });
});

// ======================== STATS ========================
async function refreshStats() {
  try {
    const [drugsRes, inventoryRes, shipmentsRes, ledgerRes, verifyRes] = await Promise.all([
      fetch(`${API}/drugs`).then((r) => r.json()),
      fetch(`${API}/inventory`).then((r) => r.json()),
      fetch(`${API}/shipments`).then((r) => r.json()),
      fetch(`${API}/ledger`).then((r) => r.json()),
      fetch(`${API}/verify`).then((r) => r.json()),
    ]);
    document.getElementById('statDrugs').textContent = drugsRes.count || 0;
    document.getElementById('statInventory').textContent = inventoryRes.count || 0;
    document.getElementById('statShipments').textContent = shipmentsRes.count || 0;
    document.getElementById('statBlocks').textContent = ledgerRes.totalBlocks || 0;
    const chainEl = document.getElementById('statChain');
    if (verifyRes.verification && verifyRes.verification.valid) {
      chainEl.textContent = '✅ Valid';
      chainEl.style.color = '#34d399';
    } else {
      chainEl.textContent = '❌ Tampered';
      chainEl.style.color = '#f87171';
    }
  } catch (e) {
    showToast('Could not fetch metrics', 'error');
  }
}

// ======================== DRUG MANAGEMENT ========================
document.getElementById('drugForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const body = {
    name: document.getElementById('drugName').value.trim(),
    manufacturer: document.getElementById('drugMfg').value.trim(),
    batchId: document.getElementById('drugBatch').value.trim(),
    expiryDate: document.getElementById('drugExpiry').value,
    description: document.getElementById('drugDesc').value.trim(),
  };
  
  setButtonLoading(btn, true, 'Register Drug');
  try {
    const res = await fetch(`${API}/drugs`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Drug "${body.name}" registered (Ledger Block #${data.ledgerBlock.index})`, 'success');
      e.target.reset();
      loadDrugs();
      refreshStats();
    } else {
      showToast(data.error || 'Failed to register drug', 'error');
    }
  } catch {
    showToast('Network error while registering drug', 'error');
  } finally {
    setButtonLoading(btn, false, 'Register Drug');
  }
});

async function loadDrugs() {
  try {
    const res = await fetch(`${API}/drugs`);
    const data = await res.json();
    const container = document.getElementById('drugList');
    const invSelect = document.getElementById('invDrugSelect');
    const shipSelect = document.getElementById('shipDrugSelect');

    if (!data.drugs || data.drugs.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="icon">💊</div><p>No drugs registered yet</p></div>';
      return;
    }

    // Populate dropdowns
    invSelect.innerHTML = '<option value="">Select registered drug</option>';
    shipSelect.innerHTML = '<option value="">Select drug</option>';
    data.drugs.forEach((d) => {
      invSelect.innerHTML += `<option value="${escapeHTML(d.id)}">${escapeHTML(d.name)} (${escapeHTML(d.batch_id || d.batchId)})</option>`;
      shipSelect.innerHTML += `<option value="${escapeHTML(d.id)}" data-name="${escapeHTML(d.name)}">${escapeHTML(d.name)} (${escapeHTML(d.batch_id || d.batchId)})</option>`;
    });

    let html = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Drug Name</th>
              <th>Manufacturer</th>
              <th>Batch ID</th>
              <th>Expiry</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
    `;

    data.drugs.forEach((drug) => {
      html += `
        <tr>
          <td><strong>${escapeHTML(drug.name)}</strong></td>
          <td>${escapeHTML(drug.manufacturer)}</td>
          <td><code>${escapeHTML(drug.batch_id || drug.batchId)}</code></td>
          <td>${escapeHTML(drug.expiry_date ? String(drug.expiry_date).slice(0, 10) : drug.expiryDate)}</td>
          <td><span class="badge badge-registered">${escapeHTML(drug.status || 'registered')}</span></td>
        </tr>
      `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  } catch {
    showToast('Failed to load drug list', 'error');
  }
}

// ======================== INVENTORY MANAGEMENT ========================
document.getElementById('inventoryForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const drugId = document.getElementById('invDrugSelect').value;
  const location = document.getElementById('invLocation').value.trim();
  const quantity = parseInt(document.getElementById('invQuantity').value, 10);

  setButtonLoading(btn, true, 'Add Stock');
  try {
    const res = await fetch(`${API}/inventory/stock`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ drugId, location, quantity }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Stock updated: ${quantity} units added at ${location}`, 'success');
      e.target.reset();
      loadInventory();
      refreshStats();
    } else {
      showToast(data.error || 'Failed to update stock', 'error');
    }
  } catch {
    showToast('Network error while updating stock', 'error');
  } finally {
    setButtonLoading(btn, false, 'Add Stock');
  }
});

async function loadInventory() {
  try {
    const res = await fetch(`${API}/inventory`);
    const data = await res.json();
    const container = document.getElementById('inventoryList');

    if (!data.inventory || data.inventory.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="icon">🏢</div><p>No inventory records found</p></div>';
      return;
    }

    let html = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Drug Name</th>
              <th>Batch ID</th>
              <th>Location</th>
              <th>Available Units</th>
            </tr>
          </thead>
          <tbody>
    `;

    data.inventory.forEach((item) => {
      html += `
        <tr>
          <td><strong>${escapeHTML(item.drug_name || 'Medicine')}</strong></td>
          <td><code>${escapeHTML(item.batch_id || '—')}</code></td>
          <td>${escapeHTML(item.location)}</td>
          <td><strong style="color:var(--accent-emerald);font-size:1.05rem">${item.quantity}</strong></td>
        </tr>
      `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  } catch {
    showToast('Failed to load inventory', 'error');
  }
}

// ======================== SHIPMENTS ========================
document.getElementById('shipmentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const select = document.getElementById('shipDrugSelect');
  const drugId = select.value;
  const drugName = select.options[select.selectedIndex].dataset.name || 'Medicine';
  const origin = document.getElementById('shipOrigin').value.trim();
  const destination = document.getElementById('shipDest').value.trim();
  const quantity = parseInt(document.getElementById('shipQty').value, 10);

  setButtonLoading(btn, true, 'Create Shipment');
  try {
    const res = await fetch(`${API}/shipments`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ drugId, drugName, origin, destination, quantity }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Shipment created with atomic inventory reservation! (Ledger Block #${data.ledgerBlock.index})`, 'success');
      e.target.reset();
      loadShipments();
      loadInventory();
      refreshStats();
    } else {
      showToast(data.error || 'Failed to create shipment', 'error');
    }
  } catch {
    showToast('Network error while creating shipment', 'error');
  } finally {
    setButtonLoading(btn, false, 'Create Shipment');
  }
});

async function loadShipments() {
  try {
    const res = await fetch(`${API}/shipments`);
    const data = await res.json();
    const container = document.getElementById('shipmentList');

    if (!data.shipments || data.shipments.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="icon">📦</div><p>No active shipments found</p></div>';
      return;
    }

    let html = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Drug</th>
              <th>Route</th>
              <th>Qty</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
    `;

    data.shipments.forEach((s) => {
      const statusClass = s.status === 'delivered' ? 'badge-delivered' : s.status === 'in-transit' ? 'badge-in-transit' : 'badge-at-checkpoint';
      html += `
        <tr>
          <td><strong>${escapeHTML(s.drug_name || s.drugName)}</strong></td>
          <td>${escapeHTML(s.origin)} ➔ ${escapeHTML(s.destination)}</td>
          <td>${s.quantity}</td>
          <td><span class="badge ${statusClass}">${escapeHTML(s.status)}</span></td>
          <td><button class="btn btn-sm btn-outline" onclick="openShipmentModal('${escapeHTML(s.id)}')">Manage</button></td>
        </tr>
      `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  } catch {
    showToast('Failed to load shipments', 'error');
  }
}

async function openShipmentModal(shipmentId) {
  try {
    const res = await fetch(`${API}/shipments/${shipmentId}`);
    const data = await res.json();
    const s = data.shipment;

    document.getElementById('modalShipmentId').value = s.id;
    let historyHtml = '<div style="margin-bottom:12px;font-size:0.9rem"><strong>Audit Trail:</strong><ul style="padding-left:20px;margin-top:6px">';
    if (s.statusHistory) {
      s.statusHistory.forEach((h) => {
        historyHtml += `<li><strong>${escapeHTML(h.status)}</strong> at ${escapeHTML(h.location)} — <small>${escapeHTML(new Date(h.timestamp).toLocaleString())}</small></li>`;
      });
    }
    historyHtml += '</ul></div>';

    document.getElementById('shipmentModalBody').innerHTML = `
      <p><strong>Shipment ID:</strong> <code>${escapeHTML(s.id)}</code></p>
      <p><strong>Drug:</strong> ${escapeHTML(s.drug_name || s.drugName)} (${s.quantity} units)</p>
      <p><strong>Route:</strong> ${escapeHTML(s.origin)} ➔ ${escapeHTML(s.destination)}</p>
      ${historyHtml}
    `;

    document.getElementById('shipmentModal').style.display = 'flex';
  } catch {
    showToast('Failed to load shipment details', 'error');
  }
}

function closeModal() {
  document.getElementById('shipmentModal').style.display = 'none';
}

document.getElementById('statusUpdateForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const shipmentId = document.getElementById('modalShipmentId').value;
  const status = document.getElementById('modalStatusValue').value;
  const location = document.getElementById('modalLocationValue').value.trim();

  setButtonLoading(btn, true, 'Update Status');
  try {
    const res = await fetch(`${API}/shipments/${shipmentId}/status`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status, location }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Status updated to ${status} (Ledger Block #${data.ledgerBlock.index})`, 'success');
      closeModal();
      loadShipments();
      loadInventory();
      refreshStats();
    } else {
      showToast(data.error || 'Failed to update status', 'error');
    }
  } catch {
    showToast('Network error updating status', 'error');
  } finally {
    setButtonLoading(btn, false, 'Update Status');
  }
});

// ======================== VERIFY & TAMPER SIMULATOR ========================
async function verifyChain() {
  const resultDiv = document.getElementById('verifyResult');
  const btn = document.getElementById('verifyBtn');
  
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Verifying...';
  
  resultDiv.innerHTML = '<div style="margin-top:20px;color:var(--text-secondary)">🔍 Recalculating SHA-256 block hashes across entire database...</div>';

  try {
    const res = await fetch(`${API}/verify`, { headers: getAuthHeaders() });
    const data = await res.json();
    const v = data.verification;

    if (v && v.valid) {
      resultDiv.innerHTML = `
        <div class="card verify-valid" style="margin-top:20px;">
          <div style="font-size:1.2rem;color:var(--accent-emerald);font-weight:600">✅ Supply Chain Integrity Verified</div>
          <p style="margin-top:8px">All <strong>${v.totalBlocks}</strong> cryptographic blocks were recalculated and verified with 100% cryptographic continuity. No database tampering detected.</p>
        </div>
      `;
    } else {
      resultDiv.innerHTML = `
        <div class="card verify-invalid" style="margin-top:20px;">
          <div style="font-size:1.2rem;color:var(--accent-rose);font-weight:600">❌ ALERT: Supply Chain Integrity Compromised!</div>
          <p style="margin-top:8px">Tampered / invalid block indices detected in database: <strong>${escapeHTML((v && v.invalidBlocks ? v.invalidBlocks.join(', ') : 'Unknown'))}</strong></p>
          <p style="font-size:0.85rem;color:var(--text-secondary)">The hash link between blocks was broken due to an unauthorized direct modification in the database records.</p>
        </div>
      `;
    }
    refreshStats();
  } catch {
    showToast('Failed to perform verification', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🔍 Verify Chain Integrity';
  }
}

async function simulateTampering() {
  try {
    const res = await fetch(`${API}/ledger/tamper`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blockIndex: 1, payload: { malicious: 'Direct SQL update simulation' } }),
    });
    if (res.ok) {
      showToast('Simulated database tampering on Block #1. Run Verify to inspect!', 'error');
      verifyChain();
    }
  } catch {
    showToast('Failed to execute tampering simulation', 'error');
  }
}

// ======================== LEDGER EXPLORER ========================
async function loadLedger() {
  try {
    const res = await fetch(`${API}/ledger`);
    const data = await res.json();
    const container = document.getElementById('ledgerView');

    if (!data.chain || data.chain.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="icon">🔗</div><p>No ledger entries found</p></div>';
      return;
    }

    let html = '<div style="display:flex;flex-direction:column;gap:12px">';
    data.chain.forEach((block) => {
      const isGenesis = block.block_index === 0;
      html += `
        <div class="card" style="padding:16px;border-left:4px solid ${isGenesis ? 'var(--accent-indigo)' : 'var(--accent-emerald)'}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span class="badge ${isGenesis ? 'badge-registered' : 'badge-delivered'}">Block #${block.block_index} — ${escapeHTML(block.event_type)}</span>
            <small style="color:var(--text-secondary)">${escapeHTML(new Date(block.created_at).toLocaleString())}</small>
          </div>
          <div style="font-size:0.85rem;margin-bottom:6px">
            <span style="color:var(--text-secondary)">Previous Hash:</span> <code style="word-break:break-all">${escapeHTML(block.previous_hash)}</code>
          </div>
          <div style="font-size:0.85rem;margin-bottom:6px">
            <span style="color:var(--text-secondary)">Current Hash:</span> <code style="word-break:break-all;color:var(--accent-emerald)">${escapeHTML(block.hash)}</code>
          </div>
          <div style="font-size:0.85rem;background:var(--bg-primary);padding:8px;border-radius:6px;margin-top:8px;border:1px solid var(--border-glass)">
            <pre style="margin:0;font-size:0.8rem;white-space:pre-wrap;color:var(--text-primary)">${escapeHTML(JSON.stringify(block.payload, null, 2))}</pre>
          </div>
        </div>
      `;
    });
    html += '</div>';
    container.innerHTML = html;
  } catch {
    showToast('Failed to load ledger', 'error');
  }
}

// Initial load
window.addEventListener('DOMContentLoaded', () => {
  const authBtn = document.getElementById('authBtn');
  if (authBtn) {
    authBtn.addEventListener('click', openAuthModal);
  }
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
  checkAuthStatus();
  loadDrugs();
  refreshStats();
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { escapeHTML, applyRoleBasedAccess, ROLE_PERMISSIONS, checkAuthStatus };
}
