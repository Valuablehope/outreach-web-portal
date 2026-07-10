const API_BASE_URL = 'https://him-plc-muslim-immigrants.trycloudflare.com';

const App = {
    // ------------------------------------------------------------
    // INIT
    // ------------------------------------------------------------
    init() {
        this.applyTheme(localStorage.getItem('pui-theme') || 'light');
        if (localStorage.getItem('pui-sidebar') === 'mini') {
            document.querySelector('.app-container').classList.add('mini');
        }
        this.bindEvents();
        this.renderLookupChips();
        this.renderRecordChips();
        this.renderExportGrid();

        if (this._token()) {
            this.showApp();
        } else {
            this.showLogin();
        }
    },

    // ------------------------------------------------------------
    // AUTH
    // ------------------------------------------------------------
    _token() { return localStorage.getItem('pui-token'); },

    // Authenticated fetch for /api/admin endpoints; a 401 means the
    // token expired (or the server restarted) — back to the login screen.
    async api(path, opts = {}) {
        const res = await fetch(`${API_BASE_URL}${path}`, {
            ...opts,
            headers: { ...(opts.headers || {}), 'Authorization': `Bearer ${this._token()}` },
        });
        if (res.status === 401) {
            this.forceLogout('Your session has expired. Please sign in again.');
            throw new Error('Unauthorized');
        }
        return res;
    },

    showLogin(message) {
        document.getElementById('app-container').hidden = true;
        document.getElementById('login-screen').hidden = false;
        const err = document.getElementById('login-error');
        err.hidden = !message;
        if (message) err.innerText = message;
        setTimeout(() => document.getElementById('login-username').focus(), 50);
    },

    showApp() {
        document.getElementById('login-screen').hidden = true;
        document.getElementById('app-container').hidden = false;
        const username = localStorage.getItem('pui-user') || 'Admin';
        document.getElementById('user-name').innerText = username;
        const avatar = document.getElementById('user-avatar');
        avatar.innerText = username.slice(0, 2).toUpperCase();
        avatar.style.background = this._avatarColor(username);
        this.navigate('dashboard');
        this.loadDashboard();
    },

    async login(e) {
        e.preventDefault();
        const btn = document.getElementById('login-btn');
        const err = document.getElementById('login-error');
        err.hidden = true;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Signing in...';
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: document.getElementById('login-username').value.trim(),
                    password: document.getElementById('login-password').value,
                }),
            });
            let json = null;
            try { json = await res.json(); } catch { /* non-JSON (e.g. 404 page) */ }
            if (json && json.success) {
                localStorage.setItem('pui-token', json.token);
                localStorage.setItem('pui-user', json.username);
                document.getElementById('login-password').value = '';
                this.showApp();
                this.showToast(`Welcome back, ${json.username}!`);
            } else if (res.status === 404) {
                err.innerText = 'The backend has not been updated with login support yet. Pull and restart the server, then try again.';
                err.hidden = false;
            } else {
                err.innerText = (json && json.error) || 'Sign in failed. Please try again.';
                err.hidden = false;
            }
        } catch (ex) {
            console.error(ex);
            err.innerText = 'Could not reach the server. Check your connection and the tunnel URL.';
            err.hidden = false;
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In';
        }
    },

    async logout() {
        const ok = await this.confirmDialog('Sign out of the admin portal?', 'Sign Out');
        if (!ok) return;
        this.forceLogout();
    },

    forceLogout(message) {
        localStorage.removeItem('pui-token');
        localStorage.removeItem('pui-user');
        this.closeDrawer();
        this.closePalette();
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
        this.showLogin(message);
    },

    bindEvents() {
        document.querySelectorAll('.nav-links li').forEach(item => {
            item.addEventListener('click', () => this.navigate(item.getAttribute('data-tab')));
        });

        const sidebar = document.getElementById('sidebar');
        document.getElementById('menu-toggle').addEventListener('click', () => sidebar.classList.toggle('open'));
        document.getElementById('sidebar-backdrop').addEventListener('click', () => sidebar.classList.remove('open'));
        document.getElementById('collapse-btn').addEventListener('click', () => {
            const c = document.querySelector('.app-container');
            c.classList.toggle('mini');
            localStorage.setItem('pui-sidebar', c.classList.contains('mini') ? 'mini' : 'full');
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => { if (e.target === modal) this.closeModals(); });
        });

        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                this.openPalette();
            } else if (e.key === 'Escape') {
                this.closePalette();
                this.closeModals();
                this.closeDrawer();
            }
        });

        const paletteInput = document.getElementById('palette-input');
        paletteInput.addEventListener('input', () => this.renderPalette());
        paletteInput.addEventListener('keydown', (e) => {
            const items = [...document.querySelectorAll('#palette-list li[data-idx]')];
            if (items.length === 0) return;
            let sel = items.findIndex(li => li.classList.contains('selected'));
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                sel = e.key === 'ArrowDown' ? (sel + 1) % items.length : (sel - 1 + items.length) % items.length;
                items.forEach(li => li.classList.remove('selected'));
                items[sel].classList.add('selected');
                items[sel].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter') {
                e.preventDefault();
                (items[sel] || items[0]).click();
            }
        });
        document.getElementById('palette').addEventListener('click', (e) => {
            if (e.target === document.getElementById('palette')) this.closePalette();
        });
    },

    _titles: {
        dashboard: 'Dashboard', users: 'Users', lookups: 'Lookups Setup',
        records: 'Records', export: 'Data Hub',
    },

    navigate(tabId) {
        document.querySelectorAll('.nav-links li').forEach(i =>
            i.classList.toggle('active', i.getAttribute('data-tab') === tabId));
        document.querySelectorAll('.tab-content').forEach(c =>
            c.classList.toggle('active', c.id === tabId));
        document.getElementById('page-title').innerText = this._titles[tabId] || tabId;
        document.getElementById('crumb').innerText = this._titles[tabId] || tabId;
        document.getElementById('sidebar').classList.remove('open');

        if (tabId === 'users') this.loadUsers();
        if (tabId === 'lookups') this.loadLookupTable();
        if (tabId === 'records') this.loadRecords();
        if (tabId === 'notifications') this.loadNotifications();
    },

    // ------------------------------------------------------------
    // THEME
    // ------------------------------------------------------------
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('pui-theme', theme);
        const icon = document.querySelector('#theme-toggle i');
        if (icon) icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    },

    toggleTheme() {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        this.applyTheme(next);
        if (this._analytics) this.renderCharts(this._analytics); // re-render with new palette
    },

    _cssVar(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    },

    // ------------------------------------------------------------
    // DASHBOARD
    // ------------------------------------------------------------
    _kpiMeta: {
        'KitsDistribution': { label: 'Kits Distributed', icon: 'fa-box-open', tint: 'blue' },
        'AwarenessSessions': { label: 'Awareness Sessions', icon: 'fa-people-group', tint: 'violet' },
        'MWCounseling': { label: 'MW Counseling', icon: 'fa-clipboard-user', tint: 'amber' },
        'SRAForm': { label: 'SRA Forms', icon: 'fa-child-reaching', tint: 'rose' },
        'Users': { label: 'System Users', icon: 'fa-users-gear', tint: 'teal' },
    },

    async loadDashboard(manual = false) {
        if (manual) this.showToast('Refreshing dashboard...');
        this._setHealth(null);
        await Promise.all([this.loadStats(), this.loadAnalytics()]);
    },

    _setHealth(ok) {
        const dot = document.getElementById('health-dot');
        const label = document.getElementById('health-label');
        if (ok === null) { dot.className = 'status-indicator'; label.innerText = 'Checking...'; return; }
        dot.className = 'status-indicator ' + (ok ? 'online' : 'offline');
        label.innerText = ok ? 'API Online' : 'API Offline';
    },

    async loadStats() {
        const container = document.getElementById('stats-container');
        try {
            const res = await this.api('/api/admin/stats');
            const json = await res.json();
            if (!json.success) throw new Error('stats failed');
            this._setHealth(true);

            container.innerHTML = '';
            for (const [table, count] of Object.entries(json.stats)) {
                const m = this._kpiMeta[table] || { label: table, icon: 'fa-database', tint: 'blue' };
                const card = document.createElement('div');
                card.className = 'stat-card';
                card.innerHTML = `
                    <div class="stat-top">
                        <div class="stat-icon ${m.tint}"><i class="fa-solid ${m.icon}"></i></div>
                        <span class="stat-delta flat" data-delta="${table}"></span>
                    </div>
                    <div class="stat-value">0</div>
                    <div class="stat-label">${m.label}</div>
                `;
                container.appendChild(card);
                this._countUp(card.querySelector('.stat-value'), Number(count) || 0);
            }
            this._applyDeltas();
        } catch (e) {
            console.error(e);
            this._setHealth(false);
            container.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
                <i class="fa-solid fa-plug-circle-xmark"></i><p>Could not reach the API. Check the tunnel URL.</p></div>`;
        }
    },

    _countUp(el, target, duration = 800) {
        const start = performance.now();
        const step = (now) => {
            const p = Math.min((now - start) / duration, 1);
            el.innerText = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString();
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    },

    // Month-over-month % change badges, computed from analytics monthly data
    _applyDeltas() {
        if (!this._analytics) return;
        const byTable = {};
        this._analytics.monthly.forEach(r => {
            (byTable[r.tableName] = byTable[r.tableName] || {})[r.month] = r.count;
        });
        const months = [...new Set(this._analytics.monthly.map(r => r.month))].sort();
        const [prev, curr] = months.slice(-2);
        document.querySelectorAll('[data-delta]').forEach(el => {
            const t = el.getAttribute('data-delta');
            if (!byTable[t] || !curr) { el.style.display = 'none'; return; }
            const c = byTable[t][curr] || 0, p = byTable[t][prev] || 0;
            if (p === 0 && c === 0) { el.style.display = 'none'; return; }
            const pct = p === 0 ? 100 : Math.round(((c - p) / p) * 100);
            el.className = 'stat-delta ' + (pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat');
            el.innerHTML = `<i class="fa-solid fa-arrow-trend-${pct >= 0 ? 'up' : 'down'}"></i> ${Math.abs(pct)}%`;
        });
    },

    async loadAnalytics() {
        const area = document.getElementById('charts-area');
        const note = document.getElementById('charts-unavailable');
        try {
            const res = await this.api('/api/admin/analytics');
            if (!res.ok) throw new Error('analytics unavailable');
            const json = await res.json();
            if (!json.success) throw new Error('analytics failed');
            this._analytics = json;
            area.hidden = false;
            note.hidden = true;
            this.renderCharts(json);
            this._applyDeltas();
        } catch (e) {
            console.warn('Analytics not available:', e.message);
            area.hidden = true;
            note.hidden = false;
        }
    },

    _charts: {},

    _destroyChart(id) {
        if (this._charts[id]) { this._charts[id].destroy(); delete this._charts[id]; }
    },

    renderCharts(data) {
        if (typeof Chart === 'undefined') return;
        const text2 = this._cssVar('--text-2');
        const grid = this._cssVar('--chart-grid');
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.color = text2;

        const palette = {
            KitsDistribution: '#0ea5e9',
            AwarenessSessions: '#8b5cf6',
            MWCounseling: '#f59e0b',
            SRAForm: '#f43f5e',
        };

        // --- Monthly stacked bars ---
        const months = [...new Set(data.monthly.map(r => r.month))].sort();
        const monthLabels = months.map(m => {
            const [y, mo] = m.split('-');
            return new Date(y, mo - 1).toLocaleString('en', { month: 'short', year: '2-digit' });
        });
        const datasets = Object.keys(palette).map(t => ({
            label: this._kpiMeta[t].label,
            data: months.map(m => (data.monthly.find(r => r.tableName === t && r.month === m) || {}).count || 0),
            backgroundColor: palette[t],
            borderRadius: 6,
            maxBarThickness: 34,
        }));

        this._destroyChart('monthly');
        this._charts.monthly = new Chart(document.getElementById('chart-monthly'), {
            type: 'bar',
            data: { labels: monthLabels, datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'top', labels: { usePointStyle: true, pointStyleWidth: 8, boxHeight: 8 } } },
                scales: {
                    x: { stacked: true, grid: { display: false } },
                    y: { stacked: true, grid: { color: grid }, border: { display: false }, ticks: { precision: 0 } },
                },
            },
        });

        // --- Gender doughnut ---
        this._destroyChart('gender');
        this._charts.gender = new Chart(document.getElementById('chart-gender'), {
            type: 'doughnut',
            data: {
                labels: data.gender.map(g => g.gender),
                datasets: [{
                    data: data.gender.map(g => g.count),
                    backgroundColor: ['#ec4899', '#3b82f6', '#94a3b8', '#f59e0b'],
                    borderWidth: 0,
                    hoverOffset: 8,
                }],
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '68%',
                plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyleWidth: 8, boxHeight: 8 } } },
            },
        });

        // --- Top shelters horizontal bars ---
        this._destroyChart('shelters');
        this._charts.shelters = new Chart(document.getElementById('chart-shelters'), {
            type: 'bar',
            data: {
                labels: data.shelters.map(s => s.name),
                datasets: [{
                    data: data.shelters.map(s => s.count),
                    backgroundColor: '#06b6d4',
                    borderRadius: 6,
                    maxBarThickness: 22,
                }],
            },
            options: {
                indexAxis: 'y',
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: grid }, border: { display: false }, ticks: { precision: 0 } },
                    y: { grid: { display: false } },
                },
            },
        });
    },

    // ------------------------------------------------------------
    // ------------------------------------------------------------
    // NOTIFICATIONS
    // ------------------------------------------------------------
    async loadNotifications() {
        try {
            const res = await this.api('/api/admin/notifications');
            const json = await res.json();
            const tbody = document.getElementById('notifications-table-body');
            if (json.success) {
                this._notifications = json.data;
                tbody.innerHTML = json.data.map(n => `
                    <tr>
                        <td>${n.MessageText || ''}</td>
                        <td><span class="badge ${n.IsActive ? 'badge-success' : 'badge-danger'}">${n.IsActive ? 'Yes' : 'No'}</span></td>
                        <td>${n.ExpiryDate ? new Date(n.ExpiryDate).toLocaleString() : 'N/A'}</td>
                        <td>${new Date(n.CreatedAt).toLocaleString()}</td>
                        <td>
                            <button class="icon-btn" onclick="app.editNotification('${n.NotificationID}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
                            <button class="icon-btn text-danger" onclick="app.deleteNotification('${n.NotificationID}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    </tr>
                `).join('');
                if (json.data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">No notifications found</td></tr>';
                }
            }
        } catch (e) {
            console.error(e);
            this.showToast('Failed to load notifications', 'error');
        }
    },

    editNotification(id) {
        let n = id ? this._notifications.find(x => x.NotificationID === id) : null;
        this._editingNotificationId = id || null;
        document.getElementById('notification-modal-title').innerText = id ? 'Edit Notification' : 'Add Notification';
        document.getElementById('notif-message').value = n ? n.MessageText : '';
        document.getElementById('notif-active').value = n && n.IsActive ? '1' : '0';
        document.getElementById('notif-expiry').value = n && n.ExpiryDate ? new Date(new Date(n.ExpiryDate).getTime() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,16) : '';
        
        document.getElementById('notification-modal').classList.add('show');
    },

    async saveNotification(e) {
        e.preventDefault();
        const msg = document.getElementById('notif-message').value;
        const active = document.getElementById('notif-active').value === '1';
        const expiry = document.getElementById('notif-expiry').value;
        const id = this._editingNotificationId;

        const payload = { MessageText: msg, IsActive: active, ExpiryDate: expiry || null };
        const url = id ? `/api/admin/notifications/` + encodeURIComponent(id) : `/api/admin/notifications`;
        const method = id ? 'PUT' : 'POST';

        try {
            const res = await this.api(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            if (json.success) {
                this.closeModals();
                this.loadNotifications();
                this.showToast(id ? 'Notification updated' : 'Notification created');
            } else {
                this.showToast(json.error || 'Failed to save', 'error');
            }
        } catch (err) {
            console.error(err);
            this.showToast('Failed to save notification', 'error');
        }
    },

    async deleteNotification(id) {
        if (!await this.confirmDialog('Delete this notification?')) return;
        try {
            const res = await this.api(`/api/admin/notifications/` + encodeURIComponent(id), { method: 'DELETE' });
            if ((await res.json()).success) {
                this.loadNotifications();
                this.showToast('Notification deleted');
            }
        } catch (e) {
            console.error(e);
            this.showToast('Failed to delete notification', 'error');
        }
    },
    // USERS
    // ------------------------------------------------------------
    async loadUsers() {
        try {
            const res = await this.api('/api/admin/users');
            const json = await res.json();
            this._usersData = (json.success && json.data) || [];
            this.renderUsers();
        } catch (e) {
            console.error(e);
            document.getElementById('users-table-body').innerHTML =
                `<tr><td colspan="3"><div class="empty-state"><i class="fa-solid fa-plug-circle-xmark"></i><p>Failed to load users.</p></div></td></tr>`;
        }
    },

    _avatarColor(name) {
        const colors = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#f43f5e', '#06b6d4', '#6366f1'];
        let h = 0;
        for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
        return colors[h % colors.length];
    },

    renderUsers() {
        const tbody = document.getElementById('users-table-body');
        const q = (document.getElementById('user-search').value || '').trim().toLowerCase();
        const users = (this._usersData || []).filter(u => !q || u.Username.toLowerCase().includes(q));

        if (users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state">
                <i class="fa-solid fa-users-slash"></i><p>${q ? 'No users match your filter.' : 'No users yet. Add your first user.'}</p></div></td></tr>`;
            return;
        }

        tbody.innerHTML = users.map(user => {
            const i = this._usersData.indexOf(user);
            const role = user.Role || 'FieldWorker';
            const isAdmin = role.toLowerCase() === 'admin';
            const initials = user.Username.slice(0, 2).toUpperCase();
            return `<tr>
                <td><div class="user-cell">
                    <span class="avatar" style="background:${this._avatarColor(user.Username)}">${initials}</span>
                    ${user.Username}</div></td>
                <td><span class="badge ${isAdmin ? 'badge-admin' : 'badge-worker'}">
                    <i class="fa-solid ${isAdmin ? 'fa-user-shield' : 'fa-user'}"></i> ${role}</span></td>
                <td><div class="row-actions">
                    <button class="btn btn-outline btn-sm" onclick="app.editUser(${i})"><i class="fa-solid fa-pen"></i> Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="app.deleteUser('${user.Username}')"><i class="fa-solid fa-trash-can"></i></button>
                </div></td>
            </tr>`;
        }).join('');
    },

    showUserModal() {
        this._editingUser = null;
        document.getElementById('user-modal-title').innerText = 'Add User';
        document.getElementById('user-modal').classList.add('show');
        const username = document.getElementById('user-username');
        const password = document.getElementById('user-password');
        username.value = '';
        username.disabled = false;
        password.value = '';
        password.required = true;
        password.placeholder = '';
    },

    editUser(index) {
        const user = this._usersData[index];
        if (!user) return;
        this._editingUser = user.Username;
        document.getElementById('user-modal-title').innerText = `Edit ${user.Username}`;
        document.getElementById('user-modal').classList.add('show');
        const username = document.getElementById('user-username');
        const password = document.getElementById('user-password');
        username.value = user.Username;
        username.disabled = true;
        password.value = '';
        password.required = false;
        password.placeholder = 'Leave blank to keep current password';
        document.getElementById('user-role').value = user.Role || 'FieldWorker';
    },

    async saveUser(e) {
        e.preventDefault();
        const username = document.getElementById('user-username').value;
        const password = document.getElementById('user-password').value;
        const role = document.getElementById('user-role').value;

        const editing = !!this._editingUser;
        const url = editing
            ? `/api/admin/users/${encodeURIComponent(this._editingUser)}`
            : `/api/admin/users`;

        try {
            const res = await this.api(url, {
                method: editing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editing ? { password, role } : { username, password, role }),
            });
            const json = await res.json();
            if (json.success) {
                this.closeModals();
                this.showToast('User saved successfully');
                this.loadUsers();
            } else {
                this.showToast(json.error || 'Failed to save user', 'error');
            }
        } catch (err) {
            console.error(err);
            this.showToast('Failed to save user', 'error');
        }
    },

    async deleteUser(username) {
        const ok = await this.confirmDialog(`Delete user "${username}"? This cannot be undone.`);
        if (!ok) return;
        try {
            const res = await this.api(`/api/admin/users/${encodeURIComponent(username)}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.success) {
                this.showToast('User deleted');
                this.loadUsers();
            } else {
                this.showToast(json.error || 'Failed to delete user', 'error');
            }
        } catch (e) { console.error(e); }
    },

    // ------------------------------------------------------------
    // LOOKUPS
    // ------------------------------------------------------------
    _lookupTables: ['Projects', 'Shelters', 'DocumentTypes', 'HealthTopics',
        'KitsTypes', 'TargetCategories', 'CounselingTopics', 'PHCCs', 'Frontliners'],
    _lookupTable: 'Projects',

    _prettyName(t) { return t.replace(/([a-z])([A-Z])/g, '$1 $2'); },

    renderLookupChips() {
        document.getElementById('lookup-tabs').innerHTML = this._lookupTables.map(t =>
            `<button class="chip ${t === this._lookupTable ? 'active' : ''}"
                onclick="app.selectLookupTable('${t}')">${this._prettyName(t)}</button>`).join('');
    },

    selectLookupTable(t) {
        this._lookupTable = t;
        this.renderLookupChips();
        this.loadLookupTable();
    },

    async loadLookupTable() {
        const table = this._lookupTable;
        const tbody = document.getElementById('lookups-table-body');
        tbody.innerHTML = '<tr><td colspan="2"><div class="skeleton-rows"></div></td></tr>';
        try {
            const res = await this.api(`/api/admin/lookups/${table}`);
            const json = await res.json();
            if (json.success && json.data.length > 0) {
                const keys = Object.keys(json.data[0]);
                const idCol = keys[0];
                const nameCol = keys[1] || keys[0];
                this._lookupRows = { idCol, nameCol, data: json.data };

                tbody.innerHTML = json.data.map((row, i) => `
                    <tr>
                        <td style="font-weight:500;">${row[nameCol]}</td>
                        <td><div class="row-actions">
                            <button class="btn btn-outline btn-sm" onclick="app.editLookup(${i})"><i class="fa-solid fa-pen"></i> Edit</button>
                            <button class="btn btn-danger btn-sm" onclick="app.deleteLookup('${table}', '${row[idCol]}')"><i class="fa-solid fa-trash-can"></i></button>
                        </div></td>
                    </tr>`).join('');
            } else {
                tbody.innerHTML = `<tr><td colspan="2"><div class="empty-state">
                    <i class="fa-solid fa-folder-open"></i><p>No records in ${this._prettyName(table)} yet. Add one or import a template.</p></div></td></tr>`;
            }
        } catch (e) {
            console.error(e);
            tbody.innerHTML = `<tr><td colspan="2"><div class="empty-state">
                <i class="fa-solid fa-plug-circle-xmark"></i><p>Failed to load ${this._prettyName(table)}.</p></div></td></tr>`;
        }
    },

    showLookupModal() {
        this._editingLookupId = null;
        document.getElementById('lookup-modal-title').innerText = `Add ${this._prettyName(this._lookupTable)}`;
        document.getElementById('lookup-modal').classList.add('show');
        document.getElementById('lookup-name').value = '';
    },

    editLookup(index) {
        const rows = this._lookupRows;
        if (!rows || !rows.data[index]) return;
        const row = rows.data[index];
        this._editingLookupId = row[rows.idCol];
        document.getElementById('lookup-modal-title').innerText = `Edit ${this._prettyName(this._lookupTable)}`;
        document.getElementById('lookup-modal').classList.add('show');
        document.getElementById('lookup-name').value = row[rows.nameCol] || '';
    },

    async saveLookup(e) {
        e.preventDefault();
        const table = this._lookupTable;
        const name = document.getElementById('lookup-name').value;
        const editingId = this._editingLookupId;
        const url = editingId
            ? `/api/admin/lookups/${table}/${encodeURIComponent(editingId)}`
            : `/api/admin/lookups/${table}`;
        try {
            const res = await this.api(url, {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            const json = await res.json();
            if (json.success) {
                this.closeModals();
                this._lookupCache = null; // names changed; records tab will refetch
                this.showToast('Record saved successfully');
                this.loadLookupTable();
            } else {
                this.showToast(json.error || 'Failed to save record', 'error');
            }
        } catch (err) {
            console.error(err);
            this.showToast('Failed to save record', 'error');
        }
    },

    async deleteLookup(table, id) {
        const ok = await this.confirmDialog(`Delete this ${this._prettyName(table)} record? Records referencing it may break.`);
        if (!ok) return;
        try {
            const res = await this.api(`/api/admin/lookups/${table}/${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.success) {
                this.showToast('Record deleted');
                this.loadLookupTable();
            } else {
                this.showToast(json.error || 'Failed to delete record', 'error');
            }
        } catch (e) { console.error(e); }
    },

    // ------------------------------------------------------------
    // RECORDS
    // ------------------------------------------------------------
    _recordTables: {
        KitsDistribution: 'Kits Distribution',
        KitsDistributionPeopleDetails: 'Household Members',
        AwarenessSessions: 'Awareness Sessions',
        MWCounseling: 'MW Counseling',
        SRAForm: 'SRA Forms',
    },
    _recordTable: 'KitsDistribution',
    _recordPage: 1,
    _recordSort: null,
    PAGE_SIZE: 25,

    _recordConfigs: {
        KitsDistribution: {
            display: ['DistributionDate', 'Name', 'Gender', 'Nationality', 'KitTypeID', 'ShelterID', 'NumberOfPeopleServed'],
            fields: [
                { col: 'DistributionDate', label: 'Distribution Date', type: 'date' },
                { col: 'Name', label: 'Head of Household Name', type: 'text' },
                { col: 'PhoneNumber', label: 'Phone Number', type: 'text' },
                { col: 'Gender', label: 'Gender', type: 'select', options: ['Female', 'Male'] },
                { col: 'Nationality', label: 'Nationality', type: 'text' },
                { col: 'DateOfBirth', label: 'Date of Birth', type: 'date' },
                { col: 'KitTypeID', label: 'Kit Type', type: 'lookup', lookup: 'kitsType' },
                { col: 'NumberOfPeopleServed', label: 'Number of People Served', type: 'number' },
                { col: 'ShelterID', label: 'Shelter', type: 'lookup', lookup: 'shelters' },
                { col: 'ProjectID', label: 'Project', type: 'lookup', lookup: 'projects' },
                { col: 'IsDisplaced', label: 'Is Displaced', type: 'yesno' },
            ],
        },
        KitsDistributionPeopleDetails: {
            display: ['DistributionID', 'Nationality', 'Gender', 'Age'],
            fields: [
                { col: 'Nationality', label: 'Nationality', type: 'text' },
                { col: 'Gender', label: 'Gender', type: 'select', options: ['Female', 'Male'] },
                { col: 'Age', label: 'Age', type: 'number' },
            ],
        },
        AwarenessSessions: {
            display: ['SessionDate', 'Name', 'Gender', 'Nationality', 'PhoneNumber', 'ShelterID'],
            fields: [
                { col: 'SessionDate', label: 'Session Date', type: 'date' },
                { col: 'Name', label: 'Name', type: 'text' },
                { col: 'Gender', label: 'Gender', type: 'select', options: ['Female', 'Male'] },
                { col: 'Nationality', label: 'Nationality', type: 'text' },
                { col: 'DateOfBirth', label: 'Date of Birth', type: 'date' },
                { col: 'PhoneNumber', label: 'Phone Number', type: 'text' },
                { col: 'DocumentTypeID', label: 'Document Type', type: 'lookup', lookup: 'documentTypes' },
                { col: 'DocumentNumber', label: 'Document Number', type: 'text' },
                { col: 'ProjectID', label: 'Project', type: 'lookup', lookup: 'projects' },
                { col: 'ShelterID', label: 'Shelter', type: 'lookup', lookup: 'shelters' },
            ],
        },
        MWCounseling: {
            display: ['CounselingDate', 'Name', 'Nationality', 'ShelterID', 'TargetCategoryID', 'PHCCReferredToID'],
            fields: [
                { col: 'CounselingDate', label: 'Counseling Date', type: 'date' },
                { col: 'Name', label: 'Name', type: 'text' },
                { col: 'Gender', label: 'Gender', type: 'select', options: ['Female', 'Male'] },
                { col: 'Nationality', label: 'Nationality', type: 'text' },
                { col: 'DateOfBirth', label: 'Date of Birth', type: 'date' },
                { col: 'PhoneNumber', label: 'Phone Number', type: 'text' },
                { col: 'EDD', label: 'EDD', type: 'date' },
                { col: 'LMP', label: 'LMP', type: 'date' },
                { col: 'GestationalAgeWeeks', label: 'Gestational Age (Weeks)', type: 'number' },
                { col: 'GestationalAgeDays', label: 'Gestational Age (Days)', type: 'number' },
                { col: 'TargetCategoryID', label: 'Target Category', type: 'lookup', lookup: 'targetCategories' },
                { col: 'TopicOther', label: 'Topic (Other)', type: 'text' },
                { col: 'ShelterID', label: 'Shelter', type: 'lookup', lookup: 'shelters' },
                { col: 'PHCCReferredToID', label: 'PHCC Referred To', type: 'lookup', lookup: 'phcc' },
                { col: 'KitsDistributed', label: 'Kits Distributed', type: 'yesno' },
                { col: 'KitTypeID', label: 'Kit Type', type: 'lookup', lookup: 'kitsType' },
                { col: 'BMSDistributed', label: 'BMS Distributed', type: 'yesno' },
                { col: 'BMSQuantity', label: 'BMS Quantity', type: 'number' },
                { col: 'SRADone', label: 'SRA Done', type: 'yesno' },
            ],
        },
        SRAForm: {
            display: ['Date', 'ChildName', 'Gender', 'AgeGroup', 'ShelterID', 'MUAC'],
            fields: [
                { col: 'Date', label: 'Assessment Date', type: 'date' },
                { col: 'ChildName', label: 'Child Name', type: 'text' },
                { col: 'Gender', label: 'Gender', type: 'select', options: ['Girl', 'Boy'] },
                { col: 'AgeGroup', label: 'Age Group', type: 'select', options: ['0-5 Months', '6-11 Months', '12-23 Months'] },
                { col: 'ShelterID', label: 'Shelter', type: 'lookup', lookup: 'shelters' },
                { col: 'ChildStatus', label: 'Child Status', type: 'text' },
                { col: 'MUAC', label: 'MUAC', type: 'select', options: ['RED', 'Yellow', 'GREEN'] },
            ],
        },
    },

    renderRecordChips() {
        document.getElementById('record-tabs').innerHTML = Object.entries(this._recordTables).map(([t, label]) =>
            `<button class="chip ${t === this._recordTable ? 'active' : ''}"
                onclick="app.selectRecordTable('${t}')">${label}</button>`).join('');
    },

    selectRecordTable(t) {
        this._recordTable = t;
        this._recordPage = 1;
        this._recordSort = null;
        document.getElementById('record-search').value = '';
        this.renderRecordChips();
        this.loadRecords();
    },

    async _ensureLookupCache() {
        if (this._lookupCache) return this._lookupCache;
        const res = await fetch(`${API_BASE_URL}/api/sync/lookups`);
        const json = await res.json();
        this._lookupCache = json;
        this._lookupNameById = {};
        ['projects', 'shelters', 'documentTypes', 'healthTopics', 'kitsType',
         'targetCategories', 'counselingTopics', 'phcc', 'frontliners'].forEach(key => {
            (json[key] || []).forEach(item => { this._lookupNameById[item.id] = item.name; });
        });
        return this._lookupCache;
    },

    _fieldFor(table, col) {
        return this._recordConfigs[table].fields.find(f => f.col === col);
    },

    _displayValue(table, col, value) {
        if (value === null || value === undefined) return '';
        const field = this._fieldFor(table, col);
        if (field) {
            if (field.type === 'date') return String(value).slice(0, 10);
            if (field.type === 'yesno') return (value == 1 || value === true || String(value).toLowerCase() === 'true') ? 'Yes' : 'No';
            if (field.type === 'lookup') return this._lookupNameById[value] || value;
        }
        const s = String(value);
        return /^[0-9a-f-]{36}$/i.test(s) ? s.slice(0, 8) + '…' : s;
    },

    async loadRecords() {
        const table = this._recordTable;
        const tbody = document.getElementById('records-table-body');
        tbody.innerHTML = '<tr><td><div class="skeleton-rows"></div></td></tr>';
        try {
            await this._ensureLookupCache();
            const res = await this.api(`/api/admin/records/${table}`);
            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Failed to load records');
            this._records = { table, idCol: json.idCol, data: json.data };
            this._recordPage = 1;
            this.renderRecords();
        } catch (e) {
            console.error(e);
            tbody.innerHTML = `<tr><td><div class="empty-state">
                <i class="fa-solid fa-plug-circle-xmark"></i><p>Failed to load records.</p></div></td></tr>`;
        }
    },

    onRecordSearch() {
        this._recordPage = 1;
        this.renderRecords();
    },

    sortRecords(col) {
        const s = this._recordSort;
        this._recordSort = (s && s.col === col)
            ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' }
            : { col, dir: 'asc' };
        this.renderRecords();
    },

    changePage(dir) {
        this._recordPage += dir;
        this.renderRecords();
    },

    renderRecords() {
        const records = this._records;
        if (!records) return;
        const config = this._recordConfigs[records.table];
        const search = (document.getElementById('record-search').value || '').trim().toLowerCase();
        const sort = this._recordSort;

        // Head with sort arrows
        document.getElementById('records-table-head').innerHTML =
            config.display.map(col => {
                const field = this._fieldFor(records.table, col);
                const label = field ? field.label : col;
                const arrow = sort && sort.col === col
                    ? `<span class="sort-arrow"><i class="fa-solid fa-arrow-${sort.dir === 'asc' ? 'up' : 'down'}"></i></span>` : '';
                return `<th class="sortable" onclick="app.sortRecords('${col}')">${label}${arrow}</th>`;
            }).join('');

        // Filter
        let rows = records.data.map((row, i) => ({
            i,
            cells: config.display.map(col => this._displayValue(records.table, col, row[col])),
        }));
        if (search) {
            rows = rows.filter(r => r.cells.some(c => String(c).toLowerCase().includes(search)));
        }

        // Sort
        if (sort) {
            const ci = config.display.indexOf(sort.col);
            const mul = sort.dir === 'asc' ? 1 : -1;
            rows.sort((a, b) => {
                const av = a.cells[ci], bv = b.cells[ci];
                const an = parseFloat(av), bn = parseFloat(bv);
                if (!isNaN(an) && !isNaN(bn) && String(an) === String(av) && String(bn) === String(bv)) {
                    return (an - bn) * mul;
                }
                return String(av).localeCompare(String(bv)) * mul;
            });
        }

        // Paginate
        const total = rows.length;
        const pages = Math.max(1, Math.ceil(total / this.PAGE_SIZE));
        this._recordPage = Math.min(Math.max(1, this._recordPage), pages);
        const start = (this._recordPage - 1) * this.PAGE_SIZE;
        const pageRows = rows.slice(start, start + this.PAGE_SIZE);

        document.getElementById('records-count').innerText =
            `${total.toLocaleString()} record${total === 1 ? '' : 's'}${search ? ' (filtered)' : ''}`;
        document.getElementById('page-info').innerText = `${this._recordPage} / ${pages}`;
        document.getElementById('page-prev').disabled = this._recordPage <= 1;
        document.getElementById('page-next').disabled = this._recordPage >= pages;

        const tbody = document.getElementById('records-table-body');
        tbody.innerHTML = pageRows.length > 0
            ? pageRows.map(r =>
                `<tr onclick="app.editRecord(${r.i})">${r.cells.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')
            : `<tr><td colspan="${config.display.length}"><div class="empty-state">
                <i class="fa-solid fa-magnifying-glass"></i><p>No matching records found.</p></div></td></tr>`;
    },

    // --- Record editing (drawer) ---
    editRecord(index) {
        const records = this._records;
        const row = records && records.data[index];
        if (!row) return;
        const table = records.table;
        const config = this._recordConfigs[table];
        this._editingRecord = { table, id: row[records.idCol] };

        document.getElementById('drawer-title').innerText = `Edit ${this._recordTables[table] || table}`;
        const container = document.getElementById('record-form-fields');
        container.innerHTML = config.fields.map(f => {
            let input;
            if (f.type === 'lookup') {
                const options = (this._lookupCache[f.lookup] || [])
                    .map(o => `<option value="${o.id}">${o.name}</option>`).join('');
                input = `<select id="rf-${f.col}"><option value="">—</option>${options}</select>`;
            } else if (f.type === 'select') {
                const options = f.options.map(o => `<option value="${o}">${o}</option>`).join('');
                input = `<select id="rf-${f.col}"><option value="">—</option>${options}</select>`;
            } else if (f.type === 'yesno') {
                input = `<select id="rf-${f.col}"><option value="">—</option><option value="1">Yes</option><option value="0">No</option></select>`;
            } else {
                input = `<input type="${f.type}" id="rf-${f.col}">`;
            }
            const full = f.type === 'text' ? ' full' : '';
            return `<div class="form-group${full}"><label>${f.label}</label>${input}</div>`;
        }).join('');

        // Set values programmatically so Arabic text and quotes are safe
        config.fields.forEach(f => {
            const el = document.getElementById(`rf-${f.col}`);
            const value = row[f.col];
            if (value === null || value === undefined) { el.value = ''; return; }
            if (f.type === 'date') el.value = String(value).slice(0, 10);
            else if (f.type === 'yesno') {
                el.value = (value == 1 || value === true || String(value).toLowerCase() === 'true') ? '1' : '0';
            }
            else el.value = value;
        });

        if (table === 'KitsDistribution') {
            const peopleContainer = document.createElement('div');
            peopleContainer.id = 'drawer-people';
            peopleContainer.innerHTML = '<p class="hint" style="margin-top:1rem"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading household members...</p>';
            container.appendChild(peopleContainer);
            this.api(`/api/admin/records/KitsDistribution/${encodeURIComponent(row[records.idCol])}/people`)
                .then(r => r.json())
                .then(json => {
                    const el = document.getElementById('drawer-people');
                    if (!el) return;
                    if (json.success && json.data.length > 0) {
                        let html = '<hr><h3 style="margin: 1rem 0 0.5rem; font-size: 1rem;">Household Members</h3><table class="table" style="font-size:0.85rem; width:100%"><thead><tr><th style="text-align:left">Age</th><th style="text-align:left">Gender</th><th style="text-align:left">Nationality</th></tr></thead><tbody>';
                        json.data.forEach(p => {
                            html += `<tr><td>${p.Age || 0}</td><td>${p.Gender || 'N/A'}</td><td>${p.Nationality || 'N/A'}</td></tr>`;
                        });
                        html += '</tbody></table>';
                        el.innerHTML = html;
                    } else {
                        el.innerHTML = '<hr><p class="hint">No household members attached to this record.</p>';
                    }
                })
                .catch(err => {
                    const el = document.getElementById('drawer-people');
                    if (el) el.innerHTML = '';
                });
        }

        document.getElementById('drawer').classList.add('show');
        document.getElementById('drawer-backdrop').classList.add('show');
    },

    closeDrawer() {
        document.getElementById('drawer').classList.remove('show');
        document.getElementById('drawer-backdrop').classList.remove('show');
    },

    async saveRecord(e) {
        e.preventDefault();
        const editing = this._editingRecord;
        if (!editing) return;
        const config = this._recordConfigs[editing.table];

        const body = {};
        config.fields.forEach(f => {
            body[f.col] = document.getElementById(`rf-${f.col}`).value;
        });

        try {
            const res = await this.api(
                `/api/admin/records/${editing.table}/${encodeURIComponent(editing.id)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (json.success) {
                this.closeDrawer();
                this.showToast('Record updated successfully');
                this.loadRecords();
            } else {
                this.showToast(json.error || 'Failed to update record', 'error');
            }
        } catch (err) {
            console.error(err);
            this.showToast('Failed to update record', 'error');
        }
    },

    async deleteRecord() {
        const editing = this._editingRecord;
        if (!editing) return;
        const ok = await this.confirmDialog(`Delete this record from ${this._recordTables[editing.table] || editing.table}? This cannot be undone.`);
        if (!ok) return;
        try {
            const res = await this.api(`/api/admin/records/${editing.table}/${encodeURIComponent(editing.id)}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.success) {
                this.closeDrawer();
                this.showToast('Record deleted');
                this.loadRecords();
                this.loadStats();
            } else {
                this.showToast(json.error || 'Failed to delete record', 'error');
            }
        } catch (e) {
            console.error(e);
            this.showToast('Failed to delete record', 'error');
        }
    },

    // ------------------------------------------------------------
    // DATA HUB (export / templates / import)
    // ------------------------------------------------------------
    _exportMeta: [
        { table: 'KitsDistribution', label: 'Kits Distribution', desc: 'Kits + household members', icon: 'fa-box-open', tint: 'blue' },
        { table: 'AwarenessSessions', label: 'Awareness Sessions', desc: 'Sessions + health topics', icon: 'fa-people-group', tint: 'violet' },
        { table: 'MWCounseling', label: 'MW Counseling', desc: 'Counseling + topics', icon: 'fa-clipboard-user', tint: 'amber' },
        { table: 'SRAForm', label: 'SRA Forms', desc: 'Child assessments', icon: 'fa-child-reaching', tint: 'rose' },
    ],

    renderExportGrid() {
        document.getElementById('export-grid').innerHTML = this._exportMeta.map(m => `
            <div class="export-card">
                <div class="export-card-top">
                    <div class="export-icon" style="background:var(--tint-${m.tint}-bg);color:var(--tint-${m.tint}-fg)">
                        <i class="fa-solid ${m.icon}"></i></div>
                    <div><h3>${m.label}</h3><small>${m.desc}</small></div>
                </div>
                <div class="export-card-actions">
                    <button class="btn btn-primary" onclick="app.exportData('${m.table}')"><i class="fa-solid fa-download"></i> Export XLSX</button>
                    <button class="btn btn-outline" onclick="app.downloadTemplate('${m.table}')"><i class="fa-solid fa-file-arrow-down"></i> Template</button>
                    <button class="btn btn-outline" onclick="app.startImport('${m.table}')"><i class="fa-solid fa-file-arrow-up"></i> Import Data</button>
                </div>
            </div>`).join('');
    },

    exportData(table) {
        window.location.href = `${API_BASE_URL}/api/admin/export/${table}?token=${encodeURIComponent(this._token() || '')}`;
        this.showToast(`Downloading ${table}.xlsx...`);
    },

    downloadTemplate(table) {
        window.location.href = `${API_BASE_URL}/api/admin/template/${table}?token=${encodeURIComponent(this._token() || '')}`;
        this.showToast(`Downloading ${table} template...`);
    },

    downloadLookupTemplate() { this.downloadTemplate(this._lookupTable); },
    startLookupImport() { this.startImport(this._lookupTable); },

    startImport(table) {
        this._importTable = table;
        const input = document.getElementById('import-file-input');
        input.value = '';
        input.click();
    },

    async handleImportFile(e) {
        const file = e.target.files[0];
        if (!file || !this._importTable) return;

        const isLookup = this._lookupTables.includes(this._importTable);
        const resultBox = document.getElementById(isLookup ? 'lookup-import-result' : 'import-result');
        resultBox.innerHTML = '<p class="hint"><i class="fa-solid fa-circle-notch fa-spin"></i> Uploading and validating, please wait...</p>';
        this.showToast(`Importing ${file.name}...`);

        try {
            const res = await this.api(`/api/admin/import/${this._importTable}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/octet-stream' },
                body: file,
            });
            const json = await res.json();

            if (json.success) {
                const skipped = json.skipped ? ` (${json.skipped} already existing, skipped)` : '';
                resultBox.innerHTML = `<div class="alert alert-success">
                    <i class="fa-solid fa-circle-check"></i>
                    Imported ${json.imported} record(s) into ${this._importTable} successfully${skipped}.</div>`;
                this.showToast('Import successful');
                this.loadStats();
                if (isLookup) this.loadLookupTable();
            } else {
                const items = (json.errors || ['Unknown error']).slice(0, 25)
                    .map(err => `<li>${err}</li>`).join('');
                const more = (json.errors || []).length > 25
                    ? `<p>...and ${json.errors.length - 25} more error(s).</p>` : '';
                resultBox.innerHTML = `<div class="alert alert-error">
                    <i class="fa-solid fa-circle-xmark"></i>
                    Nothing was imported. Please fix the following and upload again:
                    <ul>${items}</ul>${more}</div>`;
                this.showToast('Import failed — see details below', 'error');
            }
        } catch (err) {
            console.error(err);
            resultBox.innerHTML = '<div class="alert alert-error">Upload failed. Check your connection and try again.</div>';
            this.showToast('Import failed', 'error');
        }
    },

    // ------------------------------------------------------------
    // CONFIRM DIALOG
    // ------------------------------------------------------------
    confirmDialog(message, yesLabel = 'Delete') {
        document.getElementById('confirm-message').innerText = message;
        document.getElementById('confirm-yes').innerText = yesLabel;
        document.getElementById('confirm-modal').classList.add('show');
        return new Promise(resolve => { this._confirmResolve = resolve; });
    },

    resolveConfirm(answer) {
        document.getElementById('confirm-modal').classList.remove('show');
        if (this._confirmResolve) { this._confirmResolve(answer); this._confirmResolve = null; }
    },

    // ------------------------------------------------------------
    // COMMAND PALETTE
    // ------------------------------------------------------------
    _paletteActions() {
        const nav = Object.entries(this._titles).map(([tab, label]) => ({
            icon: 'fa-location-arrow', label: `Go to ${label}`, hint: 'Navigate',
            run: () => this.navigate(tab),
        }));
        const data = this._exportMeta.flatMap(m => ([
            { icon: 'fa-download', label: `Export ${m.label}`, hint: 'XLSX', run: () => this.exportData(m.table) },
            { icon: 'fa-file-arrow-down', label: `Download ${m.label} template`, hint: 'XLSX', run: () => this.downloadTemplate(m.table) },
            { icon: 'fa-file-arrow-up', label: `Import ${m.label}`, hint: 'Upload', run: () => this.startImport(m.table) },
        ]));
        return [
            ...nav,
            { icon: 'fa-user-plus', label: 'Add new user', hint: 'Users', run: () => { this.navigate('users'); this.showUserModal(); } },
            { icon: 'fa-plus', label: 'Add lookup record', hint: 'Lookups', run: () => { this.navigate('lookups'); this.showLookupModal(); } },
            { icon: 'fa-rotate', label: 'Refresh dashboard', hint: 'Dashboard', run: () => { this.navigate('dashboard'); this.loadDashboard(true); } },
            { icon: 'fa-circle-half-stroke', label: 'Toggle dark / light theme', hint: 'Theme', run: () => this.toggleTheme() },
            { icon: 'fa-right-from-bracket', label: 'Sign out', hint: 'Session', run: () => this.logout() },
            ...data,
        ];
    },

    openPalette() {
        document.getElementById('palette').classList.add('show');
        const input = document.getElementById('palette-input');
        input.value = '';
        this.renderPalette();
        setTimeout(() => input.focus(), 50);
    },

    closePalette() {
        document.getElementById('palette').classList.remove('show');
    },

    renderPalette() {
        const q = (document.getElementById('palette-input').value || '').trim().toLowerCase();
        this._paletteFiltered = this._paletteActions().filter(a => !q || a.label.toLowerCase().includes(q));
        const list = document.getElementById('palette-list');
        if (this._paletteFiltered.length === 0) {
            list.innerHTML = '<div class="palette-empty">No matching commands.</div>';
            return;
        }
        list.innerHTML = this._paletteFiltered.map((a, i) => `
            <li data-idx="${i}" class="${i === 0 ? 'selected' : ''}" onclick="app.runPaletteAction(${i})">
                <i class="fa-solid ${a.icon}"></i> ${a.label} <small>${a.hint}</small>
            </li>`).join('');
    },

    runPaletteAction(i) {
        const action = this._paletteFiltered[i];
        this.closePalette();
        if (action) action.run();
    },

    // ------------------------------------------------------------
    // UTILS
    // ------------------------------------------------------------
    closeModals() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
        if (this._confirmResolve) { this._confirmResolve(false); this._confirmResolve = null; }
    },

    showToast(msg, type = 'success') {
        const stack = document.getElementById('toast-stack');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icon = type === 'error' ? 'fa-circle-xmark' : 'fa-circle-check';
        toast.innerHTML = `<i class="fa-solid ${icon}"></i><span></span>`;
        toast.querySelector('span').innerText = msg;
        stack.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('leaving');
            setTimeout(() => toast.remove(), 350);
        }, 3200);
    },
};

window.app = App;
document.addEventListener('DOMContentLoaded', () => App.init());
