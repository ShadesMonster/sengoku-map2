// Panels - Side panel, province details, action buttons
const Panels = {
    init() {
        // Close button
        document.getElementById("panel-close").addEventListener("click", () => {
            document.getElementById("side-panel").classList.add("hidden");
            ClanPanel.hide();
            if (MapInteraction.selectedProvince) {
                MapRenderer.highlightProvince(MapInteraction.selectedProvince, false);
                MapInteraction.selectedProvince = null;
            }
        });
    },

    showProvincePanel(provinceId) {
        const panel = document.getElementById("side-panel");
        const prov = PROVINCE_MAP[provinceId];
        const state = GameState.provinces[provinceId];
        if (!prov || !state) return;

        panel.classList.remove("hidden");

        // Show CK3-style clan overview on the left if province has owner
        if (state.owner) {
            ClanPanel.show(state.owner);
        } else {
            ClanPanel.hide();
        }

        // Province name
        document.getElementById("panel-province-name").textContent =
            `${prov.japaneseName} ${prov.name}`;

        // Battleground type - Castle Siege at clan capitals, otherwise terrain-based
        const terrain = TERRAIN_CONFIG[prov.terrain];
        const ownerClan = state.owner ? GameState.getClan(state.owner) : null;
        const isCapital = ownerClan && ownerClan.homeProvince === provinceId;
        document.getElementById("panel-terrain-value").textContent = isCapital
            ? `${CASTLE_SIEGE.icon} Castle Siege`
            : `${terrain.icon} ${terrain.battleType}`;

        // Owner
        const ownerSpan = document.getElementById("panel-owner-value");
        if (state.owner) {
            const clan = GameState.getClan(state.owner);
            ownerSpan.innerHTML = `<span style="color:${clan.color}">${clan.japaneseName} ${clan.name}</span>`;
        } else {
            ownerSpan.textContent = "Unclaimed";
        }

        // Armies
        this.renderArmiesList(provinceId);

        // Actions
        this.renderActions(provinceId);

        // Neighbors
        this.renderNeighbors(provinceId);
    },

    renderArmiesList(provinceId) {
        const list = document.getElementById("panel-armies-list");
        const armies = ArmySystem.getArmiesInProvince(provinceId);
        const battleTroops = ArmySystem.getBattleTroopsAtProvince(provinceId);

        let html = "";

        if (armies.length > 0) {
            html += armies.map(a => {
                const players = a.count / TROOP_RATIO;
                return `
                    <div class="army-entry" style="border-left: 3px solid ${a.clan.color}">
                        <span class="army-clan">${a.clan.japaneseName} ${a.clan.name}</span>
                        <span class="army-count">${a.count.toLocaleString()} ashigaru <span class="player-equiv">(${players} men)</span></span>
                    </div>
                `;
            }).join("");
        }

        if (battleTroops.length > 0) {
            html += '<div class="battle-troops-header">⚔ In Battle</div>';
            html += battleTroops.map(bt => {
                const players = bt.count / TROOP_RATIO;
                const sideLabel = bt.side === "attacker" ? "ATK" : "DEF";
                return `
                    <div class="army-entry in-battle" style="border-left: 3px solid ${bt.clan.color}">
                        <span class="army-clan">${bt.clan.japaneseName} ${bt.clan.name} <span class="battle-side-tag ${bt.side}">${sideLabel}</span></span>
                        <span class="army-count">${bt.count.toLocaleString()} ashigaru <span class="player-equiv">(${players} men)</span></span>
                    </div>
                `;
            }).join("");
        }

        // Retreating armies
        const retreating = BattleSystem.getRetreatingArmiesAtProvince(provinceId);
        if (retreating.length > 0) {
            html += '<div class="battle-troops-header">\u{1F6A9} Retreating</div>';
            html += retreating.map(r => {
                const clan = GameState.getClan(r.clanId);
                if (!clan) return '';
                const players = r.troops / TROOP_RATIO;
                const destName = PROVINCE_MAP[r.destination] ? PROVINCE_MAP[r.destination].name : "unknown";
                return `
                    <div class="army-entry retreating" style="border-left: 3px solid ${clan.color}">
                        <span class="army-clan">${clan.japaneseName} ${clan.name} <span class="battle-side-tag retreating">RET</span></span>
                        <span class="army-count">${r.troops.toLocaleString()} ashigaru <span class="player-equiv">(${players} men)</span> → ${destName} (${r.weeksLeft}w)</span>
                    </div>
                `;
            }).join("");
        }

        if (!html) {
            html = '<div class="empty-state">No armies present</div>';
        }

        list.innerHTML = html;
    },

    renderActions(provinceId) {
        const container = document.getElementById("panel-action-buttons");
        const clanId = GameState.selectedClan;
        container.innerHTML = "";

        if (!clanId) {
            container.innerHTML = '<div class="empty-state">Select a clan to perform actions</div>';
            return;
        }

        const state = GameState.provinces[provinceId];
        const clan = GameState.getClan(clanId);
        const hasTroops = ArmySystem.getArmyInProvince(clanId, provinceId) > 0;
        const ownsProvince = state.owner === clanId;

        // Planning phase actions
        if (GameState.phase === "planning") {
            // Raise Levy (only in owned provinces)
            if (ownsProvince) {
                const rallyInfo = ArmySystem.getRallyInfo(clanId);
                const btn = this.createButton(
                    `Raise Levy (${rallyInfo.available.toLocaleString()} available)`,
                    "action-btn raise-levy",
                    () => this.showRaiseLevyDialog(clanId, provinceId)
                );
                if (rallyInfo.available <= 0) btn.disabled = true;
                container.appendChild(btn);
            }

            // Move Army (if has troops here)
            if (hasTroops) {
                const committed = MoveSystem.getOrdersFrom(clanId, provinceId)
                    .reduce((sum, o) => sum + o.troops, 0);
                const available = ArmySystem.getArmyInProvince(clanId, provinceId) - committed;

                if (available >= TROOP_UNIT) {
                    const players = available / TROOP_RATIO;
                    container.appendChild(this.createButton(
                        `Move Army (${available.toLocaleString()} ashigaru / ${players} men)`,
                        "action-btn move-army",
                        () => MapInteraction.enterMoveMode(provinceId)
                    ));
                }
            }

            // Gift province (to allies)
            if (ownsProvince) {
                const allies = GameState.getAllies(clanId);
                if (allies.length > 0) {
                    container.appendChild(this.createButton(
                        "Gift Province",
                        "action-btn gift",
                        () => this.showGiftDialog(clanId, provinceId)
                    ));
                }
            }
        }

        // Show pending orders for this province
        const orders = MoveSystem.getOrdersFrom(clanId, provinceId);
        if (orders.length > 0) {
            const ordersDiv = document.createElement("div");
            ordersDiv.className = "orders-section";
            ordersDiv.innerHTML = "<h4>Pending Orders</h4>";

            orders.forEach(order => {
                const to = PROVINCE_MAP[order.toProvince];
                const orderEl = document.createElement("div");
                orderEl.className = `order-entry ${order.status}`;
                const orderPlayers = order.troops / TROOP_RATIO;
                orderEl.innerHTML = `
                    <span class="order-info">${order.troops.toLocaleString()} (${orderPlayers} men) → ${to.name}</span>
                    <span class="order-status ${order.status}">${order.status}</span>
                    <div class="order-actions">
                        ${order.status === "pending" ? `
                            <button class="small-btn commit" onclick="Panels.commitOrder('${order.id}')">Commit</button>
                            <button class="small-btn cancel" onclick="Panels.cancelOrder('${order.id}')">Cancel</button>
                        ` : `
                            <button class="small-btn uncommit" onclick="Panels.uncommitOrder('${order.id}')">Uncommit</button>
                        `}
                    </div>
                `;
                ordersDiv.appendChild(orderEl);
            });

            container.appendChild(ordersDiv);
        }

        if (container.children.length === 0) {
            container.innerHTML = '<div class="empty-state">No actions available</div>';
        }
    },

    renderNeighbors(provinceId) {
        const list = document.getElementById("panel-neighbors-list");
        const prov = PROVINCE_MAP[provinceId];

        list.innerHTML = prov.neighbors.map(nId => {
            const neighbor = PROVINCE_MAP[nId];
            if (!neighbor) return "";
            const nState = GameState.provinces[nId];
            const ownerColor = nState && nState.owner ?
                GameState.getClan(nState.owner)?.color || "#666" : "#666";

            return `
                <div class="neighbor-entry" onclick="MapInteraction.selectProvince('${nId}')"
                     style="border-left: 3px solid ${ownerColor}">
                    <span>${neighbor.japaneseName} ${neighbor.name}</span>
                    <span class="terrain-badge">${TERRAIN_CONFIG[neighbor.terrain].icon}</span>
                </div>
            `;
        }).join("");
    },

    createButton(text, className, onclick) {
        const btn = document.createElement("button");
        btn.textContent = text;
        btn.className = className;
        btn.addEventListener("click", onclick);
        return btn;
    },

    showRaiseLevyDialog(clanId, provinceId) {
        const rallyInfo = ArmySystem.getRallyInfo(clanId);
        const maxAvail = Math.floor(rallyInfo.available / TROOP_UNIT) * TROOP_UNIT;

        let statusLine = `Available: ${rallyInfo.available.toLocaleString()} ashigaru (${rallyInfo.current.toLocaleString()}/${rallyInfo.cap.toLocaleString()})`;
        if (rallyInfo.inBattle > 0) {
            statusLine += `\nIn Battle: ${rallyInfo.inBattle.toLocaleString()} ashigaru`;
        }
        if (rallyInfo.casualties > 0) {
            statusLine += `\nRecovering: ${rallyInfo.casualties.toLocaleString()} ashigaru (unavailable until next week)`;
        }

        const amount = prompt(
            `Raise Levy in ${PROVINCE_MAP[provinceId].name}\n` +
            `${statusLine}\n` +
            `Must raise in units of ${TROOP_UNIT} (1 unit = ${TROOP_UNIT / TROOP_RATIO} men)\n` +
            `How many ashigaru?`,
            Math.min(TROOP_UNIT, maxAvail)
        );

        if (amount === null) return;
        const num = parseInt(amount);
        if (isNaN(num) || num <= 0) {
            Notifications.show("Invalid number", "error");
            return;
        }
        if (num % TROOP_UNIT !== 0) {
            Notifications.show(`Must raise in units of ${TROOP_UNIT}`, "error");
            return;
        }

        const result = ArmySystem.raiseLevy(clanId, provinceId, num);
        if (result.success) {
            const players = result.raised / TROOP_RATIO;
            Notifications.show(`Raised ${result.raised.toLocaleString()} ashigaru (${players} men)!`, "success");
            MapRenderer.update();
            this.showProvincePanel(provinceId);
        } else {
            Notifications.show(result.error, "error");
        }
    },

    showGiftDialog(fromClanId, provinceId) {
        const modal = document.getElementById("gift-modal");
        const select = document.getElementById("gift-target-clan");
        const provName = document.getElementById("gift-province-name");

        provName.textContent = PROVINCE_MAP[provinceId].name;

        const allies = GameState.getAllies(fromClanId);
        select.innerHTML = allies.map(aId => {
            const c = GameState.getClan(aId);
            return `<option value="${aId}">${c.name}</option>`;
        }).join("");

        modal.classList.remove("hidden");

        document.getElementById("gift-send").onclick = () => {
            const targetId = select.value;
            const result = Diplomacy.giftProvince(fromClanId, targetId, provinceId);
            if (result.success) {
                MapRenderer.update();
                this.showProvincePanel(provinceId);
            } else {
                Notifications.show(result.error, "error");
            }
            modal.classList.add("hidden");
        };

        document.getElementById("gift-cancel").onclick = () => {
            modal.classList.add("hidden");
        };
    },

    commitOrder(orderId) {
        const result = MoveSystem.commitOrder(orderId);
        if (result.success) {
            Notifications.show("Order committed!", "success");
            MapRenderer.update();
            if (MapInteraction.selectedProvince) {
                this.showProvincePanel(MapInteraction.selectedProvince);
            }
        } else {
            Notifications.show(result.error, "error");
        }
    },

    uncommitOrder(orderId) {
        const result = MoveSystem.uncommitOrder(orderId);
        if (result.success) {
            Notifications.show("Order uncommitted", "info");
            MapRenderer.update();
            if (MapInteraction.selectedProvince) {
                this.showProvincePanel(MapInteraction.selectedProvince);
            }
        } else {
            Notifications.show(result.error, "error");
        }
    },

    cancelOrder(orderId) {
        const result = MoveSystem.cancelOrder(orderId);
        if (result.success) {
            Notifications.show("Order cancelled", "info");
            MapRenderer.update();
            if (MapInteraction.selectedProvince) {
                this.showProvincePanel(MapInteraction.selectedProvince);
            }
        } else {
            Notifications.show(result.error, "error");
        }
    }
};

