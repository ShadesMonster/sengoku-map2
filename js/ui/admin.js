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

        // Clan management
        document.getElementById("admin-create-clan").addEventListener("click", () => {
            this.createClan();
        });
    },

    toggle() {
        const panel = document.getElementById("admin-panel");
        panel.classList.toggle("hidden");
        if (!panel.classList.contains("hidden")) {
            this.render();
        }
    },

    render() {
        this.populateProvinceSelect();
        this.populateClanSelects();
        this.renderClanList();
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
    },

    renderClanList() {
        const list = document.getElementById("admin-clan-list");
        const clans = Object.values(GameState.clans);

        list.innerHTML = clans.map(c => {
            const provinces = GameState.getOwnedProvinces(c.id).length;
            const troops = GameState.getTotalTroops(c.id);
            return `
                <div class="admin-clan-entry" style="border-left: 3px solid ${c.color}">
                    <div class="clan-info">
                        <strong>${c.japaneseName} ${c.name}</strong>
                        <span>${provinces} provinces, ${troops} troops</span>
                    </div>
                    <div class="clan-controls">
                        <label>Rally Cap:</label>
                        <input type="number" value="${c.rallyCap}" min="100" max="50000"
                               class="rally-input" data-clan="${c.id}"/>
                        <button class="small-btn" onclick="Admin.updateRallyCap('${c.id}')">Set</button>
                        <button class="small-btn danger" onclick="Admin.deleteClan('${c.id}')">Delete</button>
                    </div>
                </div>
            `;
        }).join("");
    },

    renderBattleList() {
        const list = document.getElementById("admin-battle-list");
        const pending = BattleSystem.getPendingBattles();

        if (pending.length === 0) {
            list.innerHTML = '<div class="empty-state">No pending battles</div>';
            return;
        }

        list.innerHTML = pending.map(battle => {
            const participants = Object.entries(battle.participants).map(([cid, p]) => {
                const clan = GameState.getClan(cid);
                return `<span style="color:${clan.color}">${clan.name} (${p.troops})</span>`;
            }).join(" vs ");

            const participantOptions = Object.keys(battle.participants)
                .map(cid => {
                    const clan = GameState.getClan(cid);
                    return `<option value="${cid}">${clan.name}</option>`;
                }).join("");

            return `
                <div class="battle-card">
                    <div class="battle-header">
                        <strong>${BattleSystem.getBattleIcon(battle.terrain)} ${battle.battleType}</strong>
                        <span>at ${battle.provinceName}</span>
                    </div>
                    <div class="battle-participants">${participants}</div>
                    <div class="battle-resolve">
                        <select class="battle-winner-select" data-battle="${battle.id}">
                            ${participantOptions}
                        </select>
                        <button class="admin-btn" onclick="Admin.resolveBattle('${battle.id}')">
                            Resolve Winner
                        </button>
                    </div>
                </div>
            `;
        }).join("");
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
        // Clear pending (non-committed) orders
        GameState.orders = [];
        // Clear resolved battles
        GameState.battles = GameState.battles.filter(b => b.status !== "resolved");
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

    createClan() {
        const name = document.getElementById("admin-clan-name").value.trim();
        const color = document.getElementById("admin-clan-color").value;
        const rallyCap = parseInt(document.getElementById("admin-clan-rallycap").value);

        if (!name) {
            Notifications.show("Enter a clan name", "error");
            return;
        }

        const id = name.toLowerCase().replace(/[^a-z0-9]/g, "_");
        if (GameState.clans[id]) {
            Notifications.show("Clan already exists", "error");
            return;
        }

        GameState.clans[id] = {
            id,
            name,
            japaneseName: name,
            color,
            rallyCap: rallyCap || 1000,
            homeProvince: null,
            totalTroops: 0
        };

        GameState.save();
        App.updateClanSelector();
        this.render();
        Notifications.show(`Clan ${name} created!`, "success");
        GameState.addHistory("system", `New clan created: ${name}`);

        document.getElementById("admin-clan-name").value = "";
    },

    updateRallyCap(clanId) {
        const input = document.querySelector(`.rally-input[data-clan="${clanId}"]`);
        if (!input) return;

        const newCap = parseInt(input.value);
        if (isNaN(newCap) || newCap < 100) {
            Notifications.show("Invalid rally cap", "error");
            return;
        }

        GameState.clans[clanId].rallyCap = newCap;
        GameState.save();
        Notifications.show(`Rally cap updated for ${GameState.getClan(clanId).name}`, "info");
    },

    deleteClan(clanId) {
        const clan = GameState.getClan(clanId);
        if (!confirm(`Delete ${clan.name}? This will remove all their armies and provinces.`)) return;

        // Remove from all provinces
        Object.values(GameState.provinces).forEach(prov => {
            if (prov.owner === clanId) prov.owner = null;
            delete prov.armies[clanId];
        });

        // Remove alliances
        GameState.alliances = GameState.alliances.filter(a =>
            a.clan1 !== clanId && a.clan2 !== clanId);
        GameState.allianceRequests = GameState.allianceRequests.filter(r =>
            r.from !== clanId && r.to !== clanId);

        // Remove orders
        GameState.orders = GameState.orders.filter(o => o.clanId !== clanId);

        delete GameState.clans[clanId];
        if (GameState.selectedClan === clanId) GameState.selectedClan = null;

        GameState.save();
        App.updateClanSelector();
        MapRenderer.update();
        this.render();
        Notifications.show(`${clan.name} deleted`, "warning");
    },

    resolveBattle(battleId) {
        const select = document.querySelector(`.battle-winner-select[data-battle="${battleId}"]`);
        if (!select) return;

        const winnerId = select.value;
        const result = BattleSystem.resolveBattle(battleId, winnerId);

        if (result.success) {
            Notifications.show(
                `${result.winner} wins! Defeated: ${result.losers.join(", ")}`,
                "success"
            );
            MapRenderer.update();
            this.render();
        } else {
            Notifications.show(result.error, "error");
        }
    }
};
