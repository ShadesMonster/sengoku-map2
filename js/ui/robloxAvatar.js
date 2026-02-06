// Roblox Avatar Fetcher - Pulls headshots fresh on every page load
const RobloxAvatar = {
    cache: {},   // robloxId -> imageUrl (in-memory only, never persisted)
    loading: false,
    loaded: false,

    // Fetch all avatars for clan families on page load
    async fetchAll() {
        const ids = new Set();
        Object.values(CLAN_FAMILIES).forEach(fam => {
            if (fam.leader.robloxId) ids.add(fam.leader.robloxId);
            fam.children.forEach(c => {
                if (c.robloxId) ids.add(c.robloxId);
            });
        });

        const unique = [...ids];
        if (unique.length === 0) { this.loaded = true; return; }

        this.loading = true;
        try {
            // Roblox thumbnails API - batch up to 100 at a time
            for (let i = 0; i < unique.length; i += 100) {
                const batch = unique.slice(i, i + 100);
                const url = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${batch.join(",")}&size=150x150&format=Png&isCircular=false`;
                const res = await fetch(url);
                const data = await res.json();
                data.data.forEach(item => {
                    if (item.state === "Completed" && item.imageUrl) {
                        this.cache[item.targetId] = item.imageUrl;
                    }
                });
            }
        } catch (e) {
            console.warn("Failed to fetch Roblox avatars:", e);
        }
        this.loading = false;
        this.loaded = true;
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
