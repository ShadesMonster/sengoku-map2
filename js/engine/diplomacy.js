// Diplomacy System - Marriage-based alliances, gift land
const Diplomacy = {
    // Get a person's info from CLAN_FAMILIES
    getPerson(personId) {
        for (const [clanId, family] of Object.entries(CLAN_FAMILIES)) {
            for (const child of family.children) {
                if (child.id === personId) {
                    return { ...child, clanId };
                }
            }
        }
        return null;
    },

    // Check if a person is already married
    isMarried(personId) {
        return GameState.alliances.some(a =>
            a.person1 === personId || a.person2 === personId
        );
    },

    // Get unmarried children of a clan
    getUnmarriedChildren(clanId) {
        const family = CLAN_FAMILIES[clanId];
        if (!family) return [];
        return family.children.filter(c => !this.isMarried(c.id));
    },

    // Propose marriage between two clan children
    proposeMarriage(fromClanId, fromPersonId, toClanId, toPersonId) {
        if (fromClanId === toClanId) {
            return { success: false, error: "Cannot marry within same clan" };
        }

        if (GameState.areAllied(fromClanId, toClanId)) {
            return { success: false, error: "Already allied through marriage" };
        }

        if (this.isMarried(fromPersonId) || this.isMarried(toPersonId)) {
            return { success: false, error: "One or both persons are already married" };
        }

        // Check no pending proposal between these clans
        const existing = GameState.allianceRequests.find(r =>
            (r.from === fromClanId && r.to === toClanId) ||
            (r.from === toClanId && r.to === fromClanId)
        );
        if (existing) {
            return { success: false, error: "Marriage proposal already pending between these clans" };
        }

        const fromPerson = this.getPerson(fromPersonId);
        const toPerson = this.getPerson(toPersonId);
        if (!fromPerson || !toPerson) {
            return { success: false, error: "Invalid person" };
        }

        GameState.allianceRequests.push({
            id: Date.now() + Math.random(),
            from: fromClanId,
            to: toClanId,
            fromPerson: fromPersonId,
            toPerson: toPersonId,
            timestamp: new Date().toISOString()
        });

        const fromClan = GameState.getClan(fromClanId);
        const toClan = GameState.getClan(toClanId);
        GameState.addHistory("diplomacy",
            `${fromClan.name} proposes marriage: ${fromPerson.name} to ${toPerson.name} of ${toClan.name}`);
        GameState.save();

        return { success: true };
    },

    // Accept marriage proposal - forms alliance
    acceptMarriage(requestId) {
        const idx = GameState.allianceRequests.findIndex(r => r.id === requestId);
        if (idx === -1) return { success: false, error: "Proposal not found" };

        const request = GameState.allianceRequests[idx];

        // Verify both persons still unmarried
        if (this.isMarried(request.fromPerson) || this.isMarried(request.toPerson)) {
            GameState.allianceRequests.splice(idx, 1);
            GameState.save();
            return { success: false, error: "One or both persons are no longer available" };
        }

        GameState.alliances.push({
            clan1: request.from,
            clan2: request.to,
            person1: request.fromPerson,
            person2: request.toPerson,
            formedAt: new Date().toISOString()
        });

        GameState.allianceRequests.splice(idx, 1);

        const fromClan = GameState.getClan(request.from);
        const toClan = GameState.getClan(request.to);
        const p1 = this.getPerson(request.fromPerson);
        const p2 = this.getPerson(request.toPerson);
        GameState.addHistory("diplomacy",
            `Marriage alliance: ${p1.name} (${fromClan.name}) wed ${p2.name} (${toClan.name})`);
        GameState.save();

        Notifications.show(
            `Marriage alliance formed! ${p1.name} & ${p2.name}`,
            "diplomacy"
        );

        return { success: true };
    },

    // Reject marriage proposal
    rejectMarriage(requestId) {
        const idx = GameState.allianceRequests.findIndex(r => r.id === requestId);
        if (idx === -1) return { success: false, error: "Proposal not found" };

        const request = GameState.allianceRequests[idx];
        const fromClan = GameState.getClan(request.from);
        const toClan = GameState.getClan(request.to);
        const p1 = this.getPerson(request.fromPerson);
        const p2 = this.getPerson(request.toPerson);

        GameState.allianceRequests.splice(idx, 1);
        GameState.addHistory("diplomacy",
            `${toClan.name} rejected marriage of ${p2.name} to ${p1.name} (${fromClan.name})`);
        GameState.save();

        return { success: true };
    },

    // Dissolve marriage - breaks alliance
    dissolveMarriage(clan1Id, clan2Id) {
        const idx = GameState.alliances.findIndex(a =>
            (a.clan1 === clan1Id && a.clan2 === clan2Id) ||
            (a.clan1 === clan2Id && a.clan2 === clan1Id)
        );
        if (idx === -1) return { success: false, error: "Alliance not found" };

        const alliance = GameState.alliances[idx];
        const p1 = this.getPerson(alliance.person1);
        const p2 = this.getPerson(alliance.person2);

        GameState.alliances.splice(idx, 1);

        const clan1 = GameState.getClan(clan1Id);
        const clan2 = GameState.getClan(clan2Id);
        GameState.addHistory("diplomacy",
            `Marriage dissolved: ${p1 ? p1.name : "?"} & ${p2 ? p2.name : "?"} — Alliance broken between ${clan1.name} & ${clan2.name}`);
        GameState.save();

        Notifications.show(`Marriage dissolved: ${clan1.name} & ${clan2.name}`, "warning");

        return { success: true };
    },

    // Get marriage details for an alliance
    getMarriageInfo(clan1Id, clan2Id) {
        const alliance = GameState.alliances.find(a =>
            (a.clan1 === clan1Id && a.clan2 === clan2Id) ||
            (a.clan1 === clan2Id && a.clan2 === clan1Id)
        );
        if (!alliance) return null;

        return {
            person1: this.getPerson(alliance.person1),
            person2: this.getPerson(alliance.person2),
            formedAt: alliance.formedAt
        };
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

    // Get pending proposals for a clan (incoming)
    getPendingRequests(clanId) {
        return GameState.allianceRequests.filter(r => r.to === clanId);
    },

    // Get sent proposals from a clan (outgoing)
    getSentRequests(clanId) {
        return GameState.allianceRequests.filter(r => r.from === clanId);
    }
};
