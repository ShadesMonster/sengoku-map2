// API Client - connects frontend to PHP backend
// Set API_BASE_URL to your server URL to enable database mode.
// Leave as null to use local-only mode (localStorage + hardcoded families).
const API_BASE_URL = null; // e.g. "https://your-server.com/api"

const API = {
    enabled: !!API_BASE_URL,

    // Generic fetch wrapper
    async request(endpoint, method = "GET", body = null) {
        if (!this.enabled) return null;

        const opts = {
            method,
            headers: { "Content-Type": "application/json" },
        };
        if (body) opts.body = JSON.stringify(body);

        const res = await fetch(`${API_BASE_URL}/${endpoint}`, opts);
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || `API error ${res.status}`);
        }
        return data;
    },

    // ---- Families ----

    // Fetch all clan families from database
    async getFamilies() {
        return this.request("families.php");
    },

    // Fetch one clan's family
    async getClanFamily(clanKey) {
        return this.request(`families.php?clan=${clanKey}`);
    },

    // Add a family member
    async addFamilyMember(clanKey, characterName, role, gender, robloxUserId, title) {
        return this.request("families.php", "POST", {
            clan: clanKey,
            character_name: characterName,
            role,
            gender,
            roblox_user_id: robloxUserId || null,
            title: title || null,
        });
    },

    // Update a family member
    async updateFamilyMember(id, updates) {
        return this.request("families.php", "PUT", { id, ...updates });
    },

    // Remove a family member
    async removeFamilyMember(id) {
        return this.request(`families.php?id=${id}`, "DELETE");
    },

    // ---- Marriages ----

    // Fetch marriages/proposals (optionally for a specific clan)
    async getMarriages(clanKey) {
        const q = clanKey ? `?clan=${clanKey}` : "";
        return this.request(`marriages.php${q}`);
    },

    // Propose a marriage
    async proposeMarriage(person1Id, person2Id, proposedByClan) {
        return this.request("marriages.php", "POST", {
            person1_id: person1Id,
            person2_id: person2Id,
            proposed_by: proposedByClan,
        });
    },

    // Accept/reject/dissolve a marriage
    async updateMarriage(id, action) {
        return this.request("marriages.php", "PUT", { id, action });
    },

    // ---- Avatars (proxy) ----

    // Get avatar URL for proxy mode (avoids CORS)
    getAvatarProxyUrl(userIds) {
        if (!this.enabled) return null;
        return `${API_BASE_URL}/avatars.php?userIds=${userIds.join(",")}`;
    },
};
