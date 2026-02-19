// Roblox Avatar Fetcher - Pulls headshots fresh on every page load
const RobloxAvatar = {
    cache: {},   // robloxId -> imageUrl (in-memory only, never persisted)
    loading: false,
    loaded: false,
    onLoadCallbacks: [],

    // Register a callback to fire when avatars finish loading
    onLoad(fn) {
        if (this.loaded) { fn(); return; }
        this.onLoadCallbacks.push(fn);
    },

    // Fetch all avatars for clan families on page load
    async fetchAll() {
        const ids = new Set();
        Object.entries(CLAN_FAMILIES).forEach(([clanId, fam]) => {
            if (fam.leader && fam.leader.robloxId) ids.add(fam.leader.robloxId);
            if (fam.children) {
                fam.children.forEach(c => {
                    if (c.robloxId) ids.add(c.robloxId);
                });
            }
            // Dynamic children
            const dynKids = GameState.dynamicChildren[clanId] || [];
            dynKids.forEach(c => { if (c.robloxId) ids.add(c.robloxId); });
            // Deceased members
            const deceased = GameState.deceasedMembers[clanId] || [];
            deceased.forEach(c => { if (c.robloxId) ids.add(c.robloxId); });
        });

        const unique = [...ids];
        if (unique.length === 0) {
            this.loaded = true;
            this._fireCallbacks();
            return;
        }

        this.loading = true;
        try {
            for (let i = 0; i < unique.length; i += 100) {
                const batch = unique.slice(i, i + 100);

                // Use API proxy to avoid CORS (Roblox API blocks browser requests)
                const url = (typeof API !== "undefined" && API.enabled)
                    ? API.getAvatarProxyUrl(batch)
                    : `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${batch.join(",")}&size=150x150&format=Png&isCircular=false`;

                const res = await fetch(url);
                if (!res.ok) {
                    console.warn("Roblox avatar API returned", res.status);
                    continue;
                }
                const data = await res.json();
                if (data.data) {
                    data.data.forEach(item => {
                        if (item.state === "Completed" && item.imageUrl) {
                            this.cache[item.targetId] = item.imageUrl;
                        }
                    });
                }
            }
            console.log(`Loaded ${Object.keys(this.cache).length} Roblox avatars`);
        } catch (e) {
            console.warn("Failed to fetch Roblox avatars:", e);
        }
        this.loading = false;
        this.loaded = true;
        this._fireCallbacks();
    },

    _fireCallbacks() {
        this.onLoadCallbacks.forEach(fn => fn());
        this.onLoadCallbacks = [];
    },

    // Get cached URL (or null if not loaded)
    getUrl(robloxId) {
        return this.cache[robloxId] || null;
    },

    // Generate <img> or placeholder HTML
    img(robloxId, size = 40, cssClass = "") {
        const url = this.getUrl(robloxId);
        if (url) {
            return `<img src="${url}" class="roblox-avatar ${cssClass}" width="${size}" height="${size}" alt="Avatar" draggable="false"/>`;
        }
        return `<div class="roblox-avatar placeholder ${cssClass}" style="width:${size}px;height:${size}px"></div>`;
    }
};
