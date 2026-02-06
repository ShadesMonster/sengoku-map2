// Diplomacy System - Alliances, gift land
const Diplomacy = {
    // Send alliance request
    requestAlliance(fromClanId, toClanId) {
        if (fromClanId === toClanId) return { success: false, error: "Cannot ally with yourself" };

        if (GameState.areAllied(fromClanId, toClanId)) {
            return { success: false, error: "Already allied" };
        }

        // Check if request already pending
        const existing = GameState.allianceRequests.find(r =>
            (r.from === fromClanId && r.to === toClanId) ||
            (r.from === toClanId && r.to === fromClanId)
        );
        if (existing) {
            return { success: false, error: "Alliance request already pending" };
        }

        GameState.allianceRequests.push({
            id: Date.now() + Math.random(),
            from: fromClanId,
            to: toClanId,
            timestamp: new Date().toISOString()
        });

        const fromClan = GameState.getClan(fromClanId);
        const toClan = GameState.getClan(toClanId);
        GameState.addHistory("diplomacy",
            `${fromClan.name} sent alliance request to ${toClan.name}`);
        GameState.save();

        return { success: true };
    },

    // Accept alliance request
    acceptAlliance(requestId) {
        const idx = GameState.allianceRequests.findIndex(r => r.id === requestId);
        if (idx === -1) return { success: false, error: "Request not found" };

        const request = GameState.allianceRequests[idx];
        GameState.alliances.push({
            clan1: request.from,
            clan2: request.to,
            formedAt: new Date().toISOString()
        });

        GameState.allianceRequests.splice(idx, 1);

        const fromClan = GameState.getClan(request.from);
        const toClan = GameState.getClan(request.to);
        GameState.addHistory("diplomacy",
            `Alliance formed: ${fromClan.name} \u{1F91D} ${toClan.name}`);
        GameState.save();

        Notifications.show(`Alliance formed: ${fromClan.name} & ${toClan.name}!`, "diplomacy");

        return { success: true };
    },

    // Reject alliance request
    rejectAlliance(requestId) {
        const idx = GameState.allianceRequests.findIndex(r => r.id === requestId);
        if (idx === -1) return { success: false, error: "Request not found" };

        const request = GameState.allianceRequests[idx];
        const fromClan = GameState.getClan(request.from);
        const toClan = GameState.getClan(request.to);

        GameState.allianceRequests.splice(idx, 1);
        GameState.addHistory("diplomacy",
            `${toClan.name} rejected alliance with ${fromClan.name}`);
        GameState.save();

        return { success: true };
    },

    // Break alliance
    breakAlliance(clan1Id, clan2Id) {
        const idx = GameState.alliances.findIndex(a =>
            (a.clan1 === clan1Id && a.clan2 === clan2Id) ||
            (a.clan1 === clan2Id && a.clan2 === clan1Id)
        );
        if (idx === -1) return { success: false, error: "Alliance not found" };

        GameState.alliances.splice(idx, 1);

        const clan1 = GameState.getClan(clan1Id);
        const clan2 = GameState.getClan(clan2Id);
        GameState.addHistory("diplomacy",
            `Alliance broken: ${clan1.name} & ${clan2.name}`);
        GameState.save();

        Notifications.show(`Alliance broken: ${clan1.name} & ${clan2.name}`, "warning");

        return { success: true };
    },

    // Gift province to allied clan
    giftProvince(fromClanId, toClanId, provinceId) {
        if (!GameState.areAllied(fromClanId, toClanId)) {
            return { success: false, error: "Can only gift land to allies" };
        }

        const province = GameState.provinces[provinceId];
        if (!province) return { success: false, error: "Invalid province" };
        if (province.owner !== fromClanId) return { success: false, error: "You don't own this province" };

        province.owner = toClanId;

        const fromClan = GameState.getClan(fromClanId);
        const toClan = GameState.getClan(toClanId);
        const provData = PROVINCE_MAP[provinceId];
        GameState.addHistory("diplomacy",
            `${fromClan.name} gifted ${provData.name} to ${toClan.name}`);
        GameState.save();

        Notifications.show(`${fromClan.name} gifted ${provData.name} to ${toClan.name}!`, "diplomacy");

        return { success: true };
    },

    // Get pending requests for a clan
    getPendingRequests(clanId) {
        return GameState.allianceRequests.filter(r => r.to === clanId);
    },

    // Get sent requests from a clan
    getSentRequests(clanId) {
        return GameState.allianceRequests.filter(r => r.from === clanId);
    }
};
