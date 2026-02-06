// Dashboard - Clan stats, allies, orders overview
const Dashboard = {
    init() {
        document.getElementById("btn-dashboard").addEventListener("click", () => {
            this.toggle();
        });

        document.querySelector("#dashboard-panel .overlay-close").addEventListener("click", () => {
            document.getElementById("dashboard-panel").classList.add("hidden");
        });
    },

    toggle() {
        const panel = document.getElementById("dashboard-panel");
        panel.classList.toggle("hidden");
        if (!panel.classList.contains("hidden")) {
            this.render();
        }
    },

    render() {
        const clanId = GameState.selectedClan;
        if (!clanId) {
            document.getElementById("dash-clan-info").innerHTML =
                '<div class="empty-state">Select a clan to view dashboard</div>';
            return;
        }

        const clan = GameState.getClan(clanId);
        const ownedProvinces = GameState.getOwnedProvinces(clanId);
        const totalTroops = GameState.getTotalTroops(clanId);
        const allies = GameState.getAllies(clanId);
        const orders = MoveSystem.getOrders(clanId);
        const pendingRequests = Diplomacy.getPendingRequests(clanId);
        const sentRequests = Diplomacy.getSentRequests(clanId);

        // Clan Info
        document.getElementById("dash-clan-info").innerHTML = `
            <div class="dash-header" style="border-color: ${clan.color}">
                <h3 style="color: ${clan.color}">${clan.japaneseName} ${clan.name}</h3>
            </div>
        `;

        // Stats
        document.getElementById("dash-stats").innerHTML = `
            <div class="dash-stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${ownedProvinces.length}</div>
                    <div class="stat-label">Provinces</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${totalTroops.toLocaleString()}</div>
                    <div class="stat-label">Soldiers <span class="player-equiv">(${totalTroops / TROOP_RATIO} men)</span></div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${clan.rallyCap.toLocaleString()}</div>
                    <div class="stat-label">Rally Cap <span class="player-equiv">(${clan.rallyCap / TROOP_RATIO} men)</span></div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${allies.length}</div>
                    <div class="stat-label">Allies</div>
                </div>
            </div>
            <div class="rally-bar">
                <div class="rally-fill" style="width: ${Math.min(100, (totalTroops / clan.rallyCap) * 100)}%"></div>
                <span class="rally-text">${totalTroops.toLocaleString()} / ${clan.rallyCap.toLocaleString()} soldiers (${totalTroops / TROOP_RATIO} / ${clan.rallyCap / TROOP_RATIO} men)</span>
            </div>
        `;

        // Allies
        document.getElementById("dash-allies").innerHTML = `
            <h3>Allies</h3>
            ${allies.length === 0 ? '<div class="empty-state">No allies</div>' :
            allies.map(aId => {
                const ally = GameState.getClan(aId);
                return `
                    <div class="ally-entry" style="border-left: 3px solid ${ally.color}">
                        <span>${ally.japaneseName} ${ally.name}</span>
                        <button class="small-btn danger" onclick="Dashboard.breakAlliance('${clanId}', '${aId}')">
                            Break Alliance
                        </button>
                    </div>
                `;
            }).join("")}
            <button class="action-btn" onclick="Dashboard.showAllianceModal()">
                Request Alliance
            </button>
        `;

        // Pending requests
        document.getElementById("dash-pending-requests").innerHTML = `
            <h3>Alliance Requests</h3>
            ${pendingRequests.length === 0 && sentRequests.length === 0 ?
            '<div class="empty-state">No pending requests</div>' : ''}
            ${pendingRequests.map(r => {
                const fromClan = GameState.getClan(r.from);
                return `
                    <div class="request-entry pulse-border" style="border-left: 3px solid ${fromClan.color}">
                        <span>${fromClan.name} wants to ally</span>
                        <div>
                            <button class="small-btn commit" onclick="Dashboard.acceptAlliance('${r.id}')">Accept</button>
                            <button class="small-btn cancel" onclick="Dashboard.rejectAlliance('${r.id}')">Reject</button>
                        </div>
                    </div>
                `;
            }).join("")}
            ${sentRequests.map(r => {
                const toClan = GameState.getClan(r.to);
                return `
                    <div class="request-entry sent">
                        <span>Sent to ${toClan.name}</span>
                        <span class="status-pending">Pending...</span>
                    </div>
                `;
            }).join("")}
        `;

        // Orders
        document.getElementById("dash-orders").innerHTML = `
            <h3>Orders (Week ${GameState.week})</h3>
            ${orders.length === 0 ? '<div class="empty-state">No orders this turn</div>' :
            orders.map(o => {
                const from = PROVINCE_MAP[o.fromProvince];
                const to = PROVINCE_MAP[o.toProvince];
                return `
                    <div class="order-entry ${o.status}">
                        <span>${o.troops.toLocaleString()} soldiers <span class="player-equiv">(${o.troops / TROOP_RATIO} men)</span>: ${from.name} → ${to.name}</span>
                        <span class="order-status ${o.status}">${o.status}</span>
                    </div>
                `;
            }).join("")}
        `;
    },

    showAllianceModal() {
        const clanId = GameState.selectedClan;
        if (!clanId) return;

        const modal = document.getElementById("alliance-modal");
        const select = document.getElementById("alliance-target-clan");

        // Show clans that aren't already allied and don't have pending requests
        const allies = GameState.getAllies(clanId);
        const options = Object.values(GameState.clans)
            .filter(c => c.id !== clanId && !allies.includes(c.id))
            .map(c => `<option value="${c.id}">${c.japaneseName} ${c.name}</option>`)
            .join("");

        select.innerHTML = options;
        modal.classList.remove("hidden");

        document.getElementById("alliance-send").onclick = () => {
            const targetId = select.value;
            if (!targetId) return;
            const result = Diplomacy.requestAlliance(clanId, targetId);
            if (result.success) {
                Notifications.show("Alliance request sent!", "success");
                this.render();
            } else {
                Notifications.show(result.error, "error");
            }
            modal.classList.add("hidden");
        };

        document.getElementById("alliance-cancel").onclick = () => {
            modal.classList.add("hidden");
        };
    },

    acceptAlliance(requestId) {
        const result = Diplomacy.acceptAlliance(requestId);
        if (result.success) {
            this.render();
        } else {
            Notifications.show(result.error, "error");
        }
    },

    rejectAlliance(requestId) {
        const result = Diplomacy.rejectAlliance(requestId);
        if (result.success) {
            this.render();
        } else {
            Notifications.show(result.error, "error");
        }
    },

    breakAlliance(clan1, clan2) {
        if (!confirm("Break alliance? This cannot be undone.")) return;
        const result = Diplomacy.breakAlliance(clan1, clan2);
        if (result.success) {
            this.render();
        }
    }
};

