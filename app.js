const API_BASE_URL = 'https://aims-progress-invest-output.trycloudflare.com';

const App = {
    init() {
        this.bindEvents();
        this.loadStats();
        // Set first tab active
        document.querySelector('.nav-links li').click();
    },

    bindEvents() {
        // Tab switching
        document.querySelectorAll('.nav-links li').forEach(item => {
            item.addEventListener('click', (e) => {
                // Remove active from all
                document.querySelectorAll('.nav-links li').forEach(i => i.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                // Add active to current
                e.currentTarget.classList.add('active');
                const tabId = e.currentTarget.getAttribute('data-tab');
                document.getElementById(tabId).classList.add('active');
                
                // Update page title
                document.getElementById('page-title').innerText = e.currentTarget.innerText;
                
                // Load tab data if needed
                if (tabId === 'users') this.loadUsers();
                if (tabId === 'lookups') this.loadLookupTable();
            });
        });
    },

    async loadStats() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/stats`);
            const json = await res.json();
            
            if (json.success) {
                const container = document.getElementById('stats-container');
                container.innerHTML = '';
                
                const labels = {
                    'KitsDistribution': 'Kits Distributed',
                    'AwarenessSessions': 'Awareness Sessions',
                    'MWCounseling': 'MW Counseling',
                    'SRAForm': 'SRA Forms',
                    'Users': 'System Users'
                };
                
                for (const [table, count] of Object.entries(json.stats)) {
                    container.innerHTML += `
                        <div class="stat-card">
                            <div class="stat-value">${count}</div>
                            <div class="stat-label">${labels[table] || table}</div>
                        </div>
                    `;
                }
            }
        } catch (e) {
            console.error(e);
            document.getElementById('stats-container').innerHTML = '<div class="text-danger">Failed to load stats</div>';
        }
    },

    // --- USERS ---
    async loadUsers() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/users`);
            const json = await res.json();
            
            const tbody = document.getElementById('users-table-body');
            tbody.innerHTML = '';
            
            if (json.success && json.data.length > 0) {
                json.data.forEach(user => {
                    tbody.innerHTML += `
                        <tr>
                            <td>${user.Username}</td>
                            <td><span style="background: rgba(0, 229, 255, 0.2); color: var(--accent); padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">${user.Role || 'FieldWorker'}</span></td>
                            <td>
                                <button class="btn btn-danger" onclick="app.deleteUser('${user.Username}')">Delete</button>
                            </td>
                        </tr>
                    `;
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="3" class="text-center">No users found.</td></tr>';
            }
        } catch (e) {
            console.error(e);
        }
    },

    showUserModal() {
        document.getElementById('user-modal').classList.add('show');
        document.getElementById('user-username').value = '';
        document.getElementById('user-password').value = '';
    },

    async saveUser(e) {
        e.preventDefault();
        const username = document.getElementById('user-username').value;
        const password = document.getElementById('user-password').value;
        const role = document.getElementById('user-role').value;
        
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, role })
            });
            const json = await res.json();
            
            if (json.success) {
                this.closeModals();
                this.showToast('User saved successfully');
                this.loadUsers();
            } else {
                this.showToast(json.error || 'Failed to save user');
            }
        } catch (err) {
            console.error(err);
        }
    },

    async deleteUser(username) {
        if (!confirm(`Are you sure you want to delete user ${username}?`)) return;
        
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/users/${username}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.success) {
                this.showToast('User deleted');
                this.loadUsers();
            }
        } catch (e) { console.error(e); }
    },

    // --- LOOKUPS ---
    async loadLookupTable() {
        const table = document.getElementById('lookup-table-select').value;
        
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/lookups/${table}`);
            const json = await res.json();
            
            const tbody = document.getElementById('lookups-table-body');
            tbody.innerHTML = '';
            
            if (json.success && json.data.length > 0) {
                // Determine column names dynamically based on first record
                const keys = Object.keys(json.data[0]);
                const idCol = keys[0];
                const nameCol = keys[1] || keys[0]; // Fallback if only 1 column
                
                // Update table head
                document.getElementById('lookups-table-head').innerHTML = `
                    <th>${idCol}</th>
                    <th>${nameCol}</th>
                    <th>Actions</th>
                `;
                
                json.data.forEach(row => {
                    tbody.innerHTML += `
                        <tr>
                            <td>${row[idCol]}</td>
                            <td>${row[nameCol]}</td>
                            <td>
                                <button class="btn btn-danger" onclick="app.deleteLookup('${table}', '${row[idCol]}')">Delete</button>
                            </td>
                        </tr>
                    `;
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="3" class="text-center">No records found.</td></tr>';
            }
        } catch (e) {
            console.error(e);
        }
    },

    showLookupModal() {
        const table = document.getElementById('lookup-table-select').value;
        document.getElementById('lookup-modal-title').innerText = `Add ${table}`;
        document.getElementById('lookup-modal').classList.add('show');
        document.getElementById('lookup-name').value = '';
    },

    async saveLookup(e) {
        e.preventDefault();
        const table = document.getElementById('lookup-table-select').value;
        const name = document.getElementById('lookup-name').value;

        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/lookups/${table}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const json = await res.json();
            
            if (json.success) {
                this.closeModals();
                this.showToast('Record saved successfully');
                this.loadLookupTable();
            } else {
                this.showToast(json.error || 'Failed to save record');
            }
        } catch (err) {
            console.error(err);
        }
    },

    async deleteLookup(table, id) {
        if (!confirm(`Delete record ${id} from ${table}?`)) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/lookups/${table}/${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.success) {
                this.showToast('Record deleted');
                this.loadLookupTable();
            }
        } catch (e) { console.error(e); }
    },

    // --- DATA EXPORT ---
    exportData(table) {
        window.location.href = `${API_BASE_URL}/api/admin/export/${table}`;
        this.showToast(`Downloading ${table}.xlsx...`);
    },

    // --- UTILS ---
    closeModals() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
    },

    showToast(msg) {
        const toast = document.getElementById('toast');
        toast.innerText = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
};

window.app = App;
document.addEventListener('DOMContentLoaded', () => App.init());
