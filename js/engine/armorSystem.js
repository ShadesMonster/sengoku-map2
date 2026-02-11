// ArmorSystem - manages equipped armor, presets, gamepass, persistence
// Saves per-clan armor loadouts to localStorage (survives death, rejoin, etc.)

const ARMOR_STORAGE_KEY = "sengoku_armor_v1";

const ArmorSystem = {
    // { clanId: { kabuto: "kabuto_jingasa", menpo: "menpo_none", ... } }
    loadouts: {},

    // { clanId: true/false } - who has the mix-and-match gamepass
    gamepasses: {},

    // { clanId: 0-4 } - rank per clan
    ranks: {},

    init() {
        this.load();
    },

    // ---- Persistence ----

    load() {
        try {
            const raw = localStorage.getItem(ARMOR_STORAGE_KEY);
            if (raw) {
                const data = JSON.parse(raw);
                this.loadouts = data.loadouts || {};
                this.gamepasses = data.gamepasses || {};
                this.ranks = data.ranks || {};
            }
        } catch (e) {
            console.warn("ArmorSystem: failed to load saved data", e);
        }
    },

    save() {
        try {
            localStorage.setItem(ARMOR_STORAGE_KEY, JSON.stringify({
                loadouts: this.loadouts,
                gamepasses: this.gamepasses,
                ranks: this.ranks,
            }));
        } catch (e) {
            console.warn("ArmorSystem: failed to save", e);
        }
    },

    // ---- Rank ----

    getRank(clanId) {
        return this.ranks[clanId] || 0;
    },

    setRank(clanId, rank) {
        this.ranks[clanId] = Math.max(0, Math.min(ARMOR_RANKS.length - 1, rank));
        this.save();
    },

    // ---- Gamepass ----

    hasGamepass(clanId) {
        return !!this.gamepasses[clanId];
    },

    setGamepass(clanId, enabled) {
        this.gamepasses[clanId] = !!enabled;
        this.save();
    },

    // ---- Loadout ----

    getLoadout(clanId) {
        if (!this.loadouts[clanId]) {
            // Initialize with rank preset
            this.loadouts[clanId] = this.getPreset(this.getRank(clanId));
        }
        return { ...this.loadouts[clanId] };
    },

    getPreset(rank) {
        const preset = ARMOR_PRESETS[rank] || ARMOR_PRESETS[0];
        return { ...preset };
    },

    applyPreset(clanId) {
        const rank = this.getRank(clanId);
        this.loadouts[clanId] = this.getPreset(rank);
        this.save();
        return this.loadouts[clanId];
    },

    // Equip an item into a slot
    equipItem(clanId, slotKey, itemId) {
        const item = ARMOR_ITEM_MAP[itemId];
        if (!item) return { success: false, error: "Unknown item" };

        // "None" items are always allowed
        if (!itemId.endsWith("_none")) {
            // Check rank requirement
            const rank = this.getRank(clanId);
            if (item.rank > rank) {
                return { success: false, error: `Requires rank: ${ARMOR_RANKS[item.rank].name}` };
            }

            // Without gamepass, can only use preset items for current rank
            if (!this.hasGamepass(clanId)) {
                const preset = this.getPreset(rank);
                if (preset[slotKey] !== itemId) {
                    return { success: false, error: "Requires Armor Gamepass to mix and match" };
                }
            }
        }

        if (!this.loadouts[clanId]) {
            this.loadouts[clanId] = this.getPreset(this.getRank(clanId));
        }
        this.loadouts[clanId][slotKey] = itemId;
        this.save();
        return { success: true };
    },

    // Get all items available for a slot given clan's rank + gamepass
    getAvailableItems(clanId, slotKey) {
        const items = ARMOR_ITEMS[slotKey] || [];
        const rank = this.getRank(clanId);
        const hasGP = this.hasGamepass(clanId);
        const preset = this.getPreset(rank);

        return items.map(item => {
            const isNone = item.id.endsWith("_none");
            const meetsRank = item.rank <= rank;
            const isPreset = preset[slotKey] === item.id;

            let available = true;
            let reason = null;

            if (!isNone && !meetsRank) {
                available = false;
                reason = `Requires ${ARMOR_RANKS[item.rank].name} rank`;
            } else if (!isNone && !hasGP && !isPreset) {
                available = false;
                reason = "Requires Armor Gamepass";
            }

            return { ...item, available, reason, isPreset };
        });
    },

    // Get summary of equipped items with details
    getLoadoutSummary(clanId) {
        const loadout = this.getLoadout(clanId);
        const summary = [];
        for (const [slotKey, itemId] of Object.entries(loadout)) {
            const slot = ARMOR_SLOTS[slotKey];
            const item = ARMOR_ITEM_MAP[itemId];
            if (slot && item) {
                summary.push({
                    slotKey,
                    slotName: slot.name,
                    slotIcon: slot.icon,
                    itemId: item.id,
                    itemName: item.name,
                    isEmpty: item.id.endsWith("_none"),
                });
            }
        }
        return summary;
    },
};
