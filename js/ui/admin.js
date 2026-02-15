// Admin Panel - Game master controls
const Admin = {
    init() {
        document.getElementById("btn-admin").addEventListener("click", () => {
            this.toggle();
        });

        document.querySelector("#admin-panel .overlay-close").addEventListener("click", () => {
            document.getElementById("admin-panel").classList.add("hidden");
        });

        // Phase controls
        document.getElementById("admin-toggle-phase").addEventListener("click", () => {
            this.togglePhase();
        });

        document.getElementById("admin-process-moves").addEventListener("click", () => {
            this.processMoves();
        });

        document.getElementById("admin-advance-week").addEventListener("click", () => {
            this.advanceWeek();
        });

        // Province management
        document.getElementById("admin-set-owner").addEventListener("click", () => {
            this.setProvinceOwner();
        });

        document.getElementById("admin-set-army").addEventListener("click", () => {
            this.setArmyInProvince();
        });

        document.getElementById("admin-remove-army").addEventListener("click", () => {
            this.removeArmyFromProvince();
        });

        // Family management
        document.getElementById("admin-add-child").addEventListener("click", () => {
            this.addChild();
        });
    },

    toggle() {
        const panel = document.getElementById("admin-panel");
        const wasHidden = panel.classList.contains("hidden");
        closeAllOverlays("admin-panel");
        if (wasHidden) {
            panel.classList.remove("hidden");
            this.render();
        } else {
            panel.classList.add("hidden");
        }
    },

    render() {
        this.populateProvinceSelect();
        this.populateClanSelects();
        this.renderClanList();
        this.renderFamilyList();
        this.renderBattleList();
    },

    populateProvinceSelect() {
        const select = document.getElementById("admin-province-select");
        select.innerHTML = PROVINCES
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(p => `<option value="${p.id}">${p.name} (${p.japaneseName})</option>`)
            .join("");
    },

    populateClanSelects() {
        const clans = Object.values(GameState.clans);
        const options = '<option value="">None</option>' +
            clans.map(c => `<option value="${c.id}">${c.name}</option>`).join("");

        document.getElementById("admin-province-owner-select").innerHTML = options;
        document.getElementById("admin-army-clan-select").innerHTML =
            clans.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
        document.getElementById("admin-family-clan-select").innerHTML =
            clans.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
    },

    renderClanList() {
        const list = document.getElementById("admin-clan-list");
        const clans = Object.values(GameState.clans);

        if (clans.length === 0) {
            list.innerHTML = '<div class="empty-state">No clans loaded from database</div>';
            return;
        }

        const provinceOptions = PROVINCES
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(p => `<option value="${p.id}">${p.name}</option>`)
            .join("");

        list.innerHTML = clans.map(c => {
            const provinces = GameState.getOwnedProvinces(c.id).length;
            const troops = GameState.getTotalTroops(c.id) + ArmySystem.getTroopsInBattle(c.id);
            const castleName = c.castleProvince && PROVINCE_MAP[c.castleProvince]
                ? PROVINCE_MAP[c.castleProvince].name : "None";
            return `
                <div class="admin-clan-entry" style="border-left: 3px solid ${c.color}">
                    <div class="clan-info">
                        <strong style="color: ${c.color}">${c.japaneseName} ${c.name}</strong>
                        <span>${provinces} provinces, ${troops} troops</span>
                    </div>
                    <div class="clan-controls">
                        <label>Display:</label>
                        <input type="color" value="${c.color}" class="clan-color-input" data-clan="${c.id}"/>
                        <input type="text" value="${c.japaneseName}" placeholder="Japanese name"
                               class="clan-jpname-input" data-clan="${c.id}" style="width:70px"/>
                        <button class="small-btn" onclick="Admin.updateClanDisplay('${c.id}')">Save</button>
                    </div>
                    <div class="clan-controls">
                        <label>Castle:</label>
                        <select class="castle-select" data-clan="${c.id}" data-dbid="${c.dbClanId}">
                            <option value="">None</option>
                            ${provinceOptions.replace(
                                new RegExp(`value="${c.castleProvince}"`),
                                `value="${c.castleProvince}" selected`
                            )}
                        </select>
                        <button class="small-btn" onclick="Admin.setCastle('${c.id}')">Set</button>
                    </div>
                    <div class="clan-controls">
                        <label>Rally Cap:</label>
                        <input type="number" value="${c.rallyCap}" min="100" max="50000"
                               class="rally-input" data-clan="${c.id}"/>
                        <button class="small-btn" onclick="Admin.updateRallyCap('${c.id}')">Set</button>
                    </div>
                    <div class="clan-controls">
                        <label class="imperial-label">
                            <input type="checkbox" class="imperial-check" data-clan="${c.id}"
                                ${c.castleProvince && GameState.protectedProvinces[c.castleProvince] === c.id ? 'checked' : ''}/>
                            Imperial (can't be conquered)
                        </label>
                    </div>
                    <div class="clan-controls">
                        <button class="small-btn spawn-btn" onclick="Admin.spawnClan('${c.id}')"
                            ${!c.castleProvince ? 'disabled title="Set a castle first"' : ''}>
                            Spawn at ${c.castleProvince ? (PROVINCE_MAP[c.castleProvince]?.name || c.castleProvince) : '—'}
                        </button>
                        <button class="small-btn danger" onclick="Admin.despawnClan('${c.id}')">Despawn</button>
                    </div>
                </div>
            `;
        }).join("");
    },

    async setCastle(clanId) {
        const select = document.querySelector(`.castle-select[data-clan="${clanId}"]`);
        if (!select) return;

        const provinceId = select.value || null;
        const dbClanId = select.dataset.dbid;
        const clan = GameState.getClan(clanId);

        // Save to database
        try {
            await API.updateClanSettings(dbClanId, { castleProvince: provinceId });
        } catch (err) {
            Notifications.show("Failed to save castle: " + err.message, "error");
            return;
        }

        // Update local state
        clan.castleProvince = provinceId;
        GameState.save();
        MapRenderer.update();

        const provName = provinceId && PROVINCE_MAP[provinceId]
            ? PROVINCE_MAP[provinceId].name : "None";
        Notifications.show(`${clan.name} castle set to ${provName}`, "info");
        GameState.addHistory("system", `Admin set ${clan.name} castle to ${provName}`);
    },

    spawnClan(clanId) {
        const clan = GameState.getClan(clanId);
        if (!clan || !clan.castleProvince) {
            Notifications.show("Set a castle province first", "error");
            return;
        }

        const provId = clan.castleProvince;
        const province = GameState.provinces[provId];
        const provName = PROVINCE_MAP[provId]?.name || provId;

        // Check imperial checkbox
        const imperialCheck = document.querySelector(`.imperial-check[data-clan="${clanId}"]`);
        const isImperial = imperialCheck && imperialCheck.checked;

        // Set ownership
        province.owner = clanId;

        // Place starting army (half the rally cap)
        const startingTroops = Math.floor(clan.rallyCap / 2);
        province.armies[clanId] = startingTroops;

        // Set/clear protected status
        if (isImperial) {
            GameState.protectedProvinces[provId] = clanId;
        } else {
            delete GameState.protectedProvinces[provId];
        }

        GameState.save();
        MapRenderer.update();
        this.render();

        const imperialMsg = isImperial ? " (Imperial — protected)" : "";
        GameState.addHistory("system", `Admin spawned ${clan.name} at ${provName} with ${startingTroops} troops${imperialMsg}`);
        Notifications.show(`${clan.name} spawned at ${provName} with ${startingTroops} troops${imperialMsg}`, "success");
    },

    despawnClan(clanId) {
        const clan = GameState.getClan(clanId);
        if (!clan) return;

        if (!confirm(`Remove ${clan.name} from all provinces and clear their armies?`)) return;

        // Remove ownership of all provinces and clear protected status
        Object.entries(GameState.provinces).forEach(([provId, prov]) => {
            if (prov.owner === clanId) {
                prov.owner = null;
            }
            delete prov.armies[clanId];
            if (GameState.protectedProvinces[provId] === clanId) {
                delete GameState.protectedProvinces[provId];
            }
        });

        GameState.save();
        MapRenderer.update();
        this.render();

        GameState.addHistory("system", `Admin despawned ${clan.name} — removed from all provinces`);
        Notifications.show(`${clan.name} removed from all provinces`, "warning");
    },

    renderBattleList() {
        const list = document.getElementById("admin-battle-list");
        const pending = BattleSystem.getPendingBattles();

        if (pending.length === 0) {
            list.innerHTML = '<div class="empty-state">No pending battles</div>';
            return;
        }

        list.innerHTML = pending.map(battle => {
            const icon = BattleSystem.getBattleIcon(battle.terrain);

            // Clan names for buttons
            const atkNames = battle.attacker.clans.map(c => GameState.getClan(c).name).join(" + ");
            const defNames = battle.defender.clans.map(c => GameState.getClan(c).name).join(" + ");
            const atkColor = GameState.getClan(battle.attacker.clans[0])?.color || "#e74c3c";
            const defColor = GameState.getClan(battle.defender.clans[0])?.color || "#3498db";

            // Attacker side display
            const atkSide = this._renderBattleSide(battle.attacker, "Attacker");
            const defSide = this._renderBattleSide(battle.defender, "Defender");

            // Bracket info
            let bracketHtml = "";
            if (battle.bracketRound) {
                bracketHtml = `<div class="battle-bracket-info">Bracket Round ${battle.bracketRound}</div>`;
            }

            // Chain info
            let chainHtml = "";
            if (battle.chainInfo) {
                chainHtml = `
                    <div class="battle-chain-info">
                        <div class="chain-row"><span class="chain-label">If ${atkNames} wins:</span> ${battle.chainInfo.attackerWinsNext}</div>
                        <div class="chain-row"><span class="chain-label">If ${defNames} wins:</span> ${battle.chainInfo.defenderWinsNext}</div>
                    </div>
                `;
            }

            // Waiting queue
            let waitingHtml = "";
            if (battle.waitingAttackers && battle.waitingAttackers.length > 0) {
                const waitList = battle.waitingAttackers.map(w => {
                    const names = w.clans.map(c => GameState.getClan(c).name).join(" + ");
                    const troops = Object.values(w.armyBreakdown).reduce((s, v) => s + v, 0);
                    return `${names} (${troops})`;
                }).join(", ");
                waitingHtml = `<div class="battle-waiting">Waiting: ${waitList}</div>`;
            }

            return `
                <div class="battle-card">
                    <div class="battle-header">
                        <strong>${icon} ${battle.battleType}</strong>
                        <span>at ${battle.provinceName}</span>
                    </div>
                    ${bracketHtml}
                    <div class="battle-sides">
                        ${atkSide}
                        <div class="battle-vs">VS</div>
                        ${defSide}
                    </div>
                    ${chainHtml}
                    ${waitingHtml}
                    <div class="battle-resolve">
                        <button class="admin-btn battle-resolve-btn" style="border-color:${atkColor};color:${atkColor}" onclick="Admin.resolveBattle('${battle.id}', 'attacker')"
                            onmouseenter="this.style.background='${atkColor}';this.style.color='#fff'"
                            onmouseleave="this.style.background='';this.style.color='${atkColor}'">
                            ${atkNames} Wins
                        </button>
                        <button class="admin-btn battle-resolve-btn" style="border-color:${defColor};color:${defColor}" onclick="Admin.resolveBattle('${battle.id}', 'defender')"
                            onmouseenter="this.style.background='${defColor}';this.style.color='#fff'"
                            onmouseleave="this.style.background='';this.style.color='${defColor}'">
                            ${defNames} Wins
                        </button>
                    </div>
                </div>
            `;
        }).join("");
    },

    _renderBattleSide(side, label) {
        const entries = side.clans.map(cid => {
            const clan = GameState.getClan(cid);
            const troops = side.armyBreakdown[cid] || 0;
            return `<span style="color:${clan.color}">${clan.name} <strong>${troops}</strong></span>`;
        }).join("<br>");

        return `
            <div class="battle-side">
                <div class="battle-side-label">${label}</div>
                <div class="battle-side-entries">${entries}</div>
                <div class="battle-side-total">Total: ${side.totalTroops}</div>
            </div>
        `;
    },

    togglePhase() {
        if (GameState.phase === "planning") {
            GameState.phase = "battle";
            GameState.addHistory("system", `Battle Phase begins! Week ${GameState.week}`);
        } else {
            GameState.phase = "planning";
            GameState.addHistory("system", `Planning Phase begins. Week ${GameState.week}`);
        }
        GameState.save();
        App.updateUI();
        Notifications.show(`Phase changed to: ${GameState.phase}`, "info");
    },

    processMoves() {
        const result = MoveSystem.processOrders();
        if (result.success) {
            Notifications.show(
                `Processed ${result.movesProcessed} moves. ${result.battlesGenerated} battles generated!`,
                "success"
            );
            MapRenderer.update();
            this.render();
        } else {
            Notifications.show(result.error, "error");
        }
    },

    advanceWeek() {
        GameState.week++;
        GameState.phase = "planning";
        GameState.orders = [];
        GameState.battles = GameState.battles.filter(b => b.status !== "resolved");
        GameState.pendingAttacks = [];
        BattleSystem.advanceRetreats();
        ArmySystem.recoverCasualties();
        GameState.addHistory("system", `Week ${GameState.week} begins. Planning Phase.`);
        GameState.save();
        App.updateUI();
        Notifications.show(`Advanced to Week ${GameState.week}`, "success");
    },

    setProvinceOwner() {
        const provId = document.getElementById("admin-province-select").value;
        const ownerId = document.getElementById("admin-province-owner-select").value;

        const province = GameState.provinces[provId];
        if (!province) return;

        // Warn if trying to change a protected province's owner
        if (GameState.isProtectedProvince(provId) && ownerId !== GameState.getProtectedOwner(provId)) {
            if (!confirm("This is an Imperial (protected) province. Change owner anyway? This will remove protection.")) return;
            delete GameState.protectedProvinces[provId];
        }

        province.owner = ownerId || null;
        GameState.save();
        MapRenderer.update();

        const provName = PROVINCE_MAP[provId].name;
        const ownerName = ownerId ? GameState.getClan(ownerId).name : "None";
        Notifications.show(`${provName} owner set to ${ownerName}`, "info");
        GameState.addHistory("system", `Admin set ${provName} owner to ${ownerName}`);
    },

    setArmyInProvince() {
        const provId = document.getElementById("admin-province-select").value;
        const clanId = document.getElementById("admin-army-clan-select").value;
        const count = parseInt(document.getElementById("admin-army-count").value);

        if (!provId || !clanId || isNaN(count)) return;

        ArmySystem.setArmy(clanId, provId, count);
        MapRenderer.update();

        const provName = PROVINCE_MAP[provId].name;
        const clanName = GameState.getClan(clanId).name;
        Notifications.show(`Set ${clanName} army in ${provName} to ${count}`, "info");
        GameState.addHistory("system", `Admin set ${clanName} army in ${provName} to ${count}`);
    },

    removeArmyFromProvince() {
        const provId = document.getElementById("admin-province-select").value;
        const clanId = document.getElementById("admin-army-clan-select").value;

        if (!provId || !clanId) return;

        ArmySystem.removeArmy(clanId, provId);
        MapRenderer.update();

        const provName = PROVINCE_MAP[provId].name;
        const clanName = GameState.getClan(clanId).name;
        Notifications.show(`Removed ${clanName} army from ${provName}`, "info");
    },

    async updateRallyCap(clanId) {
        const input = document.querySelector(`.rally-input[data-clan="${clanId}"]`);
        if (!input) return;

        const newCap = parseInt(input.value);
        if (isNaN(newCap) || newCap < 100) {
            Notifications.show("Invalid rally cap", "error");
            return;
        }

        const clan = GameState.getClan(clanId);

        // Save to database
        try {
            await API.updateClanSettings(clan.dbClanId, { rallyCap: newCap });
        } catch (err) {
            Notifications.show("Failed to save rally cap: " + err.message, "error");
            return;
        }

        clan.rallyCap = newCap;
        GameState.save();
        Notifications.show(`Rally cap updated for ${clan.name}`, "info");
    },

    async updateClanDisplay(clanId) {
        const colorInput = document.querySelector(`.clan-color-input[data-clan="${clanId}"]`);
        const jpNameInput = document.querySelector(`.clan-jpname-input[data-clan="${clanId}"]`);
        if (!colorInput || !jpNameInput) return;

        const clan = GameState.getClan(clanId);
        const newColor = colorInput.value;
        const newJpName = jpNameInput.value.trim();

        if (!newJpName) {
            Notifications.show("Japanese name cannot be empty", "error");
            return;
        }

        try {
            await API.updateClanSettings(clan.dbClanId, {
                color: newColor,
                japaneseName: newJpName,
            });
        } catch (err) {
            Notifications.show("Failed to save: " + err.message, "error");
            return;
        }

        clan.color = newColor;
        clan.japaneseName = newJpName;
        GameState.save();
        MapRenderer.update();
        this.renderClanList();
        Notifications.show(`${clan.name} display updated`, "info");
    },

    resolveBattle(battleId, winningSide) {
        const result = BattleSystem.resolveBattle(battleId, winningSide);

        if (result.success) {
            let msg = `${result.winner} wins! Defeated: ${result.losers.join(", ")}`;
            if (result.hasChainBattle) {
                msg += " — Chain battle created!";
            }
            Notifications.show(msg, "success");
            MapRenderer.update();
            this.render();
        } else {
            Notifications.show(result.error, "error");
        }
    },

    addChild() {
        const clanId = document.getElementById("admin-family-clan-select").value;
        const name = document.getElementById("admin-child-name").value.trim();
        const gender = document.getElementById("admin-child-gender").value;
        const robloxIdInput = document.getElementById("admin-child-robloxid").value.trim();

        if (!clanId) {
            Notifications.show("Select a clan", "error");
            return;
        }
        if (!name) {
            Notifications.show("Enter a child name", "error");
            return;
        }

        const robloxId = robloxIdInput ? parseInt(robloxIdInput) : DEFAULT_ROBLOX_ID;
        const childId = `${clanId}_child_${Date.now()}`;

        if (!GameState.dynamicChildren[clanId]) {
            GameState.dynamicChildren[clanId] = [];
        }

        GameState.dynamicChildren[clanId].push({
            id: childId,
            name: name,
            gender: gender,
            robloxId: robloxId
        });

        GameState.save();

        const clanName = GameState.getClan(clanId).name;
        GameState.addHistory("system", `Admin added child "${name}" to ${clanName}`);
        Notifications.show(`Added ${name} to ${clanName}`, "success");

        document.getElementById("admin-child-name").value = "";
        document.getElementById("admin-child-robloxid").value = "";

        this.renderFamilyList();

        if (ClanPanel.currentClan === clanId) {
            ClanPanel.render(clanId);
        }
    },

    removeChild(clanId, childId) {
        const children = GameState.dynamicChildren[clanId];
        if (!children) return;

        const idx = children.findIndex(c => c.id === childId);
        if (idx === -1) return;

        const child = children[idx];

        if (Diplomacy.isMarried(childId)) {
            const alliance = GameState.alliances.find(a =>
                a.person1 === childId || a.person2 === childId
            );
            if (alliance) {
                const spouseId = alliance.person1 === childId ? alliance.person2 : alliance.person1;
                Diplomacy.dissolveMarriageByPersons(childId, spouseId);
            }
        }

        GameState.allianceRequests = GameState.allianceRequests.filter(r =>
            r.fromPerson !== childId && r.toPerson !== childId
        );

        children.splice(idx, 1);
        GameState.save();

        const clanName = GameState.getClan(clanId).name;
        GameState.addHistory("system", `Admin removed child "${child.name}" from ${clanName}`);
        Notifications.show(`Removed ${child.name} from ${clanName}`, "warning");

        this.renderFamilyList();

        if (ClanPanel.currentClan === clanId) {
            ClanPanel.render(clanId);
        }
    },

    renderFamilyList() {
        const list = document.getElementById("admin-family-list");
        const allDynamic = Object.entries(GameState.dynamicChildren);

        if (allDynamic.length === 0 || allDynamic.every(([, kids]) => kids.length === 0)) {
            list.innerHTML = '<div class="empty-state">No admin-added children</div>';
            return;
        }

        list.innerHTML = allDynamic
            .filter(([, kids]) => kids.length > 0)
            .map(([clanId, kids]) => {
                const clan = GameState.getClan(clanId);
                if (!clan) return "";
                return `
                    <div class="admin-family-clan" style="border-left: 3px solid ${clan.color}; margin-bottom: 8px; padding-left: 8px;">
                        <strong style="color: ${clan.color}">${clan.name}</strong>
                        ${kids.map(child => {
                            const genderIcon = child.gender === "male" ? "♂" : "♀";
                            const married = Diplomacy.isMarried(child.id);
                            return `
                                <div class="admin-child-entry">
                                    <span>${genderIcon} ${child.name}${married ? " ❤" : ""}</span>
                                    <button class="small-btn danger" onclick="Admin.removeChild('${clanId}', '${child.id}')">Remove</button>
                                </div>
                            `;
                        }).join("")}
                    </div>
                `;
            }).join("");
    }
};
