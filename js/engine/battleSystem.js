// Battle System - Resolving conflicts
const BattleSystem = {
    // Get all pending battles
    getPendingBattles() {
        return GameState.battles.filter(b => b.status === "pending");
    },

    // Resolve a battle (admin selects winner)
    resolveBattle(battleId, winnerClanId) {
        const battle = GameState.battles.find(b => b.id === battleId);
        if (!battle) return { success: false, error: "Battle not found" };
        if (battle.status === "resolved") return { success: false, error: "Battle already resolved" };

        if (!battle.participants[winnerClanId]) {
            return { success: false, error: "Winner must be a battle participant" };
        }

        battle.status = "resolved";
        battle.winner = winnerClanId;

        const province = GameState.provinces[battle.province];
        const winnerClan = GameState.getClan(winnerClanId);
        const provData = PROVINCE_MAP[battle.province];

        // Apply casualties to losers - remove their armies from the province
        const losers = [];
        Object.keys(battle.participants).forEach(cid => {
            if (cid === winnerClanId) return;
            // Check if this clan is allied with the winner
            if (GameState.areAllied(cid, winnerClanId)) return;

            const loserClan = GameState.getClan(cid);
            const lostTroops = province.armies[cid] || 0;
            losers.push({ clan: loserClan, troops: lostTroops });

            // Losers lose all troops in this province (they're routed)
            delete province.armies[cid];
        });

        // Winner takes casualties too (30% loss)
        const winnerTroops = province.armies[winnerClanId] || 0;
        const winnerCasualties = Math.floor(winnerTroops * 0.3);
        province.armies[winnerClanId] = winnerTroops - winnerCasualties;

        // Winner takes the province
        province.owner = winnerClanId;

        // Log
        const loserNames = losers.map(l => `${l.clan.name} (lost ${l.troops})`).join(", ");
        GameState.addHistory("battle",
            `${battle.battleType} at ${provData.name}: ${winnerClan.name} victorious! ` +
            `Defeated: ${loserNames}. Winner casualties: ${winnerCasualties}.`);

        GameState.save();

        return {
            success: true,
            winner: winnerClan.name,
            losers: losers.map(l => l.clan.name),
            winnerCasualties
        };
    },

    // Get battle type icon
    getBattleIcon(terrain) {
        if (terrain === "castle") return CASTLE_SIEGE.icon;
        const config = TERRAIN_CONFIG[terrain];
        return config ? config.icon : "\u2694\uFE0F";
    },

    // Generate a bracket tournament for multi-clan battles
    generateBracket(battleId) {
        const battle = GameState.battles.find(b => b.id === battleId);
        if (!battle) return null;

        const participants = Object.keys(battle.participants);
        // Group allies together
        const groups = MoveSystem._findHostileGroups(participants);

        if (groups.length <= 2) {
            return {
                type: "direct",
                matchups: [{ side1: groups[0], side2: groups[1] || [] }]
            };
        }

        // Bracket tournament for 3+ factions
        const shuffled = groups.sort(() => Math.random() - 0.5);
        const matchups = [];
        for (let i = 0; i < shuffled.length; i += 2) {
            if (i + 1 < shuffled.length) {
                matchups.push({ side1: shuffled[i], side2: shuffled[i + 1] });
            } else {
                matchups.push({ side1: shuffled[i], side2: null, bye: true });
            }
        }

        return {
            type: "bracket",
            rounds: Math.ceil(Math.log2(groups.length)),
            matchups
        };
    }
};
