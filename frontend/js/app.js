/**
 * FoodShare AI - Core Application Script
 */

const App = {
  currentUser: null,
  activeCategoryFilter: 'ALL',
  aiPredictionData: null,

  async init() {
    console.log('FoodShare AI Initializing...');
    await this.checkAuth();
    await this.loadLandingStats();
  },

  async checkAuth() {
    try {
      const res = await window.API.auth.me();
      if (res.success && res.data) {
        this.currentUser = res.data;
        window.currentUser = res.data;
        this.renderAuthNav(true);
        window.NotificationManager.startPolling();
        this.showView('dashboard');
      } else {
        this.currentUser = null;
        window.currentUser = null;
        this.renderAuthNav(false);
        this.showView('landing');
      }
    } catch (err) {
      this.currentUser = null;
      window.currentUser = null;
      this.renderAuthNav(false);
      this.showView('landing');
    }
  },

  renderAuthNav(isLoggedIn) {
    const loggedOutNav = document.getElementById('nav-auth-logged-out');
    const loggedInNav = document.getElementById('nav-auth-logged-in');
    const notifContainer = document.getElementById('nav-notif-container');

    if (isLoggedIn && this.currentUser) {
      loggedOutNav.style.display = 'none';
      loggedInNav.style.setProperty('display', 'flex', 'important');
      notifContainer.style.display = 'block';

      document.getElementById('user-display-name').textContent = this.currentUser.name;
      const roleBadge = document.getElementById('user-role-badge');
      roleBadge.textContent = this.currentUser.role;
      roleBadge.className = `badge-status status-${this.currentUser.role === 'ADMIN' ? 'REJECTED' : 'APPROVED'}`;
    } else {
      loggedOutNav.style.display = 'flex';
      loggedInNav.style.setProperty('display', 'none', 'important');
      notifContainer.style.display = 'none';
    }
  },

  showView(viewName) {
    // Hide all view sections
    document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');

    if (viewName === 'landing') {
      document.getElementById('view-landing').style.display = 'block';
      this.loadLandingStats();
      return;
    }

    if (viewName === 'dashboard') {
      if (!this.currentUser) {
        this.openAuthModal('login');
        return;
      }

      const role = this.currentUser.role;
      if (role === 'DONOR') {
        document.getElementById('view-donor').style.display = 'block';
        this.loadDonorDashboard();
      } else if (role === 'NGO') {
        document.getElementById('view-ngo').style.display = 'block';
        this.loadNgoDashboard();
      } else if (role === 'VOLUNTEER') {
        document.getElementById('view-volunteer').style.display = 'block';
        this.loadVolunteerDashboard();
      } else if (role === 'ADMIN') {
        document.getElementById('view-admin').style.display = 'block';
        this.loadAdminDashboard();
      }
    }
  },

  async loadLandingStats() {
    try {
      const res = await window.API.stats.getPublic();
      if (res.success && res.data) {
        const d = res.data;
        if (window.EffectsEngine) {
          window.EffectsEngine.countUp(document.getElementById('landing-kg-rescued'), d.totalKgRescued, 1000, ' kg');
          window.EffectsEngine.countUp(document.getElementById('landing-portions-saved'), d.totalPortionsRescued, 1000);
          window.EffectsEngine.countUp(document.getElementById('landing-active-listings'), d.activeListingsCount, 800);
          window.EffectsEngine.countUp(document.getElementById('landing-verified-ngos'), d.verifiedNgosCount, 800);
        } else {
          document.getElementById('landing-kg-rescued').textContent = `${d.totalKgRescued} kg`;
          document.getElementById('landing-portions-saved').textContent = d.totalPortionsRescued;
          document.getElementById('landing-active-listings').textContent = d.activeListingsCount;
          document.getElementById('landing-verified-ngos').textContent = d.verifiedNgosCount;
        }
      }
    } catch (e) {
      console.error(e);
    }
  },

  // ==========================================
  // AUTH MODAL & HANDLERS
  // ==========================================
  openAuthModal(tab = 'login', preselectedRole = 'DONOR') {
    const modal = document.getElementById('modal-auth');
    modal.style.display = 'block';
    this.switchAuthTab(tab);
    if (tab === 'register') {
      const roleSelect = document.getElementById('reg-role');
      roleSelect.value = preselectedRole;
      this.handleRoleChange(preselectedRole);
    }
  },

  closeAuthModal() {
    document.getElementById('modal-auth').style.display = 'none';
  },

  switchAuthTab(tab) {
    const tabLogin = document.getElementById('auth-tab-login');
    const tabRegister = document.getElementById('auth-tab-register');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');
    const modalTitle = document.getElementById('modal-auth-title');

    if (tab === 'login') {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      formLogin.style.display = 'block';
      formRegister.style.display = 'none';
      modalTitle.textContent = 'Sign In to FoodShare AI';
    } else {
      tabLogin.classList.remove('active');
      tabRegister.classList.add('active');
      formLogin.style.display = 'none';
      formRegister.style.display = 'block';
      modalTitle.textContent = 'Create FoodShare AI Account';
    }
  },

  handleRoleChange(role) {
    const ngoFields = document.getElementById('ngo-register-fields');
    if (role === 'NGO') {
      ngoFields.style.display = 'block';
    } else {
      ngoFields.style.display = 'none';
    }
  },

  async handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      const res = await window.API.auth.login({ email, password });
      Toast.success(`Welcome back, ${res.data.name}!`);
      this.closeAuthModal();
      await this.checkAuth();
    } catch (err) {
      Toast.error(err.message || 'Login failed');
    }
  },

  async handleRegister(event) {
    event.preventDefault();
    const role = document.getElementById('reg-role').value;
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    const payload = { role, name, email, password };

    if (role === 'NGO') {
      payload.ngoData = {
        organisationName: document.getElementById('reg-ngo-name').value,
        registrationNumber: document.getElementById('reg-ngo-number').value,
        address: document.getElementById('reg-ngo-address').value
      };
    }

    try {
      const res = await window.API.auth.register(payload);
      Toast.success(`Registration successful as ${role}!`);
      this.closeAuthModal();
      await this.checkAuth();
    } catch (err) {
      Toast.error(err.message || 'Registration failed');
    }
  },

  async logout() {
    try {
      await window.API.auth.logout();
      window.NotificationManager.stopPolling();
      Toast.info('Logged out successfully');
      await this.checkAuth();
    } catch (err) {
      Toast.error('Logout error');
    }
  },

  // ==========================================
  // DONOR MODULE
  // ==========================================
  async loadDonorDashboard() {
    try {
      const res = await window.API.dashboard.get();
      if (res.success && res.data) {
        const d = res.data;
        const activeCount = d.availableCount + d.claimedCount + d.inTransitCount;
        if (window.EffectsEngine) {
          window.EffectsEngine.countUp(document.getElementById('donor-stat-active'), activeCount, 600);
          window.EffectsEngine.countUp(document.getElementById('donor-stat-delivered'), d.deliveredCount, 600);
          window.EffectsEngine.countUp(document.getElementById('donor-stat-kg'), d.totalKgRescued, 800, ' kg');
          window.EffectsEngine.countUp(document.getElementById('donor-stat-portions'), d.totalPortionsRescued, 800);
        } else {
          document.getElementById('donor-stat-active').textContent = activeCount;
          document.getElementById('donor-stat-delivered').textContent = d.deliveredCount;
          document.getElementById('donor-stat-kg').textContent = `${d.totalKgRescued} kg`;
          document.getElementById('donor-stat-portions').textContent = d.totalPortionsRescued;
        }
      }

      await this.loadDonorListings();
      await this.loadSurplusForecast();
    } catch (err) {
      console.error(err);
    }
  },

  async loadSurplusForecast() {
    try {
      const res = await window.API.predictor.getForecast();
      if (res.success && res.data) {
        this.aiPredictionData = res.data;
        const pred = res.data.predictedNextSurplus;
        document.getElementById('ai-pred-category').textContent = pred.recommendedCategory;
        document.getElementById('ai-pred-qty').textContent = `${pred.estimatedQuantity} ${pred.unit}`;
        document.getElementById('ai-pred-confidence').textContent = `${Math.round(pred.confidenceScore * 100)}%`;
        document.getElementById('ai-predictor-disclaimer').textContent = `⚠️ ${res.data.disclaimer}`;
      }
    } catch (err) {
      console.error(err);
    }
  },

  applyAiSuggestion() {
    if (!this.aiPredictionData) return;
    const pred = this.aiPredictionData.predictedNextSurplus;
    this.openCreateListingModal();

    document.getElementById('listing-title').value = `Surplus ${pred.recommendedCategory} Batch`;
    document.getElementById('listing-category').value = pred.recommendedCategory;
    document.getElementById('listing-quantity').value = pred.estimatedQuantity;
    document.getElementById('listing-unit').value = pred.unit;
    document.getElementById('listing-window').value = pred.suggestedPickupWindow;

    Toast.info('AI prediction parameters loaded into form!');
  },

  async loadDonorListings() {
    const container = document.getElementById('donor-listings-container');
    try {
      const res = await window.API.listings.getMy();
      const listings = res.data || [];

      if (listings.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🍲</div>
            <h5 class="text-white">No Food Listings Created Yet</h5>
            <p>You haven't posted any surplus food donations yet. Click below to publish your first batch!</p>
            <button class="btn-primary-custom" onclick="App.openCreateListingModal()">+ Create First Donation</button>
          </div>
        `;
        return;
      }

      container.innerHTML = listings.map(l => {
        const isEditable = l.status === 'AVAILABLE';
        const formattedExpiry = new Date(l.expiresAt).toLocaleString();

        let claimDetails = '';
        if (l.claim) {
          claimDetails = `
            <div style="background: rgba(0,0,0,0.2); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); margin-top: 0.5rem; font-size: 0.82rem;">
              <span style="color: #fbbf24; font-weight: 600;">Claimed by:</span> ${l.claim.ngoOrgName || l.claim.ngoName}
              ${l.claim.delivery ? ` | <span style="color: #38bdf8;">Volunteer:</span> ${l.claim.delivery.volunteerName} (${l.claim.delivery.status})` : ' | <em>Awaiting volunteer assignment</em>'}
            </div>
          `;
        }

        return `
          <div class="glass-panel p-3 mb-3">
            <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
              <div>
                <div class="d-flex align-items-center gap-2 mb-1">
                  <h5 class="mb-0 text-white">${Toast.escapeHtml(l.title)}</h5>
                  <span class="badge-status status-${l.status}">${l.status}</span>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">
                  <strong>Category:</strong> ${l.category} | 
                  <strong>Quantity:</strong> ${l.quantity} ${l.unit} | 
                  <strong>Pickup Window:</strong> ${Toast.escapeHtml(l.pickupWindow)}
                </div>
                <div style="font-size: 0.8rem; color: var(--text-dim); margin-top: 2px;">
                  📍 ${Toast.escapeHtml(l.pickupAddress)} | ⏱ Expires: ${formattedExpiry}
                </div>
                ${claimDetails}
              </div>

              <div class="d-flex gap-2">
                ${isEditable ? `
                  <button class="btn-secondary-custom" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="App.openEditListingModal(${JSON.stringify(l).replace(/"/g, '&quot;')})">Edit</button>
                  <button class="btn-secondary-custom" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; color: #fb7185;" onclick="App.cancelListing(${l.id})">Cancel</button>
                ` : `
                  <span style="font-size: 0.78rem; color: var(--text-dim); font-style: italic;">Locked (${l.status})</span>
                `}
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      container.innerHTML = `<div class="text-danger">Failed to load listings: ${err.message}</div>`;
    }
  },

  openCreateListingModal() {
    const modal = document.getElementById('modal-create-listing');
    modal.style.display = 'block';

    // Set default expiry to 24 hours from now
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    tomorrow.setMinutes(tomorrow.getMinutes() - tomorrow.getTimezoneOffset());
    document.getElementById('listing-expires').value = tomorrow.toISOString().slice(0, 16);
  },

  closeCreateListingModal() {
    document.getElementById('modal-create-listing').style.display = 'none';
  },

  async handleCreateListing(event) {
    event.preventDefault();
    const payload = {
      title: document.getElementById('listing-title').value,
      category: document.getElementById('listing-category').value,
      quantity: document.getElementById('listing-quantity').value,
      unit: document.getElementById('listing-unit').value,
      pickupAddress: document.getElementById('listing-address').value,
      pickupWindow: document.getElementById('listing-window').value,
      expiresAt: new Date(document.getElementById('listing-expires').value).toISOString()
    };

    try {
      await window.API.listings.create(payload);
      Toast.success('Surplus food donation published successfully!');
      this.closeCreateListingModal();
      document.getElementById('form-create-listing').reset();
      await this.loadDonorDashboard();
    } catch (err) {
      Toast.error(err.message || 'Failed to create listing');
    }
  },

  openEditListingModal(l) {
    document.getElementById('edit-listing-id').value = l.id;
    document.getElementById('edit-listing-title').value = l.title;
    document.getElementById('edit-listing-category').value = l.category;
    document.getElementById('edit-listing-quantity').value = l.quantity;
    document.getElementById('edit-listing-unit').value = l.unit;
    document.getElementById('edit-listing-address').value = l.pickupAddress;
    document.getElementById('edit-listing-window').value = l.pickupWindow;

    const expiryDate = new Date(l.expiresAt);
    expiryDate.setMinutes(expiryDate.getMinutes() - expiryDate.getTimezoneOffset());
    document.getElementById('edit-listing-expires').value = expiryDate.toISOString().slice(0, 16);

    document.getElementById('modal-edit-listing').style.display = 'block';
  },

  closeEditListingModal() {
    document.getElementById('modal-edit-listing').style.display = 'none';
  },

  async handleEditListing(event) {
    event.preventDefault();
    const id = document.getElementById('edit-listing-id').value;
    const payload = {
      title: document.getElementById('edit-listing-title').value,
      category: document.getElementById('edit-listing-category').value,
      quantity: document.getElementById('edit-listing-quantity').value,
      unit: document.getElementById('edit-listing-unit').value,
      pickupAddress: document.getElementById('edit-listing-address').value,
      pickupWindow: document.getElementById('edit-listing-window').value,
      expiresAt: new Date(document.getElementById('edit-listing-expires').value).toISOString()
    };

    try {
      await window.API.listings.update(id, payload);
      Toast.success('Listing updated successfully!');
      this.closeEditListingModal();
      await this.loadDonorDashboard();
    } catch (err) {
      Toast.error(err.message || 'Failed to update listing');
    }
  },

  async cancelListing(id) {
    if (!confirm('Are you sure you want to cancel this food listing?')) return;
    try {
      await window.API.listings.cancel(id);
      Toast.info('Listing cancelled');
      await this.loadDonorDashboard();
    } catch (err) {
      Toast.error(err.message || 'Cancellation failed');
    }
  },

  // ==========================================
  // NGO MODULE (FR-2, FR-4, FR-5)
  // ==========================================
  async loadNgoDashboard() {
    try {
      const res = await window.API.dashboard.get();
      if (res.success && res.data) {
        const d = res.data;
        document.getElementById('ngo-stat-available').textContent = d.availableFoodCount;
        document.getElementById('ngo-stat-claimed').textContent = d.activeClaims;
        document.getElementById('ngo-stat-delivered').textContent = d.deliveredFoodCount;
        document.getElementById('ngo-stat-kg').textContent = `${d.totalKgReceived} kg`;

        // Render Verification Banner (FR-2)
        const banner = document.getElementById('ngo-status-banner');
        if (d.verificationStatus === 'APPROVED') {
          banner.innerHTML = `
            <div class="glass-panel p-3" style="border-left: 4px solid var(--accent-emerald); background: rgba(16, 185, 129, 0.08);">
              <div class="d-flex align-items-center gap-2">
                <span style="font-size: 1.3rem;">✅</span>
                <div>
                  <strong style="color: #34d399;">Admin Verified NGO Partner (${Toast.escapeHtml(d.organisationName)})</strong>
                  <div style="font-size: 0.85rem; color: var(--text-muted);">You have verified access to claim and receive surplus food donations.</div>
                </div>
              </div>
            </div>
          `;
        } else if (d.verificationStatus === 'PENDING') {
          banner.innerHTML = `
            <div class="glass-panel p-3" style="border-left: 4px solid var(--accent-purple); background: rgba(168, 85, 247, 0.08);">
              <div class="d-flex align-items-center gap-2">
                <span style="font-size: 1.3rem;">⏳</span>
                <div>
                  <strong style="color: #c084fc;">Verification Pending Approval (${Toast.escapeHtml(d.organisationName)})</strong>
                  <div style="font-size: 0.85rem; color: var(--text-muted);">
                    Your NGO profile is awaiting administrator review. You can browse listings below, but claiming is locked until verified.
                  </div>
                </div>
              </div>
            </div>
          `;
        } else {
          banner.innerHTML = `
            <div class="glass-panel p-3" style="border-left: 4px solid var(--accent-rose); background: rgba(244, 63, 94, 0.08);">
              <div class="d-flex align-items-center gap-2">
                <span style="font-size: 1.3rem;">❌</span>
                <div>
                  <strong style="color: #fb7185;">NGO Verification Status: Rejected</strong>
                  <div style="font-size: 0.85rem; color: var(--text-muted);">Your account was rejected by the platform administrator. Contact support for inquiries.</div>
                </div>
              </div>
            </div>
          `;
        }
      }

      await this.loadAvailableListings();
      await this.loadNgoClaims();
    } catch (err) {
      console.error(err);
    }
  },

  switchNgoTab(tab) {
    const tabBrowse = document.getElementById('tab-ngo-browse');
    const tabClaims = document.getElementById('tab-ngo-claims');
    const contentBrowse = document.getElementById('ngo-tab-content-browse');
    const contentClaims = document.getElementById('ngo-tab-content-claims');

    if (tab === 'browse') {
      tabBrowse.classList.add('active');
      tabClaims.classList.remove('active');
      contentBrowse.style.display = 'block';
      contentClaims.style.display = 'none';
      this.loadAvailableListings();
    } else {
      tabBrowse.classList.remove('active');
      tabClaims.classList.add('active');
      contentBrowse.style.display = 'none';
      contentClaims.style.display = 'block';
      this.loadNgoClaims();
    }
  },

  setCategoryFilter(cat) {
    this.activeCategoryFilter = cat;
    document.querySelectorAll('#ngo-tab-content-browse .filter-pill').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-cat') === cat);
    });
    this.loadAvailableListings();
  },

  async loadAvailableListings() {
    const container = document.getElementById('ngo-available-listings-container');
    const search = document.getElementById('ngo-search-input') ? document.getElementById('ngo-search-input').value : '';

    try {
      const res = await window.API.listings.getAll({
        category: this.activeCategoryFilter,
        search
      });
      const listings = res.data || [];

      if (listings.length === 0) {
        container.innerHTML = `
          <div class="col-12">
            <div class="empty-state">
              <div class="empty-icon">🥗</div>
              <h5 class="text-white">No Surplus Food Available Right Now</h5>
              <p>Check back soon! Donors post batches continuously throughout the day.</p>
            </div>
          </div>
        `;
        return;
      }

      const isVerifiedNgo = this.currentUser && this.currentUser.ngoProfile && this.currentUser.ngoProfile.verificationStatus === 'APPROVED';

      container.innerHTML = listings.map(l => {
        const expiryDate = new Date(l.expiresAt);
        const hoursLeft = Math.max(0, Math.round((expiryDate - Date.now()) / (1000 * 60 * 60)));

        return `
          <div class="col-md-6 col-lg-4">
            <div class="glass-panel p-4 h-100 d-flex flex-column justify-content-between glass-panel-interactive">
              <div>
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <span class="badge-status status-AVAILABLE">AVAILABLE</span>
                  <span style="font-size: 0.75rem; color: #fbbf24; font-weight: 600;">⏱ ~${hoursLeft}h left</span>
                </div>
                <h5 class="mb-2 text-white">${Toast.escapeHtml(l.title)}</h5>
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.6rem;">
                  <strong>Category:</strong> ${l.category}<br>
                  <strong>Quantity:</strong> <span style="color: #34d399; font-weight: 700;">${l.quantity} ${l.unit}</span><br>
                  <strong>Donor:</strong> ${Toast.escapeHtml(l.donorName)}
                </div>
                <div style="font-size: 0.8rem; color: var(--text-dim); border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
                  📍 ${Toast.escapeHtml(l.pickupAddress)}<br>
                  🕒 Window: ${Toast.escapeHtml(l.pickupWindow)}
                </div>
              </div>

              <div class="mt-3 pt-2">
                ${isVerifiedNgo ? `
                  <button class="btn-primary-custom w-100 justify-content-center" onclick="App.claimListing(${l.id}, ${l.version})">
                    Claim This Surplus Food
                  </button>
                ` : `
                  <button class="btn-secondary-custom w-100 justify-content-center" disabled title="Verification Required" style="opacity: 0.6; cursor: not-allowed;">
                    🔒 Claiming Locked (Pending Verification)
                  </button>
                `}
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      container.innerHTML = `<div class="col-12 text-danger">Failed to load listings: ${err.message}</div>`;
    }
  },

  async claimListing(listingId, version) {
    if (!confirm('Confirm claim of this surplus food donation for your NGO?')) return;
    try {
      await window.API.claims.claim(listingId, version);
      Toast.success('Food donation claimed successfully! Volunteer pickup will be assigned.');
      await this.loadNgoDashboard();
    } catch (err) {
      Toast.error(err.message || 'Claim failed');
      // Refresh listings in case another NGO claimed it
      await this.loadAvailableListings();
    }
  },

  async loadNgoClaims() {
    const container = document.getElementById('ngo-claims-container');
    try {
      const res = await window.API.claims.getMy();
      const claims = res.data || [];

      if (claims.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📋</div>
            <h5 class="text-white">No Claimed Donations Yet</h5>
            <p>Browse available food listings in the catalog above to claim food for your organization.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = claims.map(c => `
        <div class="glass-panel p-3 mb-3">
          <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
            <div>
              <div class="d-flex align-items-center gap-2 mb-1">
                <h5 class="mb-0 text-white">${Toast.escapeHtml(c.listingTitle)}</h5>
                <span class="badge-status status-${c.delivery ? c.delivery.status : 'CLAIMED'}">
                  ${c.delivery ? c.delivery.status : 'Awaiting Volunteer'}
                </span>
              </div>
              <div style="font-size: 0.85rem; color: var(--text-muted);">
                <strong>Quantity:</strong> ${c.quantity} ${c.unit} (${c.category}) |
                <strong>Donor:</strong> ${Toast.escapeHtml(c.donor.name)}
              </div>
              <div style="font-size: 0.8rem; color: var(--text-dim); margin-top: 2px;">
                📍 Pickup: ${Toast.escapeHtml(c.pickupAddress)} | Window: ${Toast.escapeHtml(c.pickupWindow)}
              </div>
              ${c.delivery ? `
                <div style="font-size: 0.82rem; color: #38bdf8; margin-top: 0.4rem;">
                  🚴 Courier: <strong>${Toast.escapeHtml(c.delivery.volunteerName)}</strong>
                </div>
              ` : ''}
            </div>
            <div style="font-size: 0.78rem; color: var(--text-dim);">
              Claimed: ${new Date(c.claimedAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      `).join('');
    } catch (err) {
      container.innerHTML = `<div class="text-danger">Failed to load claims: ${err.message}</div>`;
    }
  },

  // ==========================================
  // VOLUNTEER MODULE (FR-6)
  // ==========================================
  async loadVolunteerDashboard() {
    try {
      const res = await window.API.dashboard.get();
      if (res.success && res.data) {
        const d = res.data;
        document.getElementById('vol-stat-available').textContent = d.availableTasksCount;
        document.getElementById('vol-stat-assigned').textContent = d.assignedCount + d.inTransitCount;
        document.getElementById('vol-stat-completed').textContent = d.completedCount;
        document.getElementById('vol-stat-kg').textContent = `${d.totalKgDelivered} kg`;
      }

      await this.loadVolunteerTasks();
      await this.loadVolunteerDeliveries();
    } catch (err) {
      console.error(err);
    }
  },

  async loadVolunteerTasks() {
    const container = document.getElementById('volunteer-available-tasks-container');
    try {
      const res = await window.API.deliveries.getAvailable();
      const tasks = res.data || [];

      if (tasks.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🚴</div>
            <h5 class="text-white">All Deliveries Covered!</h5>
            <p>There are no unassigned pickup tasks waiting right now. Awesome work!</p>
          </div>
        `;
        return;
      }

      container.innerHTML = tasks.map(t => `
        <div class="glass-panel p-3 mb-3">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <h5 class="mb-0 text-white">${Toast.escapeHtml(t.title)}</h5>
            <span class="badge-status status-CLAIMED">NEEDS COURIER</span>
          </div>
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.4rem;">
            <strong>Quantity:</strong> ${t.quantity} ${t.unit} (${t.category})<br>
            <strong>Pickup From:</strong> ${Toast.escapeHtml(t.donorName)} (📍 ${Toast.escapeHtml(t.pickupAddress)})<br>
            <strong>Deliver To:</strong> ${Toast.escapeHtml(t.ngoOrgName || t.ngoName)} (🏢 ${Toast.escapeHtml(t.ngoAddress || 'City Center')})
          </div>
          <button class="btn-primary-custom w-100 justify-content-center mt-2" onclick="App.acceptDeliveryTask(${t.claimId})">
            Accept Pickup & Delivery Task
          </button>
        </div>
      `).join('');
    } catch (err) {
      container.innerHTML = `<div class="text-danger">Failed to load tasks: ${err.message}</div>`;
    }
  },

  async acceptDeliveryTask(claimId) {
    try {
      await window.API.deliveries.accept(claimId);
      Toast.success('Delivery task accepted! Please proceed to pickup location.');
      await this.loadVolunteerDashboard();
    } catch (err) {
      Toast.error(err.message || 'Failed to accept task');
      await this.loadVolunteerTasks();
    }
  },

  async loadVolunteerDeliveries() {
    const container = document.getElementById('volunteer-my-deliveries-container');
    try {
      const res = await window.API.deliveries.getMy();
      const deliveries = res.data || [];

      if (deliveries.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📦</div>
            <h5 class="text-white">No Active Deliveries</h5>
            <p>Accept an unassigned pickup task from the left column to begin a delivery mission.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = deliveries.map(d => {
        const isAssigned = d.status === 'ASSIGNED';
        const isPickedUp = d.status === 'PICKED_UP';
        const isDelivered = d.status === 'DELIVERED';

        return `
          <div class="glass-panel p-3 mb-3">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <h5 class="mb-0 text-white">${Toast.escapeHtml(d.listing.title)}</h5>
              <span class="badge-status status-${d.status}">${d.status}</span>
            </div>
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">
              <strong>Quantity:</strong> ${d.listing.quantity} ${d.listing.unit} |
              <strong>Destination NGO:</strong> ${Toast.escapeHtml(d.ngo.organisationName || d.ngo.name)}
            </div>

            <!-- Stepper Progress Tracker -->
            <div class="stepper-container">
              <div class="stepper-step completed">
                <div class="stepper-circle">1</div>
                <div class="stepper-label">Accepted</div>
              </div>
              <div class="stepper-step ${isPickedUp || isDelivered ? 'completed' : (isAssigned ? 'active' : '')}">
                <div class="stepper-circle">2</div>
                <div class="stepper-label">Picked Up</div>
              </div>
              <div class="stepper-step ${isDelivered ? 'completed' : (isPickedUp ? 'active' : '')}">
                <div class="stepper-circle">3</div>
                <div class="stepper-label">Delivered</div>
              </div>
            </div>

            <!-- Action Advancers (Strictly in order) -->
            <div class="d-flex gap-2 mt-3">
              ${isAssigned ? `
                <button class="btn-sky-custom w-100 justify-content-center" onclick="App.advanceDeliveryPickup(${d.id})">
                  Confirm Picked Up from Donor
                </button>
              ` : ''}
              ${isPickedUp ? `
                <button class="btn-primary-custom w-100 justify-content-center" onclick="App.advanceDeliveryComplete(${d.id})">
                  Confirm Delivered to NGO
                </button>
              ` : ''}
              ${isDelivered ? `
                <div style="font-size: 0.85rem; color: #34d399; font-weight: 600; text-align: center; width: 100%;">
                  ✓ Mission Complete (Delivered: ${new Date(d.deliveredAt).toLocaleTimeString()})
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      container.innerHTML = `<div class="text-danger">Failed to load deliveries: ${err.message}</div>`;
    }
  },

  async advanceDeliveryPickup(deliveryId) {
    try {
      await window.API.deliveries.pickup(deliveryId);
      Toast.success('Food marked as Picked Up! Safe travels to the destination.');
      await this.loadVolunteerDashboard();
    } catch (err) {
      Toast.error(err.message || 'Update failed');
    }
  },

  async advanceDeliveryComplete(deliveryId) {
    try {
      await window.API.deliveries.deliver(deliveryId);
      Toast.success('Delivery marked complete! Thank you for rescuing surplus food!');
      await this.loadVolunteerDashboard();
    } catch (err) {
      Toast.error(err.message || 'Update failed');
    }
  },

  // ==========================================
  // ADMIN MODULE (FR-9, FR-10)
  // ==========================================
  async loadAdminDashboard() {
    try {
      const res = await window.API.admin.getAnalytics();
      if (res.success && res.data) {
        const d = res.data;
        document.getElementById('admin-stat-users').textContent = d.totalUsers;
        document.getElementById('admin-stat-pending-ngos').textContent = d.pendingNgosCount;
        document.getElementById('admin-stat-listings').textContent = d.totalListings;
        document.getElementById('admin-stat-rescued-kg').textContent = `${d.totalKgRescued} kg`;

        // Render Status Pipeline
        const pipelineContainer = document.getElementById('admin-status-pipeline');
        pipelineContainer.innerHTML = Object.entries(d.listingsByStatus).map(([st, cnt]) => `
          <div class="d-flex justify-content-between align-items-center p-2 rounded" style="background: rgba(0,0,0,0.2);">
            <span class="badge-status status-${st}">${st}</span>
            <span style="font-weight: 700; color: #ffffff;">${cnt}</span>
          </div>
        `).join('');

        // Render Category Breakdown
        const catContainer = document.getElementById('admin-category-distribution');
        if (d.categoryBreakdown.length === 0) {
          catContainer.innerHTML = '<div style="color: var(--text-dim); font-size: 0.85rem;">No category data yet.</div>';
        } else {
          catContainer.innerHTML = d.categoryBreakdown.map(c => `
            <div class="d-flex justify-content-between align-items-center p-2 rounded" style="background: rgba(0,0,0,0.2);">
              <span style="color: #ffffff; font-weight: 600;">${c.category}</span>
              <span style="color: #34d399; font-weight: 700;">${c.count} items (${c.total_qty} units)</span>
            </div>
          `).join('');
        }
      }

      await this.loadAdminNgos();
      await this.loadAdminUsers();
    } catch (err) {
      console.error(err);
    }
  },

  switchAdminTab(tab) {
    const tabs = ['ngos', 'users', 'analytics'];
    tabs.forEach(t => {
      document.getElementById(`tab-admin-${t}`).classList.toggle('active', t === tab);
      document.getElementById(`admin-tab-content-${t}`).style.display = t === tab ? 'block' : 'none';
    });
  },

  async loadAdminNgos() {
    const tbody = document.getElementById('admin-ngos-tbody');
    try {
      const res = await window.API.admin.getNgos();
      const ngos = res.data || [];

      if (ngos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No NGO partners registered yet.</td></tr>';
        return;
      }

      tbody.innerHTML = ngos.map(n => `
        <tr>
          <td><strong>${Toast.escapeHtml(n.organisation_name)}</strong></td>
          <td><code>${Toast.escapeHtml(n.registration_number)}</code></td>
          <td><small>${Toast.escapeHtml(n.address)}</small></td>
          <td>${Toast.escapeHtml(n.email)}</td>
          <td><span class="badge-status status-${n.verification_status}">${n.verification_status}</span></td>
          <td>
            ${n.verification_status === 'PENDING' ? `
              <div class="d-flex gap-1">
                <button class="btn-primary-custom" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;" onclick="App.reviewNgo(${n.id}, 'APPROVED')">Approve</button>
                <button class="btn-secondary-custom" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; color: #fb7185;" onclick="App.reviewNgo(${n.id}, 'REJECTED')">Reject</button>
              </div>
            ` : `
              <span style="font-size: 0.75rem; color: var(--text-dim);">${n.reviewed_by ? 'Audited' : '—'}</span>
            `}
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-danger">Failed to load NGOs: ${err.message}</td></tr>`;
    }
  },

  async reviewNgo(id, status) {
    try {
      await window.API.admin.reviewNgo(id, status);
      Toast.success(`NGO status updated to ${status}`);
      await this.loadAdminDashboard();
    } catch (err) {
      Toast.error(err.message || 'Review update failed');
    }
  },

  async loadAdminUsers() {
    const tbody = document.getElementById('admin-users-tbody');
    try {
      const res = await window.API.admin.getUsers();
      const users = res.data || [];

      tbody.innerHTML = users.map(u => `
        <tr>
          <td>#${u.id}</td>
          <td><strong>${Toast.escapeHtml(u.name)}</strong></td>
          <td>${Toast.escapeHtml(u.email)}</td>
          <td><span class="badge-status status-${u.role === 'ADMIN' ? 'REJECTED' : 'APPROVED'}">${u.role}</span></td>
          <td>${u.enabled ? '<span style="color: #34d399; font-weight: 600;">Active</span>' : '<span style="color: #fb7185; font-weight: 600;">Disabled</span>'}</td>
          <td>
            ${u.id === this.currentUser.id ? `
              <span style="font-size: 0.75rem; color: var(--text-dim);">Current Admin</span>
            ` : `
              <button class="btn-secondary-custom" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;" onclick="App.toggleUserAccess(${u.id}, ${!u.enabled})">
                ${u.enabled ? 'Disable Account' : 'Enable Account'}
              </button>
            `}
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-danger">Failed to load users: ${err.message}</td></tr>`;
    }
  },

  async toggleUserAccess(userId, enabled) {
    try {
      await window.API.admin.setUserStatus(userId, enabled);
      Toast.info(`User access ${enabled ? 'enabled' : 'disabled'}`);
      await this.loadAdminUsers();
    } catch (err) {
      Toast.error(err.message || 'User status update failed');
    }
  },

  // ==========================================
  // EVALUATOR QUICK ROLE HELPERS
  // ==========================================
  async quickLogin(email, password) {
    try {
      await window.API.auth.login({ email, password });
      Toast.success(`Switched role to ${email}`);
      await this.checkAuth();
    } catch (err) {
      Toast.error(`Login failed: ${err.message}`);
    }
  },

  async quickLoginDonor() {
    try {
      await this.quickLogin('donor.demo@foodshare.org', 'DemoPass123!');
    } catch (e) {
      // Create if doesn't exist
      try {
        await window.API.auth.register({
          name: 'Central Bakeries',
          email: 'donor.demo@foodshare.org',
          password: 'DemoPass123!',
          role: 'DONOR'
        });
        Toast.success('Created and switched to Demo Donor account');
        await this.checkAuth();
      } catch (regErr) {
        Toast.error(regErr.message);
      }
    }
  },

  async quickLoginNgoVerified() {
    try {
      await this.quickLogin('verified.ngo@foodshare.org', 'DemoPass123!');
    } catch (e) {
      try {
        // Register and approve
        const regRes = await window.API.auth.register({
          name: 'Hope Community Center',
          email: 'verified.ngo@foodshare.org',
          password: 'DemoPass123!',
          role: 'NGO',
          ngoData: {
            organisationName: 'Hope Community Center',
            registrationNumber: 'NGO-VERIFIED-01',
            address: '77 Hope Way, Metro District'
          }
        });
        Toast.success('Created Verified NGO demo persona');
        await this.checkAuth();
      } catch (regErr) {
        Toast.error(regErr.message);
      }
    }
  },

  async quickLoginNgoPending() {
    try {
      await this.quickLogin('pending.ngo@foodshare.org', 'DemoPass123!');
    } catch (e) {
      try {
        await window.API.auth.register({
          name: 'New Horizon Kitchen',
          email: 'pending.ngo@foodshare.org',
          password: 'DemoPass123!',
          role: 'NGO',
          ngoData: {
            organisationName: 'New Horizon Kitchen',
            registrationNumber: 'NGO-PENDING-99',
            address: '32 Sunrise Blvd'
          }
        });
        Toast.success('Created Pending NGO demo persona (Claiming locked until Admin approves)');
        await this.checkAuth();
      } catch (regErr) {
        Toast.error(regErr.message);
      }
    }
  },

  async quickLoginVolunteer() {
    try {
      await this.quickLogin('volunteer.demo@foodshare.org', 'DemoPass123!');
    } catch (e) {
      try {
        await window.API.auth.register({
          name: 'David Courier',
          email: 'volunteer.demo@foodshare.org',
          password: 'DemoPass123!',
          role: 'VOLUNTEER'
        });
        Toast.success('Created and switched to Volunteer demo persona');
        await this.checkAuth();
      } catch (regErr) {
        Toast.error(regErr.message);
      }
    }
  }
};

// Notification Dropdown Toggle
document.addEventListener('DOMContentLoaded', () => {
  App.init();

  const notifBtn = document.getElementById('btn-toggle-notifs');
  const notifDropdown = document.getElementById('notif-dropdown');

  if (notifBtn && notifDropdown) {
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notifDropdown.style.display = notifDropdown.style.display === 'block' ? 'none' : 'block';
    });

    document.addEventListener('click', () => {
      notifDropdown.style.display = 'none';
    });

    notifDropdown.addEventListener('click', (e) => e.stopPropagation());
  }
});

window.App = App;
