// ArmorPanel - UI for armor customization
const ArmorPanel = {
    activeSlot: null, // currently selected tab slot key

    init() {
        document.getElementById("btn-armor").addEventListener("click", () => this.toggle());
        document.querySelector("#armor-panel .overlay-close").addEventListener("click", () => {
            document.getElementById("armor-panel").classList.add("hidden");
        });
    },

    toggle() {
        const panel = document.getElementById("armor-panel");
        panel.classList.toggle("hidden");
        if (!panel.classList.contains("hidden")) {
            this.activeSlot = this.activeSlot || "kabuto";
            this.render();
        }
    },

    render() {
        const clanId = GameState.selectedClan;
        if (!clanId) {
            document.getElementById("armor-rank-info").innerHTML =
                '<div class="empty-state">Select a clan first</div>';
            document.getElementById("armor-preset-bar").innerHTML = "";
            document.getElementById("armor-tabs").innerHTML = "";
            document.getElementById("armor-slot-content").innerHTML = "";
            document.getElementById("armor-summary").innerHTML = "";
            return;
        }

        this.renderRankInfo(clanId);
        this.renderPresetBar(clanId);
        this.renderTabs(clanId);
        this.renderSlotContent(clanId);
        this.renderSummary(clanId);
    },

    renderRankInfo(clanId) {
        const clan = GameState.getClan(clanId);
        const rank = ArmorSystem.getRank(clanId);
        const rankInfo = ARMOR_RANKS[rank];
        const hasGP = ArmorSystem.hasGamepass(clanId);

        document.getElementById("armor-rank-info").innerHTML = `
            <div class="armor-rank-bar">
                <div class="armor-rank-left">
                    <span class="armor-rank-label" style="color: ${clan.color}">${clan.japaneseName} ${clan.name}</span>
                    <span class="armor-rank-value">${rankInfo.name} <span class="armor-rank-desc">(${rankInfo.description})</span></span>
                </div>
                <div class="armor-rank-right">
                    <select class="armor-rank-select" onchange="ArmorPanel.onRankChange('${clanId}', this.value)">
                        ${ARMOR_RANKS.map((r, i) =>
                            `<option value="${i}" ${i === rank ? 'selected' : ''}>${r.name}</option>`
                        ).join("")}
                    </select>
                    <label class="armor-gp-toggle">
                        <input type="checkbox" ${hasGP ? 'checked' : ''}
                            onchange="ArmorPanel.onGamepassToggle('${clanId}', this.checked)">
                        <span class="armor-gp-label">Gamepass</span>
                    </label>
                </div>
            </div>
        `;
    },

    renderPresetBar(clanId) {
        const hasGP = ArmorSystem.hasGamepass(clanId);
        const rank = ArmorSystem.getRank(clanId);
        const rankName = ARMOR_RANKS[rank].name;

        document.getElementById("armor-preset-bar").innerHTML = `
            <div class="armor-preset-row">
                <button class="armor-preset-btn" onclick="ArmorPanel.onApplyPreset('${clanId}')">
                    Reset to ${rankName} Preset
                </button>
                ${!hasGP ? '<span class="armor-gp-hint">Enable Gamepass to mix &amp; match items</span>' : '<span class="armor-gp-active">Mix &amp; Match Active</span>'}
            </div>
        `;
    },

    renderTabs(clanId) {
        const loadout = ArmorSystem.getLoadout(clanId);

        document.getElementById("armor-tabs").innerHTML = `
            <div class="armor-tab-strip">
                ${Object.entries(ARMOR_SLOTS).map(([key, slot]) => {
                    const isActive = key === this.activeSlot;
                    const equipped = ARMOR_ITEM_MAP[loadout[key]];
                    const isEmpty = loadout[key] && loadout[key].endsWith("_none");
                    return `
                        <button class="armor-tab ${isActive ? 'active' : ''} ${isEmpty ? 'empty' : ''}"
                                onclick="ArmorPanel.selectTab('${key}')"
                                title="${slot.name} - ${slot.description}">
                            <span class="armor-tab-icon">${slot.icon}</span>
                            <span class="armor-tab-name">${slot.name}</span>
                            ${equipped && !isEmpty ? `<span class="armor-tab-equipped">${equipped.name}</span>` : ''}
                        </button>
                    `;
                }).join("")}
            </div>
        `;
    },

    renderSlotContent(clanId) {
        const slotKey = this.activeSlot;
        if (!slotKey) return;

        const slot = ARMOR_SLOTS[slotKey];
        const items = ArmorSystem.getAvailableItems(clanId, slotKey);
        const loadout = ArmorSystem.getLoadout(clanId);
        const equippedId = loadout[slotKey];

        document.getElementById("armor-slot-content").innerHTML = `
            <div class="armor-slot-header">
                <span class="armor-slot-icon">${slot.icon}</span>
                <span class="armor-slot-name">${slot.name}</span>
                <span class="armor-slot-desc">${slot.description}</span>
            </div>
            <div class="armor-item-grid">
                ${items.map(item => {
                    const isEquipped = item.id === equippedId;
                    const isNone = item.id.endsWith("_none");
                    const rankLabel = !isNone ? ARMOR_RANKS[item.rank].name : null;

                    return `
                        <div class="armor-item ${isEquipped ? 'equipped' : ''} ${!item.available ? 'locked' : ''} ${isNone ? 'none-item' : ''}"
                             onclick="${item.available ? `ArmorPanel.onEquip('${clanId}', '${slotKey}', '${item.id}')` : ''}"
                             title="${item.reason || item.description || ''}">
                            <div class="armor-item-header">
                                <span class="armor-item-name">${item.name}</span>
                                ${isEquipped ? '<span class="armor-item-badge equipped-badge">Equipped</span>' : ''}
                                ${item.isPreset && !isNone ? '<span class="armor-item-badge preset-badge">Preset</span>' : ''}
                            </div>
                            ${item.description ? `<div class="armor-item-desc">${item.description}</div>` : ''}
                            <div class="armor-item-footer">
                                ${rankLabel ? `<span class="armor-item-rank rank-${item.rank}">${rankLabel}</span>` : ''}
                                ${!item.available ? `<span class="armor-item-lock">${item.reason}</span>` : ''}
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>
        `;
    },

    renderSummary(clanId) {
        const summary = ArmorSystem.getLoadoutSummary(clanId);
        const clan = GameState.getClan(clanId);

        document.getElementById("armor-summary").innerHTML = `
            <h3>Current Loadout</h3>
            <div class="armor-summary-grid">
                ${summary.map(s => `
                    <div class="armor-summary-item ${s.isEmpty ? 'empty' : ''}">
                        <span class="armor-summary-icon">${s.slotIcon}</span>
                        <span class="armor-summary-slot">${s.slotName}</span>
                        <span class="armor-summary-name" style="${!s.isEmpty ? `color: ${clan.color}` : ''}">${s.itemName}</span>
                    </div>
                `).join("")}
            </div>
        `;
    },

    // ---- Event Handlers ----

    selectTab(slotKey) {
        this.activeSlot = slotKey;
        this.render();
    },

    onEquip(clanId, slotKey, itemId) {
        const result = ArmorSystem.equipItem(clanId, slotKey, itemId);
        if (result.success) {
            this.render();
        } else {
            Notifications.show(result.error, "error");
        }
    },

    onRankChange(clanId, rankVal) {
        ArmorSystem.setRank(clanId, parseInt(rankVal));
        // Auto-apply preset on rank change so armor matches new rank
        ArmorSystem.applyPreset(clanId);
        this.render();
    },

    onGamepassToggle(clanId, enabled) {
        ArmorSystem.setGamepass(clanId, enabled);
        this.render();
    },

    onApplyPreset(clanId) {
        ArmorSystem.applyPreset(clanId);
        this.render();
        Notifications.show("Armor reset to rank preset", "success");
    },
};
