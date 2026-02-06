// Game State Engine - Central state management
const GameState = {
    // Core state
    week: 1,
    phase: "planning", // "planning" or "battle"
    clans: {},          // clanId -> clan object
    provinces: {},      // provinceId -> { owner, armies: { clanId: count } }
    orders: [],         // pending movement orders
    battles: [],        // pending battles to resolve
    alliances: [],      // { clan1, clan2 }
    allianceRequests: [],// { from, to, timestamp }
    history: [],        // event log
    selectedClan: null, // currently selected clan for play

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
    STATE_VERSION: 2,

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
        this.clans = {};
        this.provinces = {};
        this.orders = [];
        this.battles = [];
        this.alliances = [];
        this.allianceRequests = [];
        this.history = [];

        // Initialize clans
        DEFAULT_CLANS.forEach(c => {
            this.clans[c.id] = {
                id: c.id,
                name: c.name,
                japaneseName: c.japaneseName,
                color: c.color,
                rallyCap: c.rallyCap,
                homeProvince: c.homeProvince,
                totalTroops: 500
            };
        });

        // Initialize provinces
        PROVINCES.forEach(p => {
            this.provinces[p.id] = {
                owner: null,
                armies: {}
            };
        });

        // Place starting armies
        DEFAULT_CLANS.forEach(c => {
            if (this.provinces[c.homeProvince]) {
                this.provinces[c.homeProvince].owner = c.id;
                this.provinces[c.homeProvince].armies[c.id] = 500;
            }
        });

        this.addHistory("system", `Game initialized. Week 1, Planning Phase begins.`);
        this.save();
    },

    // Save to localStorage
    save() {
        const state = {
            stateVersion: this.STATE_VERSION,
            week: this.week,
            phase: this.phase,
            clans: this.clans,
            provinces: this.provinces,
            orders: this.orders,
            battles: this.battles,
            alliances: this.alliances,
            allianceRequests: this.allianceRequests,
            history: this.history,
            selectedClan: this.selectedClan
        };
        localStorage.setItem("shogunate_state", JSON.stringify(state));
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

    // Get all allies of a clan
    getAllies(clanId) {
        return this.alliances
            .filter(a => a.clan1 === clanId || a.clan2 === clanId)
            .map(a => a.clan1 === clanId ? a.clan2 : a.clan1);
    },

    // Reset game
    reset() {
        localStorage.removeItem("shogunate_state");
        this.initFresh();
    }
};
