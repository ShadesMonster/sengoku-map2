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
        document.getElementById("admin-next-phase").addEventListener("click", () => {
            this.nextPhase();
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

        // Reset game
        document.getElementById("admin-reset-game").addEventListener("click", () => {
            this.resetGame();
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
        this.renderBattleList();
        this.updatePhaseStatus();
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
                        <strong style="color: ${c.color}">${c.name}</strong>
                        <span>${provinces} provinces, ${troops} troops</span>
                    </div>
                    <div class="clan-controls">
                        <label>Colour:</label>
                        <input type="color" value="${c.color}" class="clan-color-input" data-clan="${c.id}"/>
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
                        <input type="number" value="${c.rallyCap}" min="0" max="50000"
                               class="rally-input" data-clan="${c.id}"/>
                        <button class="small-btn" onclick="Admin.updateRallyCap('${c.id}')">Set</button>
                    </div>
                    <div class="clan-controls">
                        <label class="imperial-label">
                            <input type="checkbox" class="imperial-check" data-clan="${c.id}"
                                ${c.castleProvince && GameState.protectedProvinces[c.castleProvince] === c.id ? 'checked' : ''}
                                onchange="Admin.onImperialToggle('${c.id}', this.checked)"/>
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

        if (isImperial) {
            // Imperial clans: no army, rally cap forced to 0, protected province
            clan.rallyCap = 0;
            clan.isImperial = true;
            delete province.armies[clanId];
            GameState.protectedProvinces[provId] = clanId;

            // Save rally cap and imperial status to DB
            API.updateClanSettings(clan.dbClanId, { rallyCap: 0, isImperial: true }).catch(() => {});

            GameState.save();
            MapRenderer.update();
            this.render();

            GameState.addHistory("system", `Admin spawned ${clan.name} at ${provName} (Imperial — no army, protected)`);
            Notifications.show(`${clan.name} spawned at ${provName} — Imperial (no army, protected)`, "success");
        } else {
            // Normal clans: place starting army (half rally cap)
            clan.isImperial = false;
            const startingTroops = Math.floor(clan.rallyCap / 2);
            province.armies[clanId] = startingTroops;
            delete GameState.protectedProvinces[provId];

            API.updateClanSettings(clan.dbClanId, { isImperial: false }).catch(() => {});

            GameState.save();
            MapRenderer.update();
            this.render();

            GameState.addHistory("system", `Admin spawned ${clan.name} at ${provName} with ${startingTroops} troops`);
            Notifications.show(`${clan.name} spawned at ${provName} with ${startingTroops} troops`, "success");
        }
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

            // Live score indicator (populated async)
            const scoreId = `live-score-${battle.id}`;

            return `
                <div class="battle-card">
                    <div id="${scoreId}" class="battle-live-score" style="display:none"></div>
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

        // Fetch live scores for battles with linked war IDs
        this._fetchLiveScores(pending);
    },

    async _fetchLiveScores(battles) {
        if (!API.enabled) return;
        for (const battle of battles) {
            const warId = battle.dbWarId || (battle.bracketId && GameState.bracketWarIds && GameState.bracketWarIds[battle.bracketId]);
            if (!warId) continue;

            try {
                const data = await API.getWarLiveScore(warId);
                if (data && data.live && data.score) {
                    const el = document.getElementById(`live-score-${battle.id}`);
                    if (!el) continue;

                    const s = data.score;
                    const pct = ((s.meter / s.maxMeter) * 50) + 50; // 0-100 where 50 is center
                    const team1Winning = s.meter > 0;
                    const leader = team1Winning ? s.team1Name : s.team2Name;

                    el.style.display = "block";
                    el.innerHTML = `
                        <div style="font-size:11px;color:#e8d5b0;margin-bottom:4px">
                            LIVE — ${s.team1Players || 0}v${s.team2Players || 0} players
                        </div>
                        <div style="background:#333;height:8px;border-radius:4px;overflow:hidden;position:relative">
                            <div style="position:absolute;left:0;top:0;height:100%;width:${pct}%;background:${team1Winning ? '#e74c3c' : '#3498db'};transition:width 0.5s"></div>
                        </div>
                        <div style="font-size:10px;color:#aaa;margin-top:2px">${leader} leading</div>
                    `;
                }
            } catch (e) {
                // ignore score fetch failures
            }
        }
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

    async nextPhase() {
        if (GameState.phase === "planning") {
            // Planning → Process moves → Battle phase
            const result = MoveSystem.processOrders();
            GameState.phase = "battle";
            GameState.addHistory("system", `Battle Phase begins! Week ${GameState.week}`);
            GameState.save();
            await GameState.flushNow();
            MapRenderer.update();
            App.updateUI();
            this.render();
            this.updatePhaseStatus();

            if (result.success) {
                Notifications.show(
                    `Processed ${result.movesProcessed} moves. ${result.battlesGenerated} battles generated!`,
                    "success"
                );
            } else {
                Notifications.show("No committed orders — moved to Battle Phase.", "info");
            }
        } else {
            // Battle → check for unresolved battles
            const unresolvedBattles = GameState.battles.filter(b => b.status !== "resolved");
            if (unresolvedBattles.length > 0) {
                Notifications.show(
                    `${unresolvedBattles.length} unresolved battle(s) remaining. Resolve them first!`,
                    "error"
                );
                return;
            }

            // Battle → Advance week → Planning
            GameState.week++;
            GameState.phase = "planning";
            GameState.orders = [];
            GameState.battles = GameState.battles.filter(b => b.status !== "resolved");
            GameState.pendingAttacks = [];
            BattleSystem.advanceRetreats();
            ArmySystem.recoverCasualties();
            GameState.addHistory("system", `Week ${GameState.week} begins. Planning Phase.`);
            GameState.save();
            await GameState.flushNow();
            MapRenderer.update();
            App.updateUI();
            this.render();
            this.updatePhaseStatus();
            Notifications.show(`Advanced to Week ${GameState.week} — Planning Phase`, "success");
        }
    },

    updatePhaseStatus() {
        const statusEl = document.getElementById("admin-phase-status");
        const btn = document.getElementById("admin-next-phase");
        if (!statusEl || !btn) return;

        if (GameState.phase === "planning") {
            const committedOrders = GameState.orders.filter(o => o.status === "committed").length;
            const pendingOrders = GameState.orders.filter(o => o.status === "pending").length;
            statusEl.innerHTML = `<strong>Planning Phase</strong> — Week ${GameState.week}<br>` +
                `${committedOrders} committed order(s), ${pendingOrders} pending`;
            btn.textContent = "Next Phase → Process Moves & Start Battles";
        } else {
            const unresolvedBattles = GameState.battles.filter(b => b.status !== "resolved").length;
            statusEl.innerHTML = `<strong>Battle Phase</strong> — Week ${GameState.week}<br>` +
                `${unresolvedBattles} unresolved battle(s)`;
            if (unresolvedBattles > 0) {
                btn.textContent = `Resolve ${unresolvedBattles} Battle(s) First`;
            } else {
                btn.textContent = "Next Phase → Advance to Week " + (GameState.week + 1);
            }
        }
    },

    resetGame() {
        if (!confirm("RESET GAME?\n\nThis will:\n- Go back to Week 1\n- Clear all history\n- Clear all orders, battles, casualties\n- Clear all alliances\n- Respawn all clans at their castles\n\nAre you sure?")) return;

        // Reset week and phase
        GameState.week = 1;
        GameState.phase = "planning";

        // Clear everything
        GameState.history = [];
        GameState.orders = [];
        GameState.battles = [];
        GameState.pendingAttacks = [];
        GameState.casualties = {};
        GameState.retreatingArmies = [];
        GameState.alliances = [];
        GameState.allianceRequests = [];

        // Reset all provinces to unowned with no armies
        Object.keys(GameState.provinces).forEach(provId => {
            GameState.provinces[provId] = { owner: null, armies: {} };
        });

        // Clear protected provinces (will be re-set by imperial spawns)
        GameState.protectedProvinces = {};

        // Respawn each clan at their castle
        Object.values(GameState.clans).forEach(clan => {
            if (!clan.castleProvince) return;
            const provId = clan.castleProvince;
            const province = GameState.provinces[provId];
            if (!province) return;

            province.owner = clan.id;

            // Check if this clan was imperial (rally cap 0)
            if (clan.rallyCap === 0) {
                // Imperial: no army, mark protected
                GameState.protectedProvinces[provId] = clan.id;
            } else {
                // Normal: half rally cap as starting troops
                const startingTroops = Math.floor(clan.rallyCap / 2);
                province.armies[clan.id] = startingTroops;
            }
        });

        GameState.addHistory("system", "Game reset to Week 1. All clans respawned at their castles.");
        GameState.save();
        GameState.flushNow();
        MapRenderer.update();
        App.updateUI();
        this.render();

        Notifications.show("Game reset to Week 1!", "success");
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
        if (isNaN(newCap) || newCap < 0) {
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
        if (!colorInput) return;

        const clan = GameState.getClan(clanId);
        const newColor = colorInput.value;

        try {
            await API.updateClanSettings(clan.dbClanId, {
                color: newColor,
            });
        } catch (err) {
            Notifications.show("Failed to save: " + err.message, "error");
            return;
        }

        clan.color = newColor;
        GameState.save();
        MapRenderer.update();
        this.renderClanList();
        Notifications.show(`${clan.name} colour updated`, "info");
    },

    onImperialToggle(clanId, checked) {
        if (checked) {
            const rallyInput = document.querySelector(`.rally-input[data-clan="${clanId}"]`);
            if (rallyInput) {
                rallyInput.value = 0;
            }
        }
    },

    async resolveBattle(battleId, winningSide) {
        const result = BattleSystem.resolveBattle(battleId, winningSide);

        if (result.success) {
            await GameState.flushNow();
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

};
