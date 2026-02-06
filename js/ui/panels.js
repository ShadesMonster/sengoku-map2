// Panels - Side panel, province details, action buttons
const Panels = {
    init() {
        // Close button
        document.getElementById("panel-close").addEventListener("click", () => {
            document.getElementById("side-panel").classList.add("hidden");
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

        if (armies.length === 0) {
            list.innerHTML = '<div class="empty-state">No armies present</div>';
            return;
        }

        list.innerHTML = armies.map(a => `
            <div class="army-entry" style="border-left: 3px solid ${a.clan.color}">
                <span class="army-clan">${a.clan.japaneseName} ${a.clan.name}</span>
                <span class="army-count">${a.count.toLocaleString()} troops</span>
            </div>
        `).join("");
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
                    `Raise Levy (${rallyInfo.available} available)`,
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

                if (available > 0) {
                    container.appendChild(this.createButton(
                        `Move Army (${available} available)`,
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
                orderEl.innerHTML = `
                    <span class="order-info">${order.troops} → ${to.name}</span>
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
        const amount = prompt(
            `Raise Levy in ${PROVINCE_MAP[provinceId].name}\n` +
            `Available: ${rallyInfo.available} (${rallyInfo.current}/${rallyInfo.cap})\n` +
            `How many troops?`,
            Math.min(100, rallyInfo.available)
        );

        if (amount === null) return;
        const num = parseInt(amount);
        if (isNaN(num) || num <= 0) {
            Notifications.show("Invalid number", "error");
            return;
        }

        const result = ArmySystem.raiseLevy(clanId, provinceId, num);
        if (result.success) {
            Notifications.show(`Raised ${result.raised} levies!`, "success");
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
