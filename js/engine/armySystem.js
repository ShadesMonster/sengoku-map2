// Army System - Levy raising, splitting, rally cap enforcement
const ArmySystem = {
    // Casualty recovery rate per week (percentage of casualties that heal)
    CASUALTY_RECOVERY_RATE: 0.5, // 50% of casualties recover each week

    // Raise levy in a province owned by the clan
    raiseLevy(clanId, provinceId, amount) {
        const clan = GameState.getClan(clanId);
        const province = GameState.provinces[provinceId];
        if (!clan || !province) return { success: false, error: "Invalid clan or province" };
        if (province.owner !== clanId) return { success: false, error: "You don't own this province" };
        if (GameState.phase !== "planning") return { success: false, error: "Can only raise levies during Planning Phase" };

        if (amount % TROOP_UNIT !== 0) {
            return { success: false, error: `Must raise in units of ${TROOP_UNIT}` };
        }

        const rallyInfo = this.getRallyInfo(clanId);
        if (rallyInfo.available <= 0) {
            if (rallyInfo.casualties > 0) {
                return { success: false, error: `Cannot raise levies — ${rallyInfo.casualties} troops still recovering from battle` };
            }
            return { success: false, error: `Rally Cap reached (${clan.rallyCap})` };
        }

        const actual = Math.min(amount, rallyInfo.available);
        province.armies[clanId] = (province.armies[clanId] || 0) + actual;

        GameState.addHistory("system", `${clan.name} raised ${actual} levies in ${PROVINCE_MAP[provinceId].name}`);
        GameState.save();

        return { success: true, raised: actual, total: province.armies[clanId] };
    },

    // Add casualties to a clan (called by BattleSystem on resolution)
    addCasualties(clanId, amount) {
        if (!GameState.casualties) GameState.casualties = {};
        GameState.casualties[clanId] = (GameState.casualties[clanId] || 0) + amount;
    },

    // Get current casualties for a clan
    getCasualties(clanId) {
        if (!GameState.casualties) return 0;
        return GameState.casualties[clanId] || 0;
    },

    // Recover casualties (called each week advance)
    recoverCasualties() {
        if (!GameState.casualties) return;
        for (const clanId of Object.keys(GameState.casualties)) {
            const current = GameState.casualties[clanId];
            const recovered = roundTo10(Math.floor(current * this.CASUALTY_RECOVERY_RATE));
            GameState.casualties[clanId] = current - recovered;

            // Clean up fully recovered
            if (GameState.casualties[clanId] <= 0) {
                delete GameState.casualties[clanId];
            } else {
                const clan = GameState.getClan(clanId);
                if (clan) {
                    GameState.addHistory("system",
                        `${clan.name}: ${recovered} troops recovered, ${GameState.casualties[clanId]} still recovering`);
                }
            }
        }
    },

    // Split army - remove troops from one province (they'll be moved via orders)
    getArmyInProvince(clanId, provinceId) {
        const province = GameState.provinces[provinceId];
        if (!province) return 0;
        return province.armies[clanId] || 0;
    },

    // Set army count directly (admin use)
    setArmy(clanId, provinceId, count) {
        const province = GameState.provinces[provinceId];
        if (!province) return false;
        if (count <= 0) {
            delete province.armies[clanId];
        } else {
            province.armies[clanId] = count;
        }
        GameState.save();
        return true;
    },

    // Remove army from province
    removeArmy(clanId, provinceId) {
        const province = GameState.provinces[provinceId];
        if (!province) return false;
        delete province.armies[clanId];
        GameState.save();
        return true;
    },

    // Get rally cap info for a clan (now includes casualty penalty)
    getRallyInfo(clanId) {
        const clan = GameState.getClan(clanId);
        if (!clan) return null;
        const total = GameState.getTotalTroops(clanId);
        const inBattle = this.getTroopsInBattle(clanId);
        const casualties = this.getCasualties(clanId);
        const effectiveTotal = total + inBattle + casualties;
        return {
            current: total,
            inBattle,
            casualties,
            cap: clan.rallyCap,
            available: Math.max(0, clan.rallyCap - effectiveTotal),
            percentage: Math.round((effectiveTotal / clan.rallyCap) * 100)
        };
    },

    // Get troops currently locked in active battles
    getTroopsInBattle(clanId) {
        let total = 0;
        GameState.battles.forEach(b => {
            if (b.status !== "pending") return;
            if (b.attacker.armyBreakdown[clanId]) total += b.attacker.armyBreakdown[clanId];
            if (b.defender.armyBreakdown[clanId]) total += b.defender.armyBreakdown[clanId];
        });
        // Also count waiting queue troops
        GameState.battles.forEach(b => {
            if (b.status !== "pending") return;
            (b.waitingAttackers || []).forEach(w => {
                if (w.armyBreakdown[clanId]) total += w.armyBreakdown[clanId];
            });
        });
        // And pending attacks
        (GameState.pendingAttacks || []).forEach(p => {
            if (p.armyBreakdown[clanId]) total += p.armyBreakdown[clanId];
        });
        // And retreating armies
        total += BattleSystem.getRetreatingTroops(clanId);
        return total;
    },

    // Get all armies in a province (on the ground)
    getArmiesInProvince(provinceId) {
        const province = GameState.provinces[provinceId];
        if (!province) return [];
        return Object.entries(province.armies)
            .filter(([, count]) => count > 0)
            .map(([clanId, count]) => ({
                clanId,
                clan: GameState.getClan(clanId),
                count
            }));
    },

    // Get all troops fighting in battles at a province
    getBattleTroopsAtProvince(provinceId) {
        const troops = [];
        GameState.battles.forEach(b => {
            if (b.province !== provinceId || b.status !== "pending") return;
            // Attacker side
            b.attacker.clans.forEach(cid => {
                const clan = GameState.getClan(cid);
                if (clan && b.attacker.armyBreakdown[cid]) {
                    troops.push({
                        clanId: cid,
                        clan,
                        count: b.attacker.armyBreakdown[cid],
                        side: "attacker",
                        battleType: b.battleType
                    });
                }
            });
            // Defender side
            b.defender.clans.forEach(cid => {
                const clan = GameState.getClan(cid);
                if (clan && b.defender.armyBreakdown[cid]) {
                    troops.push({
                        clanId: cid,
                        clan,
                        count: b.defender.armyBreakdown[cid],
                        side: "defender",
                        battleType: b.battleType
                    });
                }
            });
        });
        return troops;
    }
};
