// Game State Engine - Central state management
const GameState = {
    // Core state
    week: 1,
    phase: "planning", // "planning" or "battle"
    clans: {},          // clanId -> clan object
    provinces: {},      // provinceId -> { owner, armies: { clanId: count } }
    orders: [],         // pending movement orders
    battles: [],        // pending battles to resolve
    pendingAttacks: [], // armies waiting for a battle to resolve before attacking
    casualties: {},     // clanId -> recovering troop count (blocks levy raising)
    retreatingArmies: [], // armies retreating from lost battles
    alliances: [],      // { clan1, clan2 }
    allianceRequests: [],// { from, to, timestamp }
    dynamicChildren: {},// clanId -> [{ id, name, gender, robloxId }] admin-added children
    protectedProvinces: {}, // provinceId -> clanId — ownership can't change
    deceasedMembers: {},// clanId -> [{ id, name, gender, robloxId, parentId, wasLeader }]
    history: [],        // event log
    selectedClan: null, // currently selected clan for play

    // Server sync state (not persisted)
    _serverVersion: 0,
    _syncInterval: null,
    _pushPending: false,
    _pushTimer: null,

    // Deadline: Thursday 23:59
    getDeadline() {
        const now = new Date();
        const day = now.getDay(); // 0=Sun, 1=Mon...4=Thu
        let daysUntilThursday = (4 - day + 7) % 7;
        if (daysUntilThursday === 0 && now.getHours() >= 23 && now.getMinutes() >= 59) {
            daysUntilThursday = 7;
        }
        if (daysUntilThursday === 0) daysUntilThursday = 0; // today is thursday
        const deadline = new Date(now);
        deadline.setDate(deadline.getDate() + daysUntilThursday);
        deadline.setHours(23, 59, 0, 0);
        return deadline;
    },

    // State version - increment when province/map data changes to force reset
    STATE_VERSION: 7,

    // Initialize game
    init() {
        // Try to load saved state
        const saved = localStorage.getItem("shogunate_state");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.stateVersion === this.STATE_VERSION) {
                    Object.assign(this, parsed);
                    return;
                }
                console.warn("State version mismatch, reinitializing");
            } catch (e) {
                console.warn("Failed to load saved state, initializing fresh");
            }
        }
        this.initFresh();
    },

    initFresh() {
        this.week = 1;
        this.phase = "planning";
        this.clans = {};  // Populated by API.loadClansFromDB()
        this.provinces = {};
        this.orders = [];
        this.battles = [];
        this.pendingAttacks = [];
        this.casualties = {};
        this.retreatingArmies = [];
        this.alliances = [];
        this.allianceRequests = [];
        this.dynamicChildren = {};
        this.protectedProvinces = {};
        this.deceasedMembers = {};
        this.history = [];

        // Initialize provinces (structure only - ownership set by admin)
        PROVINCES.forEach(p => {
            this.provinces[p.id] = {
                owner: null,
                armies: {}
            };
        });

        this.addHistory("system", `Game initialized. Week 1, Planning Phase begins.`);
        this.save();
    },

    // Save to localStorage + push to server
    save() {
        const state = {
            stateVersion: this.STATE_VERSION,
            week: this.week,
            phase: this.phase,
            clans: this.clans,
            provinces: this.provinces,
            orders: this.orders,
            battles: this.battles,
            pendingAttacks: this.pendingAttacks,
            casualties: this.casualties,
            retreatingArmies: this.retreatingArmies,
            alliances: this.alliances,
            allianceRequests: this.allianceRequests,
            dynamicChildren: this.dynamicChildren,
            protectedProvinces: this.protectedProvinces,
            deceasedMembers: this.deceasedMembers,
            history: this.history,
            selectedClan: this.selectedClan
        };
        localStorage.setItem("shogunate_state", JSON.stringify(state));

        // Push shared state to server (debounced, non-blocking)
        this._pushToServer();
    },

    // Shared state — everything synced across all users
    // Excludes per-user selectedClan and DB-driven clans
    _getSharedState() {
        return {
            week: this.week,
            phase: this.phase,
            provinces: this.provinces,
            orders: this.orders,
            battles: this.battles,
            pendingAttacks: this.pendingAttacks,
            casualties: this.casualties,
            retreatingArmies: this.retreatingArmies,
            alliances: this.alliances,
            allianceRequests: this.allianceRequests,
            dynamicChildren: this.dynamicChildren,
            protectedProvinces: this.protectedProvinces,
            deceasedMembers: this.deceasedMembers,
            history: this.history,
        };
    },

    // Debounced push to server (500ms after last save)
    _pushToServer() {
        if (!API.enabled) return;
        if (this._pushTimer) clearTimeout(this._pushTimer);
        this._pushTimer = setTimeout(async () => {
            if (this._pushPending) return;
            this._pushPending = true;
            try {
                const result = await API.saveGameState(this._getSharedState());
                if (result && result.version) {
                    this._serverVersion = result.version;
                }
            } catch (err) {
                console.warn("[GameState] Failed to push to server:", err.message);
            } finally {
                this._pushPending = false;
            }
        }, 500);
    },

    // Load game state from server (called on startup)
    async loadFromServer() {
        if (!API.enabled) return false;
        try {
            const data = await API.getGameState();
            if (!data || !data.state || !data.state.provinces) return false;
            this._applyServerState(data.state, data.version);
            console.log("[GameState] Loaded from server, version:", data.version);
            return true;
        } catch (err) {
            console.warn("[GameState] Failed to load from server:", err.message);
            return false;
        }
    },

    // Apply server state while preserving per-user values
    _applyServerState(serverState, version) {
        const savedClan = this.selectedClan;

        this.week = serverState.week ?? this.week;
        this.phase = serverState.phase ?? this.phase;
        this.provinces = serverState.provinces || this.provinces;
        this.orders = serverState.orders || [];
        this.battles = serverState.battles || [];
        this.pendingAttacks = serverState.pendingAttacks || [];
        this.casualties = serverState.casualties || {};
        this.retreatingArmies = serverState.retreatingArmies || [];
        this.alliances = serverState.alliances || [];
        this.allianceRequests = serverState.allianceRequests || [];
        this.dynamicChildren = serverState.dynamicChildren || {};
        this.protectedProvinces = serverState.protectedProvinces || {};
        this.deceasedMembers = serverState.deceasedMembers || {};
        this.history = serverState.history || [];

        // Restore per-user values
        this.selectedClan = savedClan;
        this._serverVersion = version;

        // Update localStorage (without re-pushing to server)
        const state = {
            stateVersion: this.STATE_VERSION,
            week: this.week,
            phase: this.phase,
            clans: this.clans,
            provinces: this.provinces,
            orders: this.orders,
            battles: this.battles,
            pendingAttacks: this.pendingAttacks,
            casualties: this.casualties,
            retreatingArmies: this.retreatingArmies,
            alliances: this.alliances,
            allianceRequests: this.allianceRequests,
            dynamicChildren: this.dynamicChildren,
            protectedProvinces: this.protectedProvinces,
            deceasedMembers: this.deceasedMembers,
            history: this.history,
            selectedClan: this.selectedClan,
        };
        localStorage.setItem("shogunate_state", JSON.stringify(state));
    },

    // Start polling for state updates from server
    startSync(intervalMs) {
        if (this._syncInterval) clearInterval(this._syncInterval);
        const ms = intervalMs || 30000;
        this._syncInterval = setInterval(async () => {
            if (!API.enabled || this._pushPending) return;
            try {
                const data = await API.getGameState();
                if (!data || !data.version) return;
                if (data.version > this._serverVersion && data.state && data.state.provinces) {
                    this._applyServerState(data.state, data.version);
                    MapRenderer.update();
                    App.updateUI();
                    console.log("[GameState] Synced from server, version:", data.version);
                }
            } catch (err) {
                // Silently fail on poll errors
            }
        }, ms);
    },

    stopSync() {
        if (this._syncInterval) {
            clearInterval(this._syncInterval);
            this._syncInterval = null;
        }
    },

    // Add history entry
    addHistory(type, message, details) {
        this.history.unshift({
            id: Date.now() + Math.random(),
            type, // "battle", "move", "diplomacy", "system"
            message,
            details: details || null,
            week: this.week,
            phase: this.phase,
            timestamp: new Date().toISOString()
        });
        // Keep only last 500 entries
        if (this.history.length > 500) this.history.length = 500;
    },

    // Get clan info
    getClan(clanId) {
        return this.clans[clanId] || null;
    },

    // Get all provinces owned by a clan
    getOwnedProvinces(clanId) {
        return Object.entries(this.provinces)
            .filter(([, prov]) => prov.owner === clanId)
            .map(([id]) => id);
    },

    // Get total troops for a clan across all provinces
    getTotalTroops(clanId) {
        let total = 0;
        Object.values(this.provinces).forEach(prov => {
            if (prov.armies[clanId]) total += prov.armies[clanId];
        });
        return total;
    },

    // Get troops committed to orders
    getCommittedTroops(clanId) {
        return this.orders
            .filter(o => o.clanId === clanId && o.status === "committed")
            .reduce((sum, o) => sum + o.troops, 0);
    },

    // Check if two clans are allied
    areAllied(clan1, clan2) {
        return this.alliances.some(a =>
            (a.clan1 === clan1 && a.clan2 === clan2) ||
            (a.clan1 === clan2 && a.clan2 === clan1)
        );
    },

    // Get all unique allied clan IDs
    getAllies(clanId) {
        const allies = this.alliances
            .filter(a => a.clan1 === clanId || a.clan2 === clanId)
            .map(a => a.clan1 === clanId ? a.clan2 : a.clan1);
        return [...new Set(allies)];
    },

    // Get all alliances between two clans (may be multiple)
    getAlliancesBetween(clan1, clan2) {
        return this.alliances.filter(a =>
            (a.clan1 === clan1 && a.clan2 === clan2) ||
            (a.clan1 === clan2 && a.clan2 === clan1)
        );
    },

    // Get full family for a clan (static CLAN_FAMILIES + dynamic children)
    getFamily(clanId) {
        const staticFamily = CLAN_FAMILIES[clanId];
        if (!staticFamily) return null;
        const dynamic = this.dynamicChildren[clanId] || [];
        return {
            leader: staticFamily.leader,
            children: [...staticFamily.children, ...dynamic]
        };
    },

    // Check if a province is protected (Imperial Court, etc.)
    isProtectedProvince(provinceId) {
        return !!this.protectedProvinces[provinceId];
    },

    // Get the permanent owner of a protected province
    getProtectedOwner(provinceId) {
        return this.protectedProvinces[provinceId] || null;
    },

    // Reset game
    reset() {
        localStorage.removeItem("shogunate_state");
        this.initFresh();
    }
};
