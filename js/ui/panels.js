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
        const isCapital = ownerClan && ownerClan.castleProvince === provinceId;
        const isProtected = GameState.isProtectedProvince(provinceId);
        let terrainText = isCapital
            ? `${CASTLE_SIEGE.icon} Castle Siege`
            : `${terrain.icon} ${terrain.battleType}`;
        if (isProtected) terrainText += " (Imperial)";
        document.getElementById("panel-terrain-value").textContent = terrainText;

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

        // Permission check — only daimyo, delegates, and admin can act
        if (!Auth.canMoveArmies(clanId)) {
            container.innerHTML = '<div class="empty-state">No map access. Ask your Daimyo to use /clan delegate in Discord.</div>';
            return;
        }

        const state = GameState.provinces[provinceId];
        const clan = GameState.getClan(clanId);
        const hasTroops = ArmySystem.getArmyInProvince(clanId, provinceId) > 0;
        const ownsProvince = state.owner === clanId;

        // Check if clan has committed orders (locks out new moves)
        const hasCommittedOrders = GameState.orders.some(o => o.clanId === clanId && o.status === "committed");

        // Planning phase actions
        if (GameState.phase === "planning") {
            if (hasCommittedOrders) {
                container.innerHTML = '<div class="empty-state">Orders committed for this week. Uncommit to make changes.</div>';
            }

            // Raise Levy (only in owned provinces, and not locked)
            if (ownsProvince && !hasCommittedOrders) {
                const rallyInfo = ArmySystem.getRallyInfo(clanId);
                const btn = this.createButton(
                    `Raise Levy (${rallyInfo.available.toLocaleString()} available)`,
                    "action-btn raise-levy",
                    () => this.showRaiseLevyDialog(clanId, provinceId)
                );
                if (rallyInfo.available <= 0) btn.disabled = true;
                container.appendChild(btn);
            }

            // Move Army (if has troops here, and not locked)
            if (hasTroops && !hasCommittedOrders) {
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

            // Gift province (to allies, and not locked)
            if (ownsProvince && !hasCommittedOrders) {
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
    viewingCharacterId: null, // null = show clan leader

    init() {
        document.getElementById("clan-panel-close").addEventListener("click", () => {
            this.hide();
            document.getElementById("side-panel").classList.add("hidden");
            if (MapInteraction.selectedProvince) {
                MapRenderer.highlightProvince(MapInteraction.selectedProvince, false);
                MapInteraction.selectedProvince = null;
            }
        });

        // Close member popup when clicking outside
        document.getElementById("clan-panel-content").addEventListener("click", (e) => {
            if (!e.target.closest(".ck3-family-member") && !e.target.closest("#member-popup")) {
                this.closeMemberPopup();
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
        this.viewingCharacterId = null; // reset to leader
        document.getElementById("clan-panel").classList.remove("hidden");
        this.closeMemberPopup();
        this.render(clanId);
    },

    hide() {
        document.getElementById("clan-panel").classList.add("hidden");
        this.closeMemberPopup();
        this.currentClan = null;
        this.viewingCharacterId = null;
    },

    // Navigate to a character's profile
    viewCharacter(personId) {
        const person = Diplomacy.getPerson(personId);
        if (!person) return;

        // If from a different clan, switch to that clan
        if (person.clanId !== this.currentClan) {
            this.currentClan = person.clanId;
            document.getElementById("clan-panel").classList.remove("hidden");
        }

        this.viewingCharacterId = personId;
        this.closeMemberPopup();
        this.render(this.currentClan);
    },

    render(clanId) {
        const clan = GameState.getClan(clanId);
        const family = GameState.getFamily(clanId);
        if (!clan || !family) return;

        const ownedProvinces = GameState.getOwnedProvinces(clanId);
        const totalTroops = GameState.getTotalTroops(clanId) + ArmySystem.getTroopsInBattle(clanId);
        const allies = GameState.getAllies(clanId);
        const isOwnClan = clanId === GameState.selectedClan;

        // Portrait area — shows viewing character (or leader)
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

        // Family sections — Parents / Spouse / Children / Siblings
        this.renderFamily(clanId, family);

        // Alliances
        this.renderAlliances(clanId, allies);

        // Proposals (only for own clan)
        this.renderProposals(clanId, isOwnClan);
    },

    // Get the currently viewed person
    _getViewingPerson(family) {
        if (this.viewingCharacterId) {
            const person = Diplomacy.getPerson(this.viewingCharacterId);
            if (person) return person;
        }
        return family.leader;
    },

    renderPortrait(clan, family) {
        const person = this._getViewingPerson(family);
        const isLeader = person.id === family.leader.id;
        const spouse = this._getSpouse(person.id);
        const isDeceased = !!person.deceased;

        let spouseHtml = "";
        if (spouse) {
            spouseHtml = `
                <div class="ck3-spouse-portrait" onclick="ClanPanel.viewCharacter('${spouse.id}')" title="${spouse.name}">
                    ${RobloxAvatar.img(spouse.robloxId, 48, "ck3-avatar")}
                    <span class="ck3-spouse-label">Spouse</span>
                </div>
            `;
        }

        let backLink = "";
        if (!isLeader) {
            backLink = `<div class="ck3-back-link" onclick="ClanPanel.viewCharacter('${family.leader.id}')">&#8592; ${family.leader.name}</div>`;
        }

        const homeProv = PROVINCE_MAP[clan.castleProvince];
        const currentClanId = this.currentClan || "";
        const isImperial = clan && clan.isImperial;
        const leaderTitle = isImperial ? "Emperor" : "Daimyo";
        const title = person.title || (isLeader ? leaderTitle : "");
        const role = isLeader ? leaderTitle : "Family Member";

        document.getElementById("clan-portrait-area").innerHTML = `
            ${backLink}
            <div class="ck3-leader-portrait">
                ${RobloxAvatar.img(person.robloxId, 100, "ck3-avatar")}
                ${spouseHtml}
            </div>
            <div class="ck3-leader-details">
                <div class="ck3-leader-name">${person.name}${isDeceased ? ' <span style="color:#888;font-size:11px">(Deceased)</span>' : ''}</div>
                <div class="ck3-clan-name" style="color: ${clan.color}">${clan.japaneseName} ${clan.name}</div>
                <div class="ck3-leader-title">${title || role}</div>
                ${isLeader && homeProv ? `<div class="ck3-capital-badge">&#x1F3EF; ${homeProv.japaneseName} ${homeProv.name}</div>` : ""}
            </div>
        `;
    },

    _renderMemberCard(person, clanId) {
        const married = Diplomacy.isMarried(person.id);
        const genderIcon = person.gender === "male" ? "&#9794;" : "&#9792;";
        const genderClass = person.gender;
        const isDaimyo = !!person.title;
        const isDeceased = !!person.deceased;
        const shortName = isDaimyo ? person.name : person.name.split(' ').pop();

        let marriedBadge = "";
        if (married) {
            marriedBadge = `<span class="ck3-married-badge">&#10084;</span>`;
        }

        return `
            <div class="ck3-family-member ${married ? "married" : ""} ${isDaimyo ? "daimyo" : ""} ${isDeceased ? "deceased" : ""}"
                 onclick="ClanPanel.viewCharacter('${person.id}')" title="${person.name}${isDeceased ? ' (Deceased)' : ''}">
                <span class="ck3-gender ${genderClass}">${genderIcon}</span>
                ${RobloxAvatar.img(person.robloxId, 48, "ck3-avatar")}
                <span class="ck3-member-name">${shortName}${isDeceased ? ' +' : ''}</span>
                ${marriedBadge}
            </div>
        `;
    },

    // === Family relation helpers ===

    _getSpouse(personId) {
        const marriage = GameState.alliances.find(a =>
            a.person1 === personId || a.person2 === personId
        );
        if (!marriage) return null;
        const spouseId = marriage.person1 === personId ? marriage.person2 : marriage.person1;
        return Diplomacy.getPerson(spouseId);
    },

    _getAllFamilyMembers(clanId) {
        const family = CLAN_FAMILIES[clanId];
        if (!family) return [];
        const dynKids = GameState.dynamicChildren[clanId] || [];
        const deceased = GameState.deceasedMembers[clanId] || [];
        // Deduplicate by id (dynKids may overlap with family.children after DB reload)
        const seen = new Set(family.children.map(c => c.id));
        const uniqueDyn = dynKids.filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true; });
        const uniqueDeceased = deceased.filter(d => !seen.has(d.id));
        return [...family.children, ...uniqueDyn, ...uniqueDeceased];
    },

    _getParents(personId, clanId) {
        const family = CLAN_FAMILIES[clanId];
        if (!family) return [];

        const allMembers = this._getAllFamilyMembers(clanId);
        const person = allMembers.find(m => m.id === personId);

        // Check if this person has a parentId
        let parentId = person?.parentId;

        // If no parentId and this person is a direct child (not the leader), assume leader is parent
        if (!parentId && person && family.leader.id !== personId) {
            // Only if they're a direct child with no explicit parent
            const hasExplicitParent = allMembers.some(m => m.parentId);
            if (!hasExplicitParent) {
                parentId = family.leader.id;
            }
        }

        if (!parentId) return [];

        const parent = Diplomacy.getPerson(parentId);
        if (!parent) return [];

        const parents = [parent];
        const spouse = this._getSpouse(parentId);
        if (spouse) parents.push(spouse);

        return parents;
    },

    _getChildren(personId, clanId) {
        const family = CLAN_FAMILIES[clanId];
        if (!family) return [];

        const allMembers = this._getAllFamilyMembers(clanId);

        return allMembers.filter(c => {
            if (c.parentId) return c.parentId === personId;
            // No explicit parentId — belongs to the leader
            return personId === family.leader.id;
        });
    },

    _getSiblings(personId, clanId) {
        const family = CLAN_FAMILIES[clanId];
        if (!family) return [];

        const allMembers = this._getAllFamilyMembers(clanId);
        const person = allMembers.find(c => c.id === personId);

        if (!person) {
            if (family.leader.id === personId) return [];
            return [];
        }

        return allMembers.filter(c => {
            if (c.id === personId) return false;
            // Both have explicit parents — siblings if same parent
            if (c.parentId && person.parentId) return c.parentId === person.parentId;
            // Both have no parent — siblings under the leader
            if (!c.parentId && !person.parentId) return true;
            return false;
        });
    },

    renderFamily(clanId, family) {
        const container = document.getElementById("clan-family-grid");
        const person = this._getViewingPerson(family);
        const viewId = person.id;

        let html = '';

        // --- Parents ---
        const parents = this._getParents(viewId, clanId);
        if (parents.length > 0) {
            html += `<div class="ck3-family-header">Parents</div>`;
            html += `<div class="ftree-couple">`;
            parents.forEach((p, i) => {
                if (i > 0) html += `<span class="ftree-heart">&#10084;</span>`;
                html += this._renderMemberCard(p, p.clanId || clanId);
            });
            html += `</div>`;
        }

        // --- Spouse ---
        const spouse = this._getSpouse(viewId);
        if (spouse) {
            html += `<div class="ck3-family-header">Spouse</div>`;
            html += `<div class="ftree-couple">`;
            html += this._renderMemberCard(spouse, spouse.clanId || clanId);
            html += `</div>`;
        }

        // --- Marriage proposal action ---
        if (!spouse && !person.deceased) {
            const myClan = GameState.selectedClan;
            const isOtherClan = myClan && person.clanId !== myClan;
            if (isOtherClan) {
                const myUnmarried = Diplomacy.getUnmarriedMembers(myClan)
                    .filter(m => m.gender !== person.gender);
                if (myUnmarried.length > 0) {
                    html += `
                        <div class="ck3-family-header">Marriage</div>
                        <div class="popup-action" style="padding:0 0 6px">
                            <select id="popup-my-member" style="padding:4px 6px;background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary);border-radius:4px;font-size:11px">
                                ${myUnmarried.map(m => {
                                    const icon = m.gender === "male" ? "&#9794;" : "&#9792;";
                                    const myIsImperial = GameState.clans[myClan] && GameState.clans[myClan].isImperial;
                                    const tag = m.title ? ` (${myIsImperial ? "Emperor" : "Daimyo"})` : "";
                                    return `<option value="${m.id}">${icon} ${m.name}${tag}</option>`;
                                }).join("")}
                            </select>
                            <button class="small-btn commit" onclick="ClanPanel.proposeFromPopup('${viewId}')">Propose Marriage</button>
                        </div>
                    `;
                }
            }
        }

        // --- Children ---
        const children = this._getChildren(viewId, clanId);
        if (children.length > 0) {
            html += `<div class="ck3-family-header">Children (${children.length})</div>`;
            html += `<div class="ftree-children" style="border-top:none;padding-top:0">`;
            children.forEach(child => {
                const childSpouse = this._getSpouse(child.id);
                if (childSpouse) {
                    html += `<div class="ftree-child-pair">`;
                    html += this._renderMemberCard(child, clanId);
                    html += `<span class="ftree-heart-sm">&#10084;</span>`;
                    html += this._renderMemberCard(childSpouse, childSpouse.clanId || clanId);
                    html += `</div>`;
                } else {
                    html += this._renderMemberCard(child, clanId);
                }
            });
            html += `</div>`;
        }

        // --- Siblings ---
        const siblings = this._getSiblings(viewId, clanId);
        if (siblings.length > 0) {
            html += `<div class="ck3-family-header">Siblings (${siblings.length})</div>`;
            html += `<div class="ftree-children" style="border-top:none;padding-top:0">`;
            siblings.forEach(sib => html += this._renderMemberCard(sib, clanId));
            html += `</div>`;
        }

        if (!html) {
            html = '<div class="empty-state">No family relations</div>';
        }

        container.innerHTML = html;
    },

    // Member popup (kept for detailed view / legacy)
    showMemberPopup(personId, element) {
        event.stopPropagation();
        this.viewCharacter(personId);
    },

    closeMemberPopup() {
        document.getElementById("member-popup").classList.add("hidden");
    },

    proposeFromPopup(targetPersonId) {
        const myClan = GameState.selectedClan;
        if (!myClan) return;

        const myMemberId = document.getElementById("popup-my-member").value;
        const targetPerson = Diplomacy.getPerson(targetPersonId);
        if (!myMemberId || !targetPerson) return;

        const result = Diplomacy.proposeMarriage(myClan, myMemberId, targetPerson.clanId, targetPersonId);
        if (result.success) {
            Notifications.show("Marriage proposal sent!", "success");
            this.render(this.currentClan);
        } else {
            Notifications.show(result.error, "error");
        }
    },

    renderAlliances(clanId, allies) {
        const container = document.getElementById("clan-alliances-bar");
        const isOwnClan = clanId === GameState.selectedClan;

        // Gather all individual marriages for this clan
        const allMarriages = GameState.alliances.filter(a =>
            a.clan1 === clanId || a.clan2 === clanId
        );

        if (allMarriages.length === 0) {
            container.innerHTML = `
                <div class="ck3-family-header">Alliances</div>
                <div class="empty-state" style="padding: 6px; font-size: 10px;">No marriage alliances</div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="ck3-family-header">Marriages (${allMarriages.length})</div>
            <div class="ck3-alliance-row">
                ${allMarriages.map(a => {
                    const p1 = Diplomacy.getPerson(a.person1);
                    const p2 = Diplomacy.getPerson(a.person2);
                    const allyClanId = a.clan1 === clanId ? a.clan2 : a.clan1;
                    const ally = GameState.getClan(allyClanId);
                    const title = `${p1 ? p1.name : "?"} & ${p2 ? p2.name : "?"} (${ally ? ally.name : "?"})`;
                    return `
                        <div class="ck3-alliance-chip" onclick="ClanPanel.show('${allyClanId}')" title="${title}">
                            ${p1 ? RobloxAvatar.img(p1.robloxId, 24, "ck3-ally-avatar") : ""}
                            <span class="marriage-heart" style="font-size:10px">&#10084;</span>
                            ${p2 ? RobloxAvatar.img(p2.robloxId, 24, "ck3-ally-avatar") : ""}
                            <span class="ck3-ally-name" style="color: ${ally ? ally.color : '#888'}">${ally ? ally.name : "?"}</span>
                            ${isOwnClan ? `<span class="ck3-dissolve" onclick="event.stopPropagation(); ClanPanel.dissolveMarriage('${a.person1}', '${a.person2}')" title="Dissolve">&times;</span>` : ""}
                        </div>
                    `;
                }).join("")}
            </div>
        `;
    },

    renderProposals(clanId, isOwnClan) {
        const container = document.getElementById("clan-proposals-bar");
        if (!isOwnClan) {
            container.innerHTML = "";
            return;
        }

        const pending = Diplomacy.getPendingRequests(clanId);
        const sent = Diplomacy.getSentRequests(clanId);

        if (pending.length === 0 && sent.length === 0) {
            container.innerHTML = "";
            return;
        }

        let html = `<div class="ck3-family-header">Proposals</div>`;

        pending.forEach(r => {
            const fromClan = GameState.getClan(r.from);
            const fromPerson = Diplomacy.getPerson(r.fromPerson);
            const toPerson = Diplomacy.getPerson(r.toPerson);
            html += `
                <div class="ck3-proposal-card incoming">
                    <div class="ck3-proposal-people">
                        ${fromPerson ? RobloxAvatar.img(fromPerson.robloxId, 28, "ck3-avatar") : ""}
                        <span class="marriage-heart">&#10084;</span>
                        ${toPerson ? RobloxAvatar.img(toPerson.robloxId, 28, "ck3-avatar") : ""}
                    </div>
                    <div class="ck3-proposal-info">
                        <span>${fromPerson ? fromPerson.name : "?"} &amp; ${toPerson ? toPerson.name : "?"}</span>
                        <span class="ck3-proposal-from" style="color: ${fromClan ? fromClan.color : '#888'}">from ${fromClan ? fromClan.name : "?"}</span>
                    </div>
                    <div class="ck3-proposal-actions">
                        <button class="small-btn commit" onclick="ClanPanel.acceptProposal('${r.id}')">&#10003;</button>
                        <button class="small-btn cancel" onclick="ClanPanel.rejectProposal('${r.id}')">&#10005;</button>
                    </div>
                </div>
            `;
        });

        sent.forEach(r => {
            const toClan = GameState.getClan(r.to);
            const fromPerson = Diplomacy.getPerson(r.fromPerson);
            const toPerson = Diplomacy.getPerson(r.toPerson);
            html += `
                <div class="ck3-proposal-card sent">
                    <div class="ck3-proposal-people">
                        ${fromPerson ? RobloxAvatar.img(fromPerson.robloxId, 24, "ck3-avatar") : ""}
                        <span class="marriage-heart">&#10084;</span>
                        ${toPerson ? RobloxAvatar.img(toPerson.robloxId, 24, "ck3-avatar") : ""}
                    </div>
                    <div class="ck3-proposal-info">
                        <span class="ck3-proposal-from" style="color: ${toClan ? toClan.color : '#888'}">Sent to ${toClan ? toClan.name : "?"}</span>
                    </div>
                    <span class="status-pending">Pending</span>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    acceptProposal(requestId) {
        const result = Diplomacy.acceptMarriage(requestId);
        if (result.success) {
            this.render(this.currentClan);
            MapRenderer.update();
        } else {
            Notifications.show(result.error, "error");
        }
    },

    rejectProposal(requestId) {
        const result = Diplomacy.rejectMarriage(requestId);
        if (result.success) {
            this.render(this.currentClan);
        } else {
            Notifications.show(result.error, "error");
        }
    },

    dissolveMarriage(person1Id, person2Id) {
        if (!confirm("Dissolve this marriage?")) return;
        const result = Diplomacy.dissolveMarriageByPersons(person1Id, person2Id);
        if (result.success) {
            this.render(this.currentClan);
            MapRenderer.update();
        }
    }
};
