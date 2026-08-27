/**
 * @jest-environment jsdom
 */

// Mock localStorage before requiring
global.localStorage = { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() };
global.openAuthModal = jest.fn();
global.closeAuthModal = jest.fn();

// Setup a basic DOM layout mimicking index.html so app.js root listeners don't throw
document.body.innerHTML = `
  <div class="toast-container" id="toastContainer"></div>
  <div class="app-container">
    <div class="stats-bar" style="display:none;"></div>
    <nav class="nav-tabs" style="display:none;">
      <button class="nav-tab" data-tab="drugs">Drugs</button>
      <button class="nav-tab" data-tab="inventory">Inventory</button>
      <button class="nav-tab" data-tab="shipments">Shipments</button>
      <button class="nav-tab" data-tab="verify">Verify</button>
      <button class="nav-tab" data-tab="ledger">Ledger</button>
    </nav>
    <div class="tab-content" id="tab-drugs"></div>
    <div class="tab-content" id="tab-inventory"></div>
    <div class="tab-content" id="tab-shipments"></div>
    <div class="tab-content" id="tab-verify"></div>
    <div class="tab-content" id="tab-ledger"></div>
  </div>
  <div id="authModal"></div>
  <form id="loginForm"></form>
  <form id="registerForm"></form>
  <form id="drugForm"></form>
  <form id="inventoryForm"></form>
  <form id="shipmentForm"></form>
  <form id="statusUpdateForm"></form>
`;

const { escapeHTML, applyRoleBasedAccess, ROLE_PERMISSIONS } = require('../src/public/js/app.js');

describe('Frontend Logic Tests', () => {
  beforeEach(() => {
    global.openAuthModal = jest.fn();
    global.closeAuthModal = jest.fn();
  });

  describe('XSS Prevention (escapeHTML)', () => {
    test('should safely escape <script> tags', () => {
      const malicious = '<script>alert("xss")</script>';
      const safe = escapeHTML(malicious);
      expect(safe).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    test('should escape HTML attributes to prevent breakout', () => {
      const malicious = 'onclick="stealData()"';
      const safe = escapeHTML(malicious);
      expect(safe).toBe('onclick=&quot;stealData()&quot;');
    });
    
    test('should return non-strings unchanged', () => {
      expect(escapeHTML(123)).toBe(123);
      expect(escapeHTML(null)).toBe(null);
    });
  });

  describe('Role-Based Access Control (RBAC)', () => {
    test('should hide app container and open auth modal if user is null', () => {
      applyRoleBasedAccess(null);
      
      const statsBar = document.querySelector('.stats-bar');
      const navTabs = document.querySelector('.nav-tabs');
      
      expect(statsBar.style.display).toBe('none');
      expect(navTabs.style.display).toBe('none');
      expect(document.getElementById('authModal').style.display).toBe('flex');
    });

    test('ADMIN should see all tabs', () => {
      applyRoleBasedAccess({ role: 'ADMIN' });
      
      const tabs = Array.from(document.querySelectorAll('.nav-tab'));
      const visibleTabs = tabs.filter(t => t.style.display === 'flex').map(t => t.dataset.tab);
      
      expect(visibleTabs).toEqual(['drugs', 'inventory', 'shipments', 'verify', 'ledger']);
    });

    test('MANUFACTURER should not see verify tab', () => {
      applyRoleBasedAccess({ role: 'MANUFACTURER' });
      
      const tabs = Array.from(document.querySelectorAll('.nav-tab'));
      const visibleTabs = tabs.filter(t => t.style.display === 'flex').map(t => t.dataset.tab);
      
      expect(visibleTabs).toEqual(['drugs', 'inventory', 'shipments', 'ledger']);
      expect(visibleTabs).not.toContain('verify');
    });

    test('WAREHOUSE should only see inventory, shipments, and ledger', () => {
      applyRoleBasedAccess({ role: 'WAREHOUSE' });
      
      const tabs = Array.from(document.querySelectorAll('.nav-tab'));
      const visibleTabs = tabs.filter(t => t.style.display === 'flex').map(t => t.dataset.tab);
      
      expect(visibleTabs).toEqual(['inventory', 'shipments', 'ledger']);
      expect(visibleTabs).not.toContain('drugs');
      expect(visibleTabs).not.toContain('verify');
    });
  });
});
