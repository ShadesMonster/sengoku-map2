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
        document.getElementById("clan-panel").classList.remove("hidden");
        this.closeMemberPopup();
        this.render(clanId);
    },

    hide() {
        document.getElementById("clan-panel").classList.add("hidden");
        this.closeMemberPopup();
        this.currentClan = null;
    },

    render(clanId) {
        const clan = GameState.getClan(clanId);
        const family = GameState.getFamily(clanId);
        if (!clan || !family) return;

        const ownedProvinces = GameState.getOwnedProvinces(clanId);
        const totalTroops = GameState.getTotalTroops(clanId) + ArmySystem.getTroopsInBattle(clanId);
        const allies = GameState.getAllies(clanId);
        const isOwnClan = clanId === GameState.selectedClan;

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

        // Family grid (Parents / Children / Siblings)
        this.renderFamily(clanId, family);

        // Alliances
        this.renderAlliances(clanId, allies);

        // Proposals (only for own clan)
        this.renderProposals(clanId, isOwnClan);
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
                        <div class="ck3-spouse-portrait" onclick="ClanPanel.showMemberPopup('${spouseId}', this)" title="${spouse.name}">
                            ${RobloxAvatar.img(spouse.robloxId, 48, "ck3-avatar")}
                            <span class="ck3-spouse-label">Spouse</span>
                        </div>
                    `;
                }
            }
        }

        const homeProv = PROVINCE_MAP[clan.castleProvince];
        document.getElementById("clan-portrait-area").innerHTML = `
            <div class="ck3-leader-portrait" onclick="ClanPanel.showMemberPopup('${leader.id}', this)">
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

    _renderMemberCard(person, clanId) {
        const married = Diplomacy.isMarried(person.id);
        const genderIcon = person.gender === "male" ? "&#9794;" : "&#9792;";
        const genderClass = person.gender;
        const isDaimyo = !!person.title;
        const shortName = isDaimyo ? person.name : person.name.split(' ').pop();

        let marriedBadge = "";
        if (married) {
            const alliance = GameState.alliances.find(a =>
                a.person1 === person.id || a.person2 === person.id
            );
            if (alliance) {
                const spouseId = alliance.person1 === person.id ? alliance.person2 : alliance.person1;
                const spouse = Diplomacy.getPerson(spouseId);
                if (spouse) {
                    marriedBadge = `<span class="ck3-married-badge">&#10084;</span>`;
                }
            }
        }

        return `
            <div class="ck3-family-member ${married ? "married" : ""} ${isDaimyo ? "daimyo" : ""}"
                 onclick="ClanPanel.showMemberPopup('${person.id}', this)" title="${person.name}">
                <span class="ck3-gender ${genderClass}">${genderIcon}</span>
                ${RobloxAvatar.img(person.robloxId, 48, "ck3-avatar")}
                <span class="ck3-member-name">${shortName}</span>
                ${marriedBadge}
            </div>
        `;
    },

    renderFamily(clanId, family) {
        const container = document.getElementById("clan-family-grid");
        const leader = family.leader;
        const children = family.children;

        // Separate children by gender to approximate siblings concept
        // "Daimyo" section = the leader (parent)
        // "Children" section = the children
        let html = "";

        // Daimyo (Parent)
        html += `<div class="ck3-family-section">`;
        html += `<div class="ck3-family-header">Daimyo</div>`;
        html += `<div class="ck3-family-row">`;
        html += this._renderMemberCard(leader, clanId);
        html += `</div></div>`;

        // Children
        if (children.length > 0) {
            html += `<div class="ck3-family-section">`;
            html += `<div class="ck3-family-header">Children (${children.length})</div>`;
            html += `<div class="ck3-family-row">`;
            children.forEach(child => {
                html += this._renderMemberCard(child, clanId);
            });
            html += `</div></div>`;
        }

        container.innerHTML = html;
    },

    // Member popup - shows detail when clicking a family member
    showMemberPopup(personId, element) {
        event.stopPropagation();
        const person = Diplomacy.getPerson(personId);
        if (!person) return;

        const popup = document.getElementById("member-popup");
        const clan = GameState.getClan(person.clanId);
        const married = Diplomacy.isMarried(personId);
        const isDaimyo = !!person.title;
        const myClan = GameState.selectedClan;
        const isOtherClan = myClan && person.clanId !== myClan;

        let spouseInfo = "";
        if (married) {
            const alliance = GameState.alliances.find(a =>
                a.person1 === personId || a.person2 === personId
            );
            if (alliance) {
                const spouseId = alliance.person1 === personId ? alliance.person2 : alliance.person1;
                const spouse = Diplomacy.getPerson(spouseId);
                if (spouse) {
                    const spouseClan = GameState.getClan(spouse.clanId);
                    spouseInfo = `
                        <div class="popup-spouse">
                            <span class="marriage-heart">&#10084;</span>
                            ${RobloxAvatar.img(spouse.robloxId, 28, "ck3-avatar")}
                            <div>
                                <div class="popup-spouse-name">${spouse.name}</div>
                                <div class="popup-spouse-clan" style="color: ${spouseClan ? spouseClan.color : '#888'}">${spouseClan ? spouseClan.name : '?'}</div>
                            </div>
                        </div>
                    `;
                }
            }
        }

        // Marriage action: show if this is another clan's unmarried member and player has opposite-sex unmarried members
        let actionHtml = "";
        if (!married && isOtherClan) {
            const myUnmarried = Diplomacy.getUnmarriedMembers(myClan)
                .filter(m => m.gender !== person.gender); // opposite sex only
            if (myUnmarried.length > 0) {
                actionHtml = `
                    <div class="popup-action">
                        <label>Propose marriage with:</label>
                        <select id="popup-my-member">
                            ${myUnmarried.map(m => {
                                const icon = m.gender === "male" ? "&#9794;" : "&#9792;";
                                const tag = m.title ? " (Daimyo)" : "";
                                return `<option value="${m.id}">${icon} ${m.name}${tag}</option>`;
                            }).join("")}
                        </select>
                        <button class="small-btn commit" onclick="ClanPanel.proposeFromPopup('${personId}')">Propose Marriage</button>
                    </div>
                `;
            } else if (Diplomacy.getUnmarriedMembers(myClan).length === 0) {
                actionHtml = `<div class="popup-status">No unmarried family members available</div>`;
            }
        }

        const genderIcon = person.gender === "male" ? "&#9794;" : "&#9792;";

        popup.innerHTML = `
            <div class="popup-header">
                ${RobloxAvatar.img(person.robloxId, 44, "ck3-avatar")}
                <div class="popup-info">
                    <div class="popup-name">${person.name} <span class="ck3-gender ${person.gender}" style="position:static;background:none;border:none">${genderIcon}</span></div>
                    <div class="popup-role" style="color: ${clan ? clan.color : '#888'}">${isDaimyo ? "Daimyo" : "Child"} — ${clan ? clan.name : "?"}</div>
                    <div class="popup-status-text">${married ? "Married" : "Unmarried"}</div>
                </div>
            </div>
            ${spouseInfo}
            ${actionHtml}
        `;

        popup.classList.remove("hidden");
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
            this.closeMemberPopup();
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
