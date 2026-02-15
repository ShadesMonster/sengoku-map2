// API Client - connects frontend to Express backend on PebbleHost
// Set API_BASE_URL to your server URL to enable database mode.
// Leave as null to use local-only mode (localStorage + hardcoded families).
const API_BASE_URL = "https://api.shogunate.uk/api/sengoku";

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

    // ---- Clans ----

    // Fetch all clans from roblox_clans table
    async getClans() {
        return this.request("clans");
    },

    // Load clans from DB as the primary source of truth
    async loadClansFromDB() {
        if (!this.enabled) return;
        try {
            const data = await this.getClans();
            if (!data || !data.clans) return;

            let colorIndex = 0;
            GameState.clans = {};

            data.clans.forEach(dbClan => {
                const clanId = dbClan.name.toLowerCase().trim();
                const defaults = CLAN_DEFAULTS[clanId];

                GameState.clans[clanId] = {
                    id: clanId,
                    name: dbClan.name,
                    japaneseName: dbClan.japaneseName || (defaults ? defaults.japaneseName : dbClan.name),
                    color: dbClan.color || (defaults ? defaults.color : AUTO_COLORS[colorIndex++ % AUTO_COLORS.length]),
                    rallyCap: dbClan.rallyCap || 10000,
                    castleProvince: dbClan.castleProvince || null,
                    description: dbClan.description || null,
                    daimyo: dbClan.daimyo || null,
                    dbClanId: dbClan.clanId,
                };
            });

            GameState.save();
            RobloxAvatar.fetchAll();
            MapRenderer.update();
            console.log("[API] Clans loaded from database:", Object.keys(GameState.clans).length);
        } catch (err) {
            console.warn("[API] Failed to load clans from DB:", err);
        }
    },

    // Update clan map settings (castle, color, etc.) via admin
    async updateClanSettings(dbClanId, settings) {
        return this.request(`clans/${dbClanId}/settings`, "PUT", settings);
    },

    // Load families from DB and inject into CLAN_FAMILIES so existing
    // diplomacy/marriage/ClanPanel code works without changes
    async loadFamiliesFromDB() {
        if (!this.enabled) return;
        try {
            const data = await this.getFamilies();
            if (!data || !data.families) return;

            for (const [clanKey, fam] of Object.entries(data.families)) {
                // Build leader object matching the expected format
                const existing = CLAN_FAMILIES[clanKey];
                let leader;

                if (fam.leader) {
                    leader = {
                        id: existing?.leader?.id || `${clanKey.replace(/\s+/g, '_')}_daimyo`,
                        name: fam.leader.name || (existing?.leader?.name || 'Daimyo'),
                        title: fam.leader.title || (existing?.leader?.title || ''),
                        gender: existing?.leader?.gender || 'male',
                        robloxId: fam.leader.robloxId || (existing?.leader?.robloxId || DEFAULT_ROBLOX_ID),
                    };
                } else if (existing?.leader) {
                    leader = existing.leader;
                } else {
                    // No leader from DB or hardcoded — create a placeholder
                    const clan = GameState.clans[clanKey];
                    leader = {
                        id: `${clanKey.replace(/\s+/g, '_')}_daimyo`,
                        name: clan ? clan.name + ' Daimyo' : 'Daimyo',
                        title: '',
                        gender: 'male',
                        robloxId: DEFAULT_ROBLOX_ID,
                    };
                }

                // Build children — DB children first, then keep hardcoded ones that aren't duplicated
                const dbChildren = (fam.children || []).map(c => ({
                    id: c.id, // e.g. "db_123"
                    name: c.name,
                    gender: c.gender,
                    robloxId: c.robloxId || DEFAULT_ROBLOX_ID,
                    dbId: c.dbId,
                }));

                // Merge: use DB children; if none from DB, fall back to hardcoded
                const children = dbChildren.length > 0
                    ? dbChildren
                    : (existing?.children || []);

                CLAN_FAMILIES[clanKey] = { leader, children };
            }

            // Also ensure any clan in GameState.clans that has no CLAN_FAMILIES entry
            // gets a placeholder so the family panel shows up
            for (const clanKey of Object.keys(GameState.clans)) {
                if (!CLAN_FAMILIES[clanKey]) {
                    const clan = GameState.clans[clanKey];
                    CLAN_FAMILIES[clanKey] = {
                        leader: {
                            id: `${clanKey.replace(/\s+/g, '_')}_daimyo`,
                            name: clan.daimyo?.rpName || clan.name + ' Daimyo',
                            title: '',
                            gender: 'male',
                            robloxId: clan.daimyo?.robloxId || DEFAULT_ROBLOX_ID,
                        },
                        children: [],
                    };
                }
            }

            RobloxAvatar.fetchAll();
            console.log("[API] Families loaded from database:", Object.keys(data.families).length);
        } catch (err) {
            console.warn("[API] Failed to load families from DB:", err);
        }
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
const ADMIN_DISCORD_ID = "186807769238732800";

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

    isAdmin() {
        return this.user && this.user.discordId === ADMIN_DISCORD_ID;
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
        GameState.selectedClan = null;
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

        const authError = params.get("auth_error");
        if (authError) {
            console.error("[Auth] Login error:", authError);
            Notifications.show("Login failed: " + authError, "error");
            window.history.replaceState({}, "", window.location.pathname);
            return;
        }

        const token = params.get("token");
        if (token) {
            this.setToken(token);
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
                <div class="auth-user" onclick="Auth.toggleMenu()" title="Click to logout">
                    ${avatarHtml}
                    <span class="auth-username">${this.user.username}</span>
                    ${this.user.clanName ? `<span class="auth-clan">${this.user.clanName}</span>` : ""}
                </div>
                <div id="auth-menu" class="auth-menu hidden">
                    <button class="auth-menu-item" onclick="Auth.logout()">Logout</button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <button class="auth-btn auth-login" onclick="Auth.login()">Login with Discord</button>
            `;
        }

        // Show/hide admin button based on who's logged in
        const adminBtn = document.getElementById("btn-admin");
        if (adminBtn) {
            adminBtn.classList.toggle("hidden", !this.isAdmin());
        }
    },

    toggleMenu() {
        const menu = document.getElementById("auth-menu");
        if (menu) menu.classList.toggle("hidden");
    },

    // Initialize: check callback, fetch user, update UI, set clan from login
    async init() {
        this.checkCallback();
        await this.fetchUser();
        this.updateUI();

        // Set selected clan from login
        if (this.user && this.user.clanKey) {
            // Match clan key to GameState clan IDs
            for (const clanId of Object.keys(GameState.clans)) {
                if (clanId.toLowerCase() === this.user.clanKey.toLowerCase()) {
                    GameState.selectedClan = clanId;
                    GameState.save();
                    MapRenderer.update();
                    App.updateUI();
                    break;
                }
            }
        }
    },
};