// History Log
const HistoryLog = {
    currentFilter: "all",

    init() {
        document.getElementById("btn-history").addEventListener("click", () => {
            this.toggle();
        });

        document.querySelector("#history-panel .overlay-close").addEventListener("click", () => {
            document.getElementById("history-panel").classList.add("hidden");
        });

        // Filter buttons
        document.querySelectorAll("#history-filters .filter-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll("#history-filters .filter-btn").forEach(b =>
                    b.classList.remove("active"));
                btn.classList.add("active");
                this.currentFilter = btn.dataset.filter;
                this.render();
            });
        });
    },

    toggle() {
        const panel = document.getElementById("history-panel");
        panel.classList.toggle("hidden");
        if (!panel.classList.contains("hidden")) {
            this.render();
        }
    },

    render() {
        const list = document.getElementById("history-list");
        let entries = GameState.history;

        if (this.currentFilter !== "all") {
            entries = entries.filter(e => e.type === this.currentFilter);
        }

        if (entries.length === 0) {
            list.innerHTML = '<div class="empty-state">No events yet</div>';
            return;
        }

        list.innerHTML = entries.slice(0, 100).map(entry => {
            const icons = { battle: "\u2694\uFE0F", move: "\u{1F3C3}", diplomacy: "\u{1F91D}", system: "\u{1F4DC}" };
            const time = new Date(entry.timestamp).toLocaleString();
            return `
                <div class="history-entry type-${entry.type}">
                    <span class="history-icon">${icons[entry.type] || "\u{1F4DC}"}</span>
                    <div class="history-content">
                        <div class="history-message">${entry.message}</div>
                        <div class="history-meta">Week ${entry.week} - ${entry.phase} - ${time}</div>
                    </div>
                </div>
            `;
        }).join("");
    }
};