// CK3-style Clan Overview Panel (Left side)
const ClanPanel = {
    currentClan: null,

    init() {
        document.getElementById("clan-panel-close").addEventListener("click", () => {
            this.hide();
            document.getElementById("side-panel").classList.add("hidden");
            if (MapInteraction.selectedProvince) {
                MapRenderer.highlightProvince(MapInteraction.selectedProvince, false);
                MapInteraction.selectedProvince = null;
            }
        });

        // Re-render when Roblox avatars finish loading
        RobloxAvatar.onLoad(() => {
            if (this.currentClan) {
                this.render(this.currentClan);
            }
        });
    },

    show(clanId) {
        if (!clanId) { this.hide(); return; }
        const clan = GameState.getClan(clanId);
        if (!clan) { this.hide(); return; }

        this.currentClan = clanId;
        const panel = document.getElementById("clan-panel");
        panel.classList.remove("hidden");
        this.render(clanId);
    },

    hide() {
        document.getElementById("clan-panel").classList.add("hidden");
        this.currentClan = null;
    },

    render(clanId) {
        const clan = GameState.getClan(clanId);
        const family = CLAN_FAMILIES[clanId];
        if (!clan || !family) return;

        const ownedProvinces = GameState.getOwnedProvinces(clanId);
        const totalTroops = GameState.getTotalTroops(clanId) + ArmySystem.getTroopsInBattle(clanId);
        const allies = GameState.getAllies(clanId);
        const homeProv = PROVINCE_MAP[clan.homeProvince];

        // Portrait area
        this.renderPortrait(clan, family);

        // Info bar
        document.getElementById("clan-info-bar").innerHTML = `
            <div class="ck3-realm-info">
                <div class="ck3-realm-stat">
                    <span class="stat-icon">&#x1F3EF;</span>
                    <span class="stat-val">${ownedProvinces.length}</span>
                    <span>provinces</span>
                </div>
                <div class="ck3-realm-stat">
                    <span class="stat-icon">&#x2694;&#xFE0F;</span>
                    <span class="stat-val">${allies.length}</span>
                    <span>allies</span>
                </div>
            </div>
        `;

        // Stats bar
        const troopPlayers = totalTroops / TROOP_RATIO;
        const capPlayers = clan.rallyCap / TROOP_RATIO;
        document.getElementById("clan-stats-bar").innerHTML = `
            <div class="ck3-stat-cell">
                <span class="ck3-stat-icon">&#x2694;&#xFE0F;</span>
                <span class="ck3-stat-value">${totalTroops.toLocaleString()}</span>
                <span class="ck3-stat-label">Ashigaru</span>
            </div>
            <div class="ck3-stat-cell">
                <span class="ck3-stat-icon">&#x1F3AF;</span>
                <span class="ck3-stat-value">${clan.rallyCap.toLocaleString()}</span>
                <span class="ck3-stat-label">Rally Cap</span>
            </div>
            <div class="ck3-stat-cell">
                <span class="ck3-stat-icon">&#x1F464;</span>
                <span class="ck3-stat-value">${troopPlayers}/${capPlayers}</span>
                <span class="ck3-stat-label">Men</span>
            </div>
        `;

        // Family grid
        this.renderFamily(clanId, family);

        // Alliances
        this.renderAlliances(clanId, allies);
    },

    renderPortrait(clan, family) {
        const leader = family.leader;
        const leaderMarried = Diplomacy.isMarried(leader.id);
        let spouseHtml = "";

        if (leaderMarried) {
            const alliance = GameState.alliances.find(a =>
                a.person1 === leader.id || a.person2 === leader.id
            );
            if (alliance) {
                const spouseId = alliance.person1 === leader.id ? alliance.person2 : alliance.person1;
                const spouse = Diplomacy.getPerson(spouseId);
                if (spouse) {
                    spouseHtml = `
                        <div class="ck3-spouse-portrait">
                            ${RobloxAvatar.img(spouse.robloxId, 48, "ck3-avatar")}
                            <span class="ck3-spouse-label">Spouse</span>
                        </div>
                    `;
                }
            }
        }

        const homeProv = PROVINCE_MAP[clan.homeProvince];
        document.getElementById("clan-portrait-area").innerHTML = `
            <div class="ck3-leader-portrait">
                ${RobloxAvatar.img(leader.robloxId, 100, "ck3-avatar")}
                ${spouseHtml}
            </div>
            <div class="ck3-leader-details">
                <div class="ck3-leader-name">${leader.name}</div>
                <div class="ck3-clan-name" style="color: ${clan.color}">${clan.japaneseName} ${clan.name}</div>
                <div class="ck3-leader-title">${leader.title}</div>
                ${homeProv ? `<div class="ck3-capital-badge">&#x1F3EF; ${homeProv.japaneseName} ${homeProv.name}</div>` : ""}
            </div>
        `;
    },

    renderFamily(clanId, family) {
        const container = document.getElementById("clan-family-grid");
        const children = family.children;

        container.innerHTML = `
            <div class="ck3-family-header">Family (${children.length})</div>
            <div class="ck3-family-row">
                ${children.map(child => {
                    const married = Diplomacy.isMarried(child.id);
                    const genderIcon = child.gender === "male" ? "&#9794;" : "&#9792;";
                    const genderClass = child.gender;

                    let marriedBadge = "";
                    if (married) {
                        const alliance = GameState.alliances.find(a =>
                            a.person1 === child.id || a.person2 === child.id
                        );
                        if (alliance) {
                            const spouseId = alliance.person1 === child.id ? alliance.person2 : alliance.person1;
                            const spouse = Diplomacy.getPerson(spouseId);
                            if (spouse) {
                                const spouseClan = GameState.getClan(spouse.clanId);
                                marriedBadge = `<span class="ck3-married-badge" title="Married to ${spouse.name} (${spouseClan ? spouseClan.name : '?'})">&#10084; ${spouse.name.split(' ').pop()}</span>`;
                            }
                        }
                    }

                    return `
                        <div class="ck3-family-member ${married ? "married" : ""}">
                            <span class="ck3-gender ${genderClass}">${genderIcon}</span>
                            ${RobloxAvatar.img(child.robloxId, 48, "ck3-avatar")}
                            <span class="ck3-member-name">${child.name.split(' ').pop()}</span>
                            ${marriedBadge}
                        </div>
                    `;
                }).join("")}
            </div>
        `;
    },

    renderAlliances(clanId, allies) {
        const container = document.getElementById("clan-alliances-bar");
        if (allies.length === 0) {
            container.innerHTML = `
                <div class="ck3-family-header">Alliances</div>
                <div class="empty-state" style="padding: 6px; font-size: 10px;">No marriage alliances</div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="ck3-family-header">Alliances (${allies.length})</div>
            <div class="ck3-alliance-row">
                ${allies.map(aId => {
                    const ally = GameState.getClan(aId);
                    const allyFamily = CLAN_FAMILIES[aId];
                    return `
                        <div class="ck3-alliance-chip" onclick="ClanPanel.show('${aId}')" title="${ally.japaneseName} ${ally.name}">
                            ${allyFamily ? RobloxAvatar.img(allyFamily.leader.robloxId, 24, "ck3-ally-avatar") : ""}
                            <span class="ck3-ally-name" style="color: ${ally.color}">${ally.name}</span>
                        </div>
                    `;
                }).join("")}
            </div>
        `;
    }
};
