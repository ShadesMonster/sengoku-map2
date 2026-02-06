// Battle System - Complete battle resolution with brackets, alliances, chain fights
const BattleSystem = {

    // ============================================================
    // Battle Creation
    // ============================================================

    // Create a standard battle (attacker vs defender)
    createBattle(provinceId, attacker, defender, options = {}) {
        const provData = PROVINCE_MAP[provinceId];
        const province = GameState.provinces[provinceId];

        // Determine battle type
        let battleType, terrain;
        if (options.isSanryo) {
            battleType = "Sanryō Battleground";
            terrain = "mountain"; // sanryo uses mountain icon
        } else {
            const owner = province.owner;
            const ownerClan = owner ? GameState.getClan(owner) : null;
            const isCastleSiege = ownerClan && ownerClan.homeProvince === provinceId;
            if (isCastleSiege) {
                battleType = "Castle Siege";
                terrain = "castle";
            } else {
                const terrainConfig = TERRAIN_CONFIG[provData.terrain];
                battleType = terrainConfig.battleType;
                terrain = provData.terrain;
            }
        }

        const battle = {
            id: Date.now() + Math.random(),
            province: provinceId,
            provinceName: provData.name,
            battleType,
            terrain,

            // Two sides
            attacker: {
                clans: attacker.clans,
                armyBreakdown: { ...attacker.armyBreakdown },
                totalTroops: Object.values(attacker.armyBreakdown).reduce((s, v) => s + v, 0)
            },
            defender: {
                clans: defender.clans,
                armyBreakdown: { ...defender.armyBreakdown },
                totalTroops: Object.values(defender.armyBreakdown).reduce((s, v) => s + v, 0)
            },

            // Bracket info
            bracketRound: options.bracketRound || null,
            bracketId: options.bracketId || null,

            // Waiting queue for multi-clan collisions
            waitingAttackers: options.waitingAttackers || [],

            // Who originally owned the province (for post-bracket fight)
            provinceOwner: province.owner,
            provinceOwnerTroops: options.provinceOwnerTroops || null, // { clans, armyBreakdown }

            // Chain info (filled in below)
            chainInfo: {},

            status: "pending",
            winner: null,
            winnerClans: null,
            week: GameState.week
        };

        // Build chain info
        battle.chainInfo = this._buildChainInfo(battle);

        // Remove battling troops from province
        this._removeTroopsFromProvince(provinceId, attacker.armyBreakdown);
        this._removeTroopsFromProvince(provinceId, defender.armyBreakdown);

        GameState.battles.push(battle);

        const atkNames = attacker.clans.map(c => GameState.getClan(c).name).join(" + ");
        const defNames = defender.clans.map(c => GameState.getClan(c).name).join(" + ");
        GameState.addHistory("battle",
            `${this.getBattleIcon(terrain)} ${battleType} at ${provData.name}: ${atkNames} vs ${defNames}`);

        return battle;
    },

    // Remove troops from province (they go into the battle object)
    _removeTroopsFromProvince(provinceId, armyBreakdown) {
        const province = GameState.provinces[provinceId];
        for (const [clanId, troops] of Object.entries(armyBreakdown)) {
            if (province.armies[clanId]) {
                province.armies[clanId] -= troops;
                if (province.armies[clanId] <= 0) {
                    delete province.armies[clanId];
                }
            }
        }
    },

    // Build human-readable chain info
    _buildChainInfo(battle) {
        const info = {};
        const waiting = battle.waitingAttackers;
        const hasOwner = battle.provinceOwnerTroops;

        if (waiting.length > 0) {
            const next = waiting[0];
            const nextNames = next.clans.map(c => GameState.getClan(c).name).join(" + ");
            const nextTroops = Object.values(next.armyBreakdown).reduce((s, v) => s + v, 0);
            info.attackerWinsNext = `Fights ${nextNames} (${nextTroops} troops)`;
            info.defenderWinsNext = `Fights ${nextNames} (${nextTroops} troops)`;
        } else if (hasOwner) {
            const ownerNames = hasOwner.clans.map(c => GameState.getClan(c).name).join(" + ");
            const ownerTroops = Object.values(hasOwner.armyBreakdown).reduce((s, v) => s + v, 0);
            info.attackerWinsNext = `Fights ${ownerNames} defenders (${ownerTroops} troops)`;
            info.defenderWinsNext = `Fights ${ownerNames} defenders (${ownerTroops} troops)`;
        } else {
            info.attackerWinsNext = `Claims ${battle.provinceName}`;
            info.defenderWinsNext = `Keeps ${battle.provinceName}`;
        }

        return info;
    },

    // ============================================================
    // Bracket System (3+ non-allied groups)
    // ============================================================

    createBracketBattles(provinceId, allianceBlocks) {
        const bracketId = Date.now() + Math.random();
        const province = GameState.provinces[provinceId];

        // Check if province owner is among the attackers (an alliance block contains the owner)
        let ownerBlockIdx = -1;
        let provinceOwnerTroops = null;

        if (province.owner) {
            ownerBlockIdx = allianceBlocks.findIndex(block =>
                block.clans.includes(province.owner)
            );
        }

        // If owner is part of a block, remove them - they fight the bracket winner
        let combatants = [...allianceBlocks];
        if (ownerBlockIdx >= 0) {
            provinceOwnerTroops = combatants.splice(ownerBlockIdx, 1)[0];
            // Don't remove owner troops from province yet - they stay until final fight
        }

        // Shuffle for random pairing
        for (let i = combatants.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [combatants[i], combatants[j]] = [combatants[j], combatants[i]];
        }

        // First pair fights, rest go to waiting queue
        const first = combatants[0];
        const second = combatants[1];
        const waiting = combatants.slice(2);

        const battle = this.createBattle(provinceId, first, second, {
            isSanryo: true, // collisions are always Sanryō
            bracketRound: 1,
            bracketId,
            waitingAttackers: waiting,
            provinceOwnerTroops
        });

        return battle;
    },

    // ============================================================
    // Battle Resolution
    // ============================================================

    getPendingBattles() {
        return GameState.battles.filter(b => b.status === "pending");
    },

    resolveBattle(battleId, winningSide) {
        const numId = Number(battleId);
        const battle = GameState.battles.find(b => b.id === numId);
        if (!battle) return { success: false, error: "Battle not found" };
        if (battle.status === "resolved") return { success: false, error: "Battle already resolved" };
        if (winningSide !== "attacker" && winningSide !== "defender") {
            return { success: false, error: "Must pick 'attacker' or 'defender'" };
        }

        battle.status = "resolved";
        battle.winner = winningSide;

        const winners = battle[winningSide];
        const losers = battle[winningSide === "attacker" ? "defender" : "attacker"];
        battle.winnerClans = [...winners.clans];

        const province = GameState.provinces[battle.province];
        const provData = PROVINCE_MAP[battle.province];

        // Losers lose ALL troops (routed) - add to casualty recovery
        const loserNames = losers.clans.map(c => GameState.getClan(c).name);
        for (const [clanId, troops] of Object.entries(losers.armyBreakdown)) {
            ArmySystem.addCasualties(clanId, troops);
        }

        // Winner takes 30% casualties - add to casualty recovery
        const casualtyRate = 0.3;
        const winnerSurviving = {};
        let totalCasualties = 0;
        for (const [clanId, troops] of Object.entries(winners.armyBreakdown)) {
            const casualties = Math.floor(troops * casualtyRate);
            totalCasualties += casualties;
            winnerSurviving[clanId] = troops - casualties;
            ArmySystem.addCasualties(clanId, casualties);
        }

        const winnerNames = winners.clans.map(c => GameState.getClan(c).name);

        // Check what happens next
        const waiting = battle.waitingAttackers;
        const hasOwner = battle.provinceOwnerTroops;

        if (waiting.length > 0) {
            // Chain battle: winner fights next in queue
            const next = waiting.shift();
            const remainingWaiting = [...waiting];

            // Create chain battle
            const winnerSide = {
                clans: winners.clans,
                armyBreakdown: { ...winnerSurviving }
            };

            const newBattle = this.createBattle(battle.province, winnerSide, next, {
                isSanryo: true,
                bracketRound: (battle.bracketRound || 0) + 1,
                bracketId: battle.bracketId,
                waitingAttackers: remainingWaiting,
                provinceOwnerTroops: hasOwner
            });

            // Don't add winner troops to province yet - they go straight to next battle

            GameState.addHistory("battle",
                `${winnerNames.join(" + ")} wins! Next: bracket round ${newBattle.bracketRound}`);

        } else if (hasOwner) {
            // Bracket winner must now fight the province defender
            const winnerSide = {
                clans: winners.clans,
                armyBreakdown: { ...winnerSurviving }
            };

            // Now remove the owner's troops from province for the final fight
            this.createBattle(battle.province, winnerSide, hasOwner, {
                isSanryo: false, // final fight uses province terrain
                bracketRound: null,
                bracketId: battle.bracketId
            });

            GameState.addHistory("battle",
                `${winnerNames.join(" + ")} wins the bracket! Now fights ${hasOwner.clans.map(c => GameState.getClan(c).name).join(" + ")} for ${provData.name}`);

        } else {
            // Final resolution - winner takes/keeps province
            for (const [clanId, troops] of Object.entries(winnerSurviving)) {
                province.armies[clanId] = (province.armies[clanId] || 0) + troops;
            }
            province.owner = winners.clans[0]; // primary clan of alliance takes ownership

            // Check for pending attacks that were waiting on this battle
            this._processPendingAttacks(battle.province);

            const totalSurviving = Object.values(winnerSurviving).reduce((s, v) => s + v, 0);
            GameState.addHistory("battle",
                `${this.getBattleIcon(battle.terrain)} ${battle.battleType} at ${provData.name}: ` +
                `${winnerNames.join(" + ")} victorious! Defeated: ${loserNames.join(", ")}. ` +
                `Survivors: ${totalSurviving}, Casualties: ${totalCasualties}`);
        }

        GameState.save();

        return {
            success: true,
            winner: winnerNames.join(" + "),
            losers: loserNames,
            totalCasualties,
            hasChainBattle: waiting.length > 0 || !!hasOwner
        };
    },

    // ============================================================
    // Pending Attacks
    // ============================================================

    // Add a pending attack for a province that already has a battle
    addPendingAttack(provinceId, block) {
        if (!GameState.pendingAttacks) GameState.pendingAttacks = [];

        const existingBattle = this.getActiveBattleAt(provinceId);

        GameState.pendingAttacks.push({
            id: Date.now() + Math.random(),
            clans: block.clans,
            toProvince: provinceId,
            armyBreakdown: { ...block.armyBreakdown },
            totalTroops: Object.values(block.armyBreakdown).reduce((s, v) => s + v, 0),
            waitingForBattle: existingBattle ? existingBattle.id : null
        });

        const names = block.clans.map(c => GameState.getClan(c).name).join(" + ");
        const provName = PROVINCE_MAP[provinceId].name;
        GameState.addHistory("battle",
            `${names} arrives at ${provName} but a battle is already underway. Waiting...`);
    },

    // After a battle fully resolves at a province, check for pending attacks
    _processPendingAttacks(provinceId) {
        if (!GameState.pendingAttacks || GameState.pendingAttacks.length === 0) return;

        const pending = GameState.pendingAttacks.filter(p => p.toProvince === provinceId);
        if (pending.length === 0) return;

        // Remove from pending list
        GameState.pendingAttacks = GameState.pendingAttacks.filter(p => p.toProvince !== provinceId);

        const province = GameState.provinces[provinceId];

        // Each pending attack becomes a new hostile arrival
        pending.forEach(p => {
            // Add their troops to province temporarily
            for (const [clanId, troops] of Object.entries(p.armyBreakdown)) {
                province.armies[clanId] = (province.armies[clanId] || 0) + troops;
            }

            // Check if hostile to current owner
            const isHostile = p.clans.some(c => !GameState.areAllied(c, province.owner) && c !== province.owner);
            if (isHostile && province.owner) {
                // Build defender side from province owner
                const defenderClans = [province.owner];
                const defenderBreakdown = {};

                // Include owner's allies that have troops here
                Object.keys(province.armies).forEach(cid => {
                    if (cid !== province.owner && GameState.areAllied(cid, province.owner) && !p.clans.includes(cid)) {
                        defenderClans.push(cid);
                    }
                });
                defenderClans.forEach(cid => {
                    if (province.armies[cid]) {
                        defenderBreakdown[cid] = province.armies[cid];
                    }
                });

                const attacker = {
                    clans: p.clans,
                    armyBreakdown: { ...p.armyBreakdown }
                };
                const defender = {
                    clans: defenderClans,
                    armyBreakdown: defenderBreakdown
                };

                this.createBattle(provinceId, attacker, defender);
            }
        });
    },

    // Get active (pending) battle at a province
    getActiveBattleAt(provinceId) {
        return GameState.battles.find(b => b.province === provinceId && b.status === "pending");
    },

    // ============================================================
    // Helpers
    // ============================================================

    getBattleIcon(terrain) {
        if (terrain === "castle") return CASTLE_SIEGE.icon;
        const config = TERRAIN_CONFIG[terrain];
        return config ? config.icon : "⚔️";
    },

    // Build an alliance block from a group of clan IDs that have troops arriving
    buildAllianceBlock(clanIds, troopMap) {
        const armyBreakdown = {};
        clanIds.forEach(cid => {
            if (troopMap[cid]) {
                armyBreakdown[cid] = troopMap[cid];
            }
        });
        return {
            clans: clanIds.filter(cid => armyBreakdown[cid] > 0),
            armyBreakdown
        };
    },

    // Get summary text for a side
    getSideSummary(side) {
        return side.clans.map(c => {
            const clan = GameState.getClan(c);
            return `${clan.name} (${side.armyBreakdown[c] || 0})`;
        }).join(" + ");
    }
};
