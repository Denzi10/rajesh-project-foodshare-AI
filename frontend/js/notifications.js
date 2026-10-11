/**
 * FoodShare AI - In-App Notification & Toast UI Manager
 */

const Toast = {
  container: null,

  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container-custom';
      document.body.appendChild(this.container);
    }
  },

  show(message, type = 'success', duration = 4000) {
    this.init();
    const item = document.createElement('div');
    item.className = `toast-item ${type}`;

    let icon = '✓';
    if (type === 'error') icon = '✕';
    if (type === 'warning') icon = '⚠';
    if (type === 'info') icon = 'ℹ';

    item.innerHTML = `
      <span style="font-weight: bold; font-size: 1.1rem;">${icon}</span>
      <div style="flex: 1; font-size: 0.9rem;">${this.escapeHtml(message)}</div>
    `;

    this.container.appendChild(item);

    setTimeout(() => {
      item.style.opacity = '0';
      item.style.transform = 'translateX(100%)';
      item.style.transition = 'all 0.3s ease';
      setTimeout(() => item.remove(), 300);
    }, duration);
  },

  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error'); },
  warning(msg) { this.show(msg, 'warning'); },
  info(msg) { this.show(msg, 'info'); },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

const NotificationManager = {
  unreadCount: 0,
  pollTimer: null,

  async refresh() {
    if (!window.currentUser) {
      this.updateBell(0);
      return;
    }

    try {
      const res = await window.API.notifications.get();
      if (res.success && res.data) {
        this.unreadCount = res.data.unreadCount || 0;
        this.updateBell(this.unreadCount);
        this.renderList(res.data.notifications || []);
      }
    } catch (err) {
      // quiet fail on background polling
    }
  },

  updateBell(count) {
    const badge = document.getElementById('notif-badge');
    if (badge) {
      if (count > 0) {
        badge.textContent = count > 9 ? '9+' : count;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
  },

  renderList(notifications) {
    const listElem = document.getElementById('notif-dropdown-list');
    if (!listElem) return;

    if (notifications.length === 0) {
      listElem.innerHTML = `
        <div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
          No notifications yet
        </div>
      `;
      return;
    }

    listElem.innerHTML = notifications.map(n => `
      <div class="notif-item ${n.read_flag ? '' : 'unread'}" onclick="NotificationManager.markSingleRead(${n.id})">
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
          <strong style="color: ${n.type === 'SUCCESS' ? '#34d399' : '#38bdf8'}; font-size: 0.75rem;">
            ${n.type || 'NOTICE'}
          </strong>
          <span style="font-size: 0.7rem; color: var(--text-dim);">${new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
        <div>${Toast.escapeHtml(n.message)}</div>
      </div>
    `).join('');
  },

  async markSingleRead(id) {
    try {
      await window.API.notifications.markRead(id);
      await this.refresh();
    } catch (err) {
      console.error(err);
    }
  },

  async markAllRead() {
    try {
      await window.API.notifications.markAllRead();
      Toast.success('All notifications marked as read');
      await this.refresh();
    } catch (err) {
      Toast.error('Failed to mark notifications as read');
    }
  },

  startPolling() {
    this.refresh();
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => this.refresh(), 15000); // Poll every 15s
  },

  stopPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }
};

window.Toast = Toast;
window.NotificationManager = NotificationManager;
