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
                if (tabId === 'records') this.loadRecords();
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
                this._usersData = json.data;
                json.data.forEach((user, i) => {
                    tbody.innerHTML += `
                        <tr>
                            <td>${user.Username}</td>
                            <td><span style="background: rgba(0, 229, 255, 0.2); color: var(--accent); padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">${user.Role || 'FieldWorker'}</span></td>
                            <td>
                                <button class="btn btn-outline" onclick="app.editUser(${i})">Edit</button>
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
        this._editingUser = null;
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
            ? `${API_BASE_URL}/api/admin/users/${encodeURIComponent(this._editingUser)}`
            : `${API_BASE_URL}/api/admin/users`;

        try {
            const res = await fetch(url, {
                method: editing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editing ? { password, role } : { username, password, role })
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
                this._lookupRows = { idCol, nameCol, data: json.data };

                // Update table head
                document.getElementById('lookups-table-head').innerHTML = `
                    <th>${idCol}</th>
                    <th>${nameCol}</th>
                    <th>Actions</th>
                `;

                json.data.forEach((row, i) => {
                    tbody.innerHTML += `
                        <tr>
                            <td>${row[idCol]}</td>
                            <td>${row[nameCol]}</td>
                            <td>
                                <button class="btn btn-outline" onclick="app.editLookup(${i})">Edit</button>
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
        this._editingLookupId = null;
        const table = document.getElementById('lookup-table-select').value;
        document.getElementById('lookup-modal-title').innerText = `Add ${table}`;
        document.getElementById('lookup-modal').classList.add('show');
        document.getElementById('lookup-name').value = '';
    },

    editLookup(index) {
        const rows = this._lookupRows;
        if (!rows || !rows.data[index]) return;
        const row = rows.data[index];
        const table = document.getElementById('lookup-table-select').value;
        this._editingLookupId = row[rows.idCol];
        document.getElementById('lookup-modal-title').innerText = `Edit ${table}`;
        document.getElementById('lookup-modal').classList.add('show');
        document.getElementById('lookup-name').value = row[rows.nameCol] || '';
    },

    async saveLookup(e) {
        e.preventDefault();
        const table = document.getElementById('lookup-table-select').value;
        const name = document.getElementById('lookup-name').value;

        const editingId = this._editingLookupId;
        const url = editingId
            ? `${API_BASE_URL}/api/admin/lookups/${table}/${encodeURIComponent(editingId)}`
            : `${API_BASE_URL}/api/admin/lookups/${table}`;

        try {
            const res = await fetch(url, {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const json = await res.json();
            
            if (json.success) {
                this.closeModals();
                this._lookupCache = null; // names changed; records tab will refetch
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

    // --- RECORDS BROWSING & EDITING ---
    // Field metadata per table: how to render the list and the edit form.
    // 'lookup' values reference the /api/sync/lookups response keys.
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
            if (field.type === 'yesno') return value == 1 ? 'Yes' : 'No';
            if (field.type === 'lookup') return this._lookupNameById[value] || value;
        }
        // Non-editable reference columns (e.g. DistributionID): shorten UUIDs
        const s = String(value);
        return /^[0-9a-f-]{36}$/i.test(s) ? s.slice(0, 8) + '…' : s;
    },

    async loadRecords() {
        const table = document.getElementById('record-table-select').value;
        const tbody = document.getElementById('records-table-body');
        tbody.innerHTML = '<tr><td class="text-center">Loading...</td></tr>';

        try {
            await this._ensureLookupCache();
            const res = await fetch(`${API_BASE_URL}/api/admin/records/${table}`);
            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Failed to load records');
            this._records = { table, idCol: json.idCol, data: json.data };
            this.renderRecords();
        } catch (e) {
            console.error(e);
            tbody.innerHTML = '<tr><td class="text-center text-danger">Failed to load records.</td></tr>';
        }
    },

    renderRecords() {
        const records = this._records;
        if (!records) return;
        const config = this._recordConfigs[records.table];
        const search = (document.getElementById('record-search').value || '').trim().toLowerCase();

        document.getElementById('records-table-head').innerHTML =
            config.display.map(col => {
                const field = this._fieldFor(records.table, col);
                return `<th>${field ? field.label : col}</th>`;
            }).join('') + '<th>Actions</th>';

        const tbody = document.getElementById('records-table-body');
        const rowsHtml = [];
        records.data.forEach((row, i) => {
            const cells = config.display.map(col => this._displayValue(records.table, col, row[col]));
            if (search && !cells.some(c => String(c).toLowerCase().includes(search))) return;
            rowsHtml.push(`<tr>${cells.map(c => `<td>${c}</td>`).join('')}
                <td><button class="btn btn-outline" onclick="app.editRecord(${i})">Edit</button></td></tr>`);
        });

        tbody.innerHTML = rowsHtml.length > 0
            ? rowsHtml.join('')
            : `<tr><td colspan="${config.display.length + 1}" class="text-center">No records found.</td></tr>`;
    },

    editRecord(index) {
        const records = this._records;
        const row = records && records.data[index];
        if (!row) return;
        const table = records.table;
        const config = this._recordConfigs[table];
        this._editingRecord = { table, id: row[records.idCol] };

        document.getElementById('record-modal-title').innerText = `Edit ${table} Record`;
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
            return `<div class="form-group"><label>${f.label}</label>${input}</div>`;
        }).join('');

        // Set values programmatically so Arabic text and quotes are safe
        config.fields.forEach(f => {
            const el = document.getElementById(`rf-${f.col}`);
            const value = row[f.col];
            if (value === null || value === undefined) { el.value = ''; return; }
            if (f.type === 'date') el.value = String(value).slice(0, 10);
            else if (f.type === 'yesno') el.value = String(value);
            else el.value = value;
        });

        document.getElementById('record-modal').classList.add('show');
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
            const res = await fetch(
                `${API_BASE_URL}/api/admin/records/${editing.table}/${encodeURIComponent(editing.id)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const json = await res.json();
            if (json.success) {
                this.closeModals();
                this.showToast('Record updated successfully');
                this.loadRecords();
            } else {
                this.showToast(json.error || 'Failed to update record');
            }
        } catch (err) {
            console.error(err);
            this.showToast('Failed to update record');
        }
    },

    // --- DATA EXPORT ---
    exportData(table) {
        window.location.href = `${API_BASE_URL}/api/admin/export/${table}`;
        this.showToast(`Downloading ${table}.xlsx...`);
    },

    // --- TEMPLATES & IMPORT ---
    _lookupTables: ['Projects', 'Shelters', 'DocumentTypes', 'HealthTopics',
        'KitsTypes', 'TargetCategories', 'CounselingTopics', 'PHCCs', 'Frontliners'],

    downloadTemplate(table) {
        window.location.href = `${API_BASE_URL}/api/admin/template/${table}`;
        this.showToast(`Downloading ${table} template...`);
    },

    downloadLookupTemplate() {
        this.downloadTemplate(document.getElementById('lookup-table-select').value);
    },

    startLookupImport() {
        this.startImport(document.getElementById('lookup-table-select').value);
    },

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
        resultBox.innerHTML = '<p>Uploading and validating, please wait...</p>';
        this.showToast(`Importing ${file.name}...`);

        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/import/${this._importTable}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/octet-stream' },
                body: file
            });
            const json = await res.json();

            if (json.success) {
                const skipped = json.skipped
                    ? ` (${json.skipped} already existing, skipped)` : '';
                resultBox.innerHTML = `<p style="color: #4caf50;">
                    <i class="fa-solid fa-circle-check"></i>
                    Imported ${json.imported} record(s) into ${this._importTable} successfully${skipped}.</p>`;
                this.showToast('Import successful');
                this.loadStats();
                if (isLookup) this.loadLookupTable();
            } else {
                const items = (json.errors || ['Unknown error']).slice(0, 25)
                    .map(err => `<li>${err}</li>`).join('');
                const more = (json.errors || []).length > 25
                    ? `<p>...and ${json.errors.length - 25} more error(s).</p>` : '';
                resultBox.innerHTML = `<div style="color: #ff5252;">
                    <p><i class="fa-solid fa-circle-xmark"></i>
                    Nothing was imported. Please fix the following and upload again:</p>
                    <ul>${items}</ul>${more}</div>`;
                this.showToast('Import failed — see details below');
            }
        } catch (err) {
            console.error(err);
            resultBox.innerHTML = '<p style="color: #ff5252;">Upload failed. Check your connection and try again.</p>';
            this.showToast('Import failed');
        }
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
