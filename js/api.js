// API Client - connects frontend to Express backend on PebbleHost
// Set API_BASE_URL to your server URL to enable database mode.
// Leave as null to use local-only mode (localStorage + hardcoded families).
const API_BASE_URL = "https://shogunate-api.duckdns.org/api/sengoku";

const API = {
    enabled: !!API_BASE_URL,

    // Generic fetch wrapper
    async request(endpoint, method = "GET", body = null) {
        if (!this.enabled) return null;

        const opts = {
            method,
            headers: { "Content-Type": "application/json" },
        };

        // Attach auth token if available
        const token = Auth.getToken();
        if (token) {
            opts.headers["Authorization"] = `Bearer ${token}`;
        }

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
        return this.request("families");
    },

    // Fetch one clan's family
    async getClanFamily(clanKey) {
        return this.request(`families?clan=${clanKey}`);
    },

    // Add a family member
    async addFamilyMember(clanKey, characterName, role, gender, robloxUserId, title) {
        return this.request("families", "POST", {
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
        return this.request("families", "PUT", { id, ...updates });
    },

    // Remove a family member
    async removeFamilyMember(id) {
        return this.request(`families?id=${id}`, "DELETE");
    },

    // ---- Marriages ----

    // Fetch marriages/proposals (optionally for a specific clan)
    async getMarriages(clanKey) {
        const q = clanKey ? `?clan=${clanKey}` : "";
        return this.request(`marriages${q}`);
    },

    // Propose a marriage
    async proposeMarriage(person1Id, person2Id, proposedByClan) {
        return this.request("marriages", "POST", {
            person1_id: person1Id,
            person2_id: person2Id,
            proposed_by: proposedByClan,
        });
    },

    // Accept/reject/dissolve a marriage
    async updateMarriage(id, action) {
        return this.request("marriages", "PUT", { id, action });
    },

    // ---- Avatars (proxy) ----

    // Get avatar URL for proxy mode (avoids CORS)
    getAvatarProxyUrl(userIds) {
        if (!this.enabled) return null;
        return `${API_BASE_URL}/avatars?userIds=${userIds.join(",")}`;
    },
};

// ============================================================
// Auth - Discord OAuth2 login for the map
// ============================================================
const Auth = {
    user: null, // { discordId, username, avatarUrl, robloxId, clanId, clanName, clanKey }

    getToken() {
        return localStorage.getItem("shogunate_token");
    },

    setToken(token) {
        localStorage.setItem("shogunate_token", token);
    },

    clearToken() {
        localStorage.removeItem("shogunate_token");
    },

    // Redirect to Discord OAuth2 login
    login() {
        if (!API_BASE_URL) return;
        window.location.href = `${API_BASE_URL}/auth/discord`;
    },

    // Log out - destroy session and clear local state
    async logout() {
        const token = this.getToken();
        if (token && API_BASE_URL) {
            try {
                await fetch(`${API_BASE_URL}/auth/logout`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`,
                    },
                });
            } catch (e) {
                // Ignore network errors on logout
            }
        }
        this.clearToken();
        this.user = null;
        Auth.updateUI();
    },

    // Fetch logged-in user info from the API
    async fetchUser() {
        const token = this.getToken();
        if (!token || !API_BASE_URL) return null;

        try {
            const res = await fetch(`${API_BASE_URL}/auth/me`, {
                headers: { "Authorization": `Bearer ${token}` },
            });

            if (!res.ok) {
                // Token expired or invalid
                this.clearToken();
                this.user = null;
                return null;
            }

            this.user = await res.json();
            return this.user;
        } catch (e) {
            console.warn("[Auth] Failed to fetch user:", e.message);
            return null;
        }
    },

    // Check URL for token from OAuth callback redirect
    checkCallback() {
        const params = new URLSearchParams(window.location.search);

        // Handle auth errors
        const authError = params.get("auth_error");
        if (authError) {
            console.error("[Auth] Login error:", authError);
            Notifications.show("Login failed: " + authError, "error");
            // Clean URL
            window.history.replaceState({}, "", window.location.pathname);
            return;
        }

        // Handle successful login (token in URL)
        const token = params.get("token");
        if (token) {
            this.setToken(token);
            // Clean URL
            window.history.replaceState({}, "", window.location.pathname);
        }
    },

    // Update the login/user display in the top bar
    updateUI() {
        const container = document.getElementById("auth-container");
        if (!container) return;

        if (this.user) {
            const avatarHtml = this.user.avatarUrl
                ? `<img src="${this.user.avatarUrl}" class="auth-avatar" alt="">`
                : "";

            container.innerHTML = `
                <div class="auth-user">
                    ${avatarHtml}
                    <span class="auth-username">${this.user.username}</span>
                    ${this.user.clanName ? `<span class="auth-clan">${this.user.clanName}</span>` : ""}
                    <button class="auth-btn auth-logout" onclick="Auth.logout()">Logout</button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <button class="auth-btn auth-login" onclick="Auth.login()">Login with Discord</button>
            `;
        }
    },

    // Initialize: check callback, fetch user, update UI, auto-select clan
    async init() {
        this.checkCallback();
        await this.fetchUser();
        this.updateUI();

        // Auto-select the user's clan if they're logged in and haven't picked one
        if (this.user && this.user.clanKey) {
            const selector = document.getElementById("clan-selector");
            if (selector && !GameState.selectedClan) {
                // Try to match clan key to selector options
                for (const option of selector.options) {
                    if (option.value.toLowerCase() === this.user.clanKey.toLowerCase()) {
                        selector.value = option.value;
                        GameState.selectedClan = option.value;
                        GameState.save();
                        MapRenderer.update();
                        break;
                    }
                }
            }
        }
    },
};
