// Dashboard - Clan stats, family tree, marriage alliances, orders overview
const Dashboard = {
    viewingClan: null, // null = own clan, or a clanId for viewing others

    init() {
        document.getElementById("btn-dashboard").addEventListener("click", () => {
            this.viewingClan = null; // reset to own clan when opening
            this.toggle();
        });

        document.querySelector("#dashboard-panel .overlay-close").addEventListener("click", () => {
            document.getElementById("dashboard-panel").classList.add("hidden");
        });

        // Re-render dashboard when Roblox avatars finish loading
        RobloxAvatar.onLoad(() => {
            const panel = document.getElementById("dashboard-panel");
            if (!panel.classList.contains("hidden")) {
                this.render();
            }
        });
    },

    toggle() {
        const panel = document.getElementById("dashboard-panel");
        panel.classList.toggle("hidden");
        if (!panel.classList.contains("hidden")) {
            this.render();
        }
    },

    // View another clan's dashboard (read-only)
    viewClan(clanId) {
        this.viewingClan = clanId;
        const panel = document.getElementById("dashboard-panel");
        panel.classList.remove("hidden");
        this.render();
    },

    render() {
        // Determine which clan to display
        const displayClanId = this.viewingClan || GameState.selectedClan;
        const isOwnClan = !this.viewingClan || this.viewingClan === GameState.selectedClan;

        if (!displayClanId) {
            document.getElementById("dash-clan-info").innerHTML =
                '<div class="empty-state">Select a clan to view dashboard</div>';
            return;
        }

        const clan = GameState.getClan(displayClanId);
        const family = CLAN_FAMILIES[displayClanId];
        const ownedProvinces = GameState.getOwnedProvinces(displayClanId);
        const totalTroops = GameState.getTotalTroops(displayClanId) + ArmySystem.getTroopsInBattle(displayClanId);
        const allies = GameState.getAllies(displayClanId);

        // Clan browser + Info with leader avatar
        const clanBrowser = `
            <div class="clan-browser">
                <select id="dash-clan-browser" onchange="Dashboard.viewClan(this.value || null)">
                    <option value="">-- Your Clan --</option>
                    ${Object.values(GameState.clans).map(c =>
                        `<option value="${c.id}" ${c.id === this.viewingClan ? 'selected' : ''}>${c.japaneseName} ${c.name}</option>`
                    ).join("")}
                </select>
                ${!isOwnClan ? '<span class="viewing-badge">Viewing</span>' : ''}
            </div>
        `;

        document.getElementById("dash-clan-info").innerHTML = `
            ${clanBrowser}
            <div class="dash-header" style="border-color: ${clan.color}">
                <div class="clan-leader-row">
                    ${family ? RobloxAvatar.img(family.leader.robloxId, 52, "leader-avatar") : ""}
                    <div class="clan-leader-info">
                        <h3 style="color: ${clan.color}">${clan.japaneseName} ${clan.name}</h3>
                        ${family ? `<div class="leader-name">${family.leader.name}</div>
                        <div class="leader-title">${family.leader.title}</div>` : ""}
                    </div>
                </div>
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
                    <div class="stat-label">Ashigaru <span class="player-equiv">(${totalTroops / TROOP_RATIO} men)</span></div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${clan.rallyCap.toLocaleString()}</div>
                    <div class="stat-label">Rally Cap <span class="player-equiv">(${clan.rallyCap / TROOP_RATIO} men)</span></div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${allies.length}</div>
                    <div class="stat-label">Marriages</div>
                </div>
            </div>
            <div class="rally-bar">
                <div class="rally-fill" style="width: ${Math.min(100, (totalTroops / clan.rallyCap) * 100)}%"></div>
                <span class="rally-text">${totalTroops.toLocaleString()} / ${clan.rallyCap.toLocaleString()} ashigaru (${totalTroops / TROOP_RATIO} / ${clan.rallyCap / TROOP_RATIO} men)</span>
            </div>
        `;

        // Family Tree (always visible)
        this.renderFamilyTree(displayClanId);

        // Marriage Alliances (always visible, but actions hidden for other clans)
        this.renderAlliances(displayClanId, allies, isOwnClan);

        // Marriage Proposals (only visible for own clan)
        if (isOwnClan) {
            const pendingRequests = Diplomacy.getPendingRequests(displayClanId);
            const sentRequests = Diplomacy.getSentRequests(displayClanId);
            this.renderProposals(displayClanId, pendingRequests, sentRequests);
            document.getElementById("dash-pending-requests").style.display = "";
        } else {
            document.getElementById("dash-pending-requests").innerHTML = "";
            document.getElementById("dash-pending-requests").style.display = "none";
        }

        // Orders (only visible for own clan)
        if (isOwnClan) {
            const orders = MoveSystem.getOrders(displayClanId);
            document.getElementById("dash-orders").innerHTML = `
                <h3>Orders (Week ${GameState.week})</h3>
                ${orders.length === 0 ? '<div class="empty-state">No orders this turn</div>' :
                orders.map(o => {
                    const from = PROVINCE_MAP[o.fromProvince];
                    const to = PROVINCE_MAP[o.toProvince];
                    return `
                        <div class="order-entry ${o.status}">
                            <span>${o.troops.toLocaleString()} ashigaru <span class="player-equiv">(${o.troops / TROOP_RATIO} men)</span>: ${from.name} → ${to.name}</span>
                            <span class="order-status ${o.status}">${o.status}</span>
                        </div>
                    `;
                }).join("")}
            `;
            document.getElementById("dash-orders").style.display = "";
        } else {
            document.getElementById("dash-orders").innerHTML = "";
            document.getElementById("dash-orders").style.display = "none";
        }
    },

    renderFamilyTree(clanId) {
        const family = CLAN_FAMILIES[clanId];
        const container = document.getElementById("dash-family");
        if (!family) {
            container.innerHTML = '<div class="empty-state">No family data</div>';
            return;
        }

        const clan = GameState.getClan(clanId);

        container.innerHTML = `
            <h3>Family</h3>
            <div class="family-tree">
                <div class="family-leader">
                    ${RobloxAvatar.img(family.leader.robloxId, 48, "family-avatar")}
                    <div class="family-person-info">
                        <span class="family-person-name">${family.leader.name}</span>
                        <span class="family-person-role">Clan Leader</span>
                    </div>
                </div>
                <div class="family-children">
                    ${family.children.map(child => {
                        const genderIcon = child.gender === "male" ? "♂" : "♀";
                        const genderClass = child.gender === "male" ? "male" : "female";
                        const married = Diplomacy.isMarried(child.id);
                        let marriageInfo = "";

                        if (married) {
                            // Find who they married
                            const alliance = GameState.alliances.find(a =>
                                a.person1 === child.id || a.person2 === child.id
                            );
                            if (alliance) {
                                const spouseId = alliance.person1 === child.id ? alliance.person2 : alliance.person1;
                                const spouse = Diplomacy.getPerson(spouseId);
                                if (spouse) {
                                    const spouseClan = GameState.getClan(spouse.clanId);
                                    marriageInfo = `
                                        <div class="marriage-link">
                                            <span class="marriage-heart">&#10084;</span>
                                            ${RobloxAvatar.img(spouse.robloxId, 28, "spouse-avatar")}
                                            <span class="spouse-name" style="color: ${spouseClan ? spouseClan.color : "#888"}">${spouse.name}</span>
                                            <span class="spouse-clan">(${spouseClan ? spouseClan.name : "?"})</span>
                                        </div>
                                    `;
                                }
                            }
                        }

                        return `
                            <div class="family-child ${married ? "married" : "unmarried"}">
                                <div class="family-child-main">
                                    ${RobloxAvatar.img(child.robloxId, 36, "family-avatar")}
                                    <div class="family-person-info">
                                        <span class="family-person-name">
                                            ${child.name}
                                            <span class="gender-icon ${genderClass}">${genderIcon}</span>
                                        </span>
                                        <span class="family-person-role">${married ? "Married" : "Unmarried"}</span>
                                    </div>
                                </div>
                                ${marriageInfo}
                            </div>
                        `;
                    }).join("")}
                </div>
            </div>
        `;
    },

    renderAlliances(clanId, allies, isOwnClan) {
        const container = document.getElementById("dash-allies");

        container.innerHTML = `
            <h3>Marriage Alliances</h3>
            ${allies.length === 0 ? '<div class="empty-state">No alliances — propose a marriage to form one</div>' :
            allies.map(aId => {
                const ally = GameState.getClan(aId);
                const marriage = Diplomacy.getMarriageInfo(clanId, aId);
                const allyFamily = CLAN_FAMILIES[aId];

                let marriageDetail = "";
                if (marriage && marriage.person1 && marriage.person2) {
                    marriageDetail = `
                        <div class="alliance-marriage-detail">
                            <div class="marriage-couple">
                                <div class="marriage-person">
                                    ${RobloxAvatar.img(marriage.person1.robloxId, 36)}
                                    <span class="person-name-small">${marriage.person1.name}</span>
                                </div>
                                <span class="marriage-heart-lg">&#10084;</span>
                                <div class="marriage-person">
                                    ${RobloxAvatar.img(marriage.person2.robloxId, 36)}
                                    <span class="person-name-small">${marriage.person2.name}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }

                return `
                    <div class="ally-entry-card" style="border-left: 3px solid ${ally.color}">
                        <div class="ally-header">
                            ${allyFamily ? RobloxAvatar.img(allyFamily.leader.robloxId, 40, "ally-leader-avatar") : ""}
                            <div class="ally-info">
                                <span class="ally-name" style="color: ${ally.color}">${ally.japaneseName} ${ally.name}</span>
                                ${allyFamily ? `<span class="ally-leader-name">${allyFamily.leader.name}</span>` : ""}
                            </div>
                            ${!isOwnClan ? `<button class="small-btn" onclick="Dashboard.viewClan('${aId}')" style="margin-left:auto">View</button>` : ""}
                        </div>
                        ${marriageDetail}
                        ${isOwnClan ? `
                            <div class="ally-actions">
                                <button class="small-btn danger" onclick="Dashboard.dissolveMarriage('${clanId}', '${aId}')">
                                    Dissolve Marriage
                                </button>
                            </div>
                        ` : ""}
                    </div>
                `;
            }).join("")}
            ${isOwnClan ? `
                <button class="action-btn" onclick="Dashboard.showMarriageModal()">
                    Propose Marriage
                </button>
            ` : ""}
        `;
    },

    renderProposals(clanId, pendingRequests, sentRequests) {
        const container = document.getElementById("dash-pending-requests");

        container.innerHTML = `
            <h3>Marriage Proposals</h3>
            ${pendingRequests.length === 0 && sentRequests.length === 0 ?
            '<div class="empty-state">No pending proposals</div>' : ''}
            ${pendingRequests.map(r => {
                const fromClan = GameState.getClan(r.from);
                const fromPerson = Diplomacy.getPerson(r.fromPerson);
                const toPerson = Diplomacy.getPerson(r.toPerson);
                return `
                    <div class="request-entry pulse-border" style="border-left: 3px solid ${fromClan.color}">
                        <div class="proposal-detail">
                            <div class="proposal-people">
                                ${fromPerson ? `
                                    ${RobloxAvatar.img(fromPerson.robloxId, 30)}
                                    <span>${fromPerson.name}</span>
                                ` : ""}
                                <span class="marriage-heart">&#10084;</span>
                                ${toPerson ? `
                                    <span>${toPerson.name}</span>
                                    ${RobloxAvatar.img(toPerson.robloxId, 30)}
                                ` : ""}
                            </div>
                            <div class="proposal-from">${fromClan.name} proposes marriage</div>
                        </div>
                        <div class="proposal-actions">
                            <button class="small-btn commit" onclick="Dashboard.acceptMarriage('${r.id}')">Accept</button>
                            <button class="small-btn cancel" onclick="Dashboard.rejectMarriage('${r.id}')">Reject</button>
                        </div>
                    </div>
                `;
            }).join("")}
            ${sentRequests.map(r => {
                const toClan = GameState.getClan(r.to);
                const fromPerson = Diplomacy.getPerson(r.fromPerson);
                const toPerson = Diplomacy.getPerson(r.toPerson);
                return `
                    <div class="request-entry sent">
                        <div class="proposal-detail">
                            <div class="proposal-people">
                                ${fromPerson ? `${RobloxAvatar.img(fromPerson.robloxId, 24)} <span>${fromPerson.name}</span>` : ""}
                                <span class="marriage-heart">&#10084;</span>
                                ${toPerson ? `<span>${toPerson.name}</span> ${RobloxAvatar.img(toPerson.robloxId, 24)}` : ""}
                            </div>
                            <div class="proposal-from">Sent to ${toClan.name}</div>
                        </div>
                        <span class="status-pending">Pending...</span>
                    </div>
                `;
            }).join("")}
        `;
    },

    showMarriageModal() {
        const clanId = GameState.selectedClan;
        if (!clanId) return;

        const modal = document.getElementById("alliance-modal");
        const myChildren = Diplomacy.getUnmarriedChildren(clanId);

        if (myChildren.length === 0) {
            Notifications.show("No unmarried children available for marriage", "error");
            return;
        }

        // Get clans that aren't already allied and have unmarried children
        const allies = GameState.getAllies(clanId);
        const availableClans = Object.values(GameState.clans)
            .filter(c => c.id !== clanId && !allies.includes(c.id))
            .filter(c => Diplomacy.getUnmarriedChildren(c.id).length > 0);

        if (availableClans.length === 0) {
            Notifications.show("No clans available for marriage alliance", "error");
            return;
        }

        // Build modal content
        const content = modal.querySelector(".modal-content");
        content.innerHTML = `
            <h3>Propose Marriage</h3>
            <div class="marriage-form">
                <div class="form-group">
                    <label>Your child:</label>
                    <select id="marriage-my-child">
                        ${myChildren.map(c => {
                            const icon = c.gender === "male" ? "♂" : "♀";
                            return `<option value="${c.id}">${icon} ${c.name}</option>`;
                        }).join("")}
                    </select>
                    <div id="marriage-my-preview" class="person-preview"></div>
                </div>
                <div class="form-group">
                    <label>Propose to clan:</label>
                    <select id="marriage-target-clan">
                        ${availableClans.map(c =>
                            `<option value="${c.id}">${c.japaneseName} ${c.name}</option>`
                        ).join("")}
                    </select>
                </div>
                <div class="form-group">
                    <label>Their child:</label>
                    <select id="marriage-their-child"></select>
                    <div id="marriage-their-preview" class="person-preview"></div>
                </div>
            </div>
            <div class="modal-buttons">
                <button id="marriage-send" class="modal-btn confirm">Send Proposal</button>
                <button id="marriage-cancel" class="modal-btn cancel">Cancel</button>
            </div>
        `;

        const updateTheirChildren = () => {
            const targetClanId = document.getElementById("marriage-target-clan").value;
            const theirChildren = Diplomacy.getUnmarriedChildren(targetClanId);
            document.getElementById("marriage-their-child").innerHTML =
                theirChildren.map(c => {
                    const icon = c.gender === "male" ? "♂" : "♀";
                    return `<option value="${c.id}">${icon} ${c.name}</option>`;
                }).join("");
            updateTheirPreview();
        };

        const updateMyPreview = () => {
            const personId = document.getElementById("marriage-my-child").value;
            const person = Diplomacy.getPerson(personId);
            const preview = document.getElementById("marriage-my-preview");
            if (person) {
                preview.innerHTML = `${RobloxAvatar.img(person.robloxId, 40)} <span>${person.name}</span>`;
            }
        };

        const updateTheirPreview = () => {
            const personId = document.getElementById("marriage-their-child").value;
            const person = personId ? Diplomacy.getPerson(personId) : null;
            const preview = document.getElementById("marriage-their-preview");
            if (person) {
                preview.innerHTML = `${RobloxAvatar.img(person.robloxId, 40)} <span>${person.name}</span>`;
            } else {
                preview.innerHTML = "";
            }
        };

        modal.classList.remove("hidden");

        // Set up event handlers after modal is visible
        setTimeout(() => {
            document.getElementById("marriage-target-clan").addEventListener("change", updateTheirChildren);
            document.getElementById("marriage-my-child").addEventListener("change", updateMyPreview);
            document.getElementById("marriage-their-child").addEventListener("change", updateTheirPreview);

            updateTheirChildren();
            updateMyPreview();

            document.getElementById("marriage-send").onclick = () => {
                const myChildId = document.getElementById("marriage-my-child").value;
                const targetClanId = document.getElementById("marriage-target-clan").value;
                const theirChildId = document.getElementById("marriage-their-child").value;

                if (!myChildId || !targetClanId || !theirChildId) {
                    Notifications.show("Select all fields", "error");
                    return;
                }

                const result = Diplomacy.proposeMarriage(clanId, myChildId, targetClanId, theirChildId);
                if (result.success) {
                    Notifications.show("Marriage proposal sent!", "success");
                    this.render();
                } else {
                    Notifications.show(result.error, "error");
                }
                modal.classList.add("hidden");
            };

            document.getElementById("marriage-cancel").onclick = () => {
                modal.classList.add("hidden");
            };
        }, 0);
    },

    acceptMarriage(requestId) {
        const result = Diplomacy.acceptMarriage(requestId);
        if (result.success) {
            this.render();
        } else {
            Notifications.show(result.error, "error");
        }
    },

    rejectMarriage(requestId) {
        const result = Diplomacy.rejectMarriage(requestId);
        if (result.success) {
            this.render();
        } else {
            Notifications.show(result.error, "error");
        }
    },

    dissolveMarriage(clan1, clan2) {
        if (!confirm("Dissolve this marriage? The alliance will be broken.")) return;
        const result = Diplomacy.dissolveMarriage(clan1, clan2);
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
