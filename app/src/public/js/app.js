/**
 * Pharma Supply Chain — Enterprise Frontend Application Logic
 * Supports JWT Authentication, Inventory Management, Atomic Shipments, and Tamper-Evident Verification.
 */

const API = '';

// Authentication state
let currentUser = null;
let authToken = localStorage.getItem('pharma_token') || null;

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
  document.getElementById('authModal').style.display = 'flex';
}

function closeAuthModal() {
  document.getElementById('authModal').style.display = 'none';
}

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

async function checkAuthStatus() {
  if (!authToken) {
    updateAuthUI(null);
    return;
  }
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
}

function logout() {
  localStorage.removeItem('pharma_token');
  authToken = null;
  currentUser = null;
  updateAuthUI(null);
  showToast('Logged out successfully', 'info');
}

// Auth Forms
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

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
  }
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const role = document.getElementById('regRole').value;

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
  }
});

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
  const body = {
    name: document.getElementById('drugName').value.trim(),
    manufacturer: document.getElementById('drugMfg').value.trim(),
    batchId: document.getElementById('drugBatch').value.trim(),
    expiryDate: document.getElementById('drugExpiry').value,
    description: document.getElementById('drugDesc').value.trim(),
  };
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
      invSelect.innerHTML += `<option value="${d.id}">${d.name} (${d.batch_id || d.batchId})</option>`;
      shipSelect.innerHTML += `<option value="${d.id}" data-name="${d.name}">${d.name} (${d.batch_id || d.batchId})</option>`;
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
          <td><strong>${drug.name}</strong></td>
          <td>${drug.manufacturer}</td>
          <td><code>${drug.batch_id || drug.batchId}</code></td>
          <td>${drug.expiry_date ? String(drug.expiry_date).slice(0, 10) : drug.expiryDate}</td>
          <td><span class="badge badge-success">${drug.status || 'registered'}</span></td>
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
  const drugId = document.getElementById('invDrugSelect').value;
  const location = document.getElementById('invLocation').value.trim();
  const quantity = parseInt(document.getElementById('invQuantity').value, 10);

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
          <td><strong>${item.drug_name || 'Medicine'}</strong></td>
          <td><code>${item.batch_id || '—'}</code></td>
          <td>${item.location}</td>
          <td><strong style="color:#34d399;font-size:1.05rem">${item.quantity}</strong></td>
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
  const select = document.getElementById('shipDrugSelect');
  const drugId = select.value;
  const drugName = select.options[select.selectedIndex].dataset.name || 'Medicine';
  const origin = document.getElementById('shipOrigin').value.trim();
  const destination = document.getElementById('shipDest').value.trim();
  const quantity = parseInt(document.getElementById('shipQty').value, 10);

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
      const statusClass = s.status === 'delivered' ? 'badge-success' : s.status === 'in-transit' ? 'badge-primary' : 'badge-warning';
      html += `
        <tr>
          <td><strong>${s.drug_name || s.drugName}</strong></td>
          <td>${s.origin} ➔ ${s.destination}</td>
          <td>${s.quantity}</td>
          <td><span class="badge ${statusClass}">${s.status}</span></td>
          <td><button class="btn btn-sm btn-outline" onclick="openShipmentModal('${s.id}')">Manage</button></td>
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
        historyHtml += `<li><strong>${h.status}</strong> at ${h.location} — <small>${new Date(h.timestamp).toLocaleString()}</small></li>`;
      });
    }
    historyHtml += '</ul></div>';

    document.getElementById('shipmentModalBody').innerHTML = `
      <p><strong>Shipment ID:</strong> <code>${s.id}</code></p>
      <p><strong>Drug:</strong> ${s.drug_name || s.drugName} (${s.quantity} units)</p>
      <p><strong>Route:</strong> ${s.origin} ➔ ${s.destination}</p>
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
  const shipmentId = document.getElementById('modalShipmentId').value;
  const status = document.getElementById('modalStatusValue').value;
  const location = document.getElementById('modalLocationValue').value.trim();

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
  }
});

// ======================== VERIFY & TAMPER SIMULATOR ========================
async function verifyChain() {
  const resultDiv = document.getElementById('verifyResult');
  resultDiv.innerHTML = '<div style="margin-top:20px;color:var(--text-secondary)">🔍 Recalculating SHA-256 block hashes across entire database...</div>';

  try {
    const res = await fetch(`${API}/verify`);
    const data = await res.json();
    const v = data.verification;

    if (v.valid) {
      resultDiv.innerHTML = `
        <div class="card" style="margin-top:20px;border-color:rgba(16,185,129,0.5);background:rgba(16,185,129,0.05)">
          <div style="font-size:1.2rem;color:#34d399;font-weight:600">✅ Supply Chain Integrity Verified</div>
          <p style="margin-top:8px">All <strong>${v.totalBlocks}</strong> cryptographic blocks were recalculated and verified with 100% cryptographic continuity. No database tampering detected.</p>
        </div>
      `;
    } else {
      resultDiv.innerHTML = `
        <div class="card" style="margin-top:20px;border-color:rgba(239,68,68,0.5);background:rgba(239,68,68,0.05)">
          <div style="font-size:1.2rem;color:#f87171;font-weight:600">❌ ALERT: Supply Chain Integrity Compromised!</div>
          <p style="margin-top:8px">Tampered / invalid block indices detected in database: <strong>${v.invalidBlocks.join(', ')}</strong></p>
          <p style="font-size:0.85rem;color:var(--text-secondary)">The hash link between blocks was broken due to an unauthorized direct modification in the database records.</p>
        </div>
      `;
    }
    refreshStats();
  } catch {
    showToast('Failed to perform verification', 'error');
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
        <div class="card" style="padding:16px;border-left:4px solid ${isGenesis ? '#6366f1' : '#10b981'}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span class="badge ${isGenesis ? 'badge-primary' : 'badge-success'}">Block #${block.block_index} — ${block.event_type}</span>
            <small style="color:var(--text-secondary)">${new Date(block.created_at).toLocaleString()}</small>
          </div>
          <div style="font-size:0.85rem;margin-bottom:6px">
            <span style="color:var(--text-secondary)">Previous Hash:</span> <code style="word-break:break-all">${block.previous_hash}</code>
          </div>
          <div style="font-size:0.85rem;margin-bottom:6px">
            <span style="color:var(--text-secondary)">Current Hash:</span> <code style="word-break:break-all;color:#34d399">${block.hash}</code>
          </div>
          <div style="font-size:0.85rem;background:rgba(0,0,0,0.3);padding:8px;border-radius:6px;margin-top:8px">
            <pre style="margin:0;font-size:0.8rem;white-space:pre-wrap">${JSON.stringify(block.payload, null, 2)}</pre>
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
  checkAuthStatus();
  loadDrugs();
  refreshStats();
});
