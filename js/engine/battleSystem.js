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
            const isCastleSiege = ownerClan && ownerClan.castleProvince === provinceId;
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

        // Create war record in the database (triggers Discord war channel)
        this._createWarRecord(battle, provData);

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

        // === Proportional casualties based on force ratio ===
        const winnerTotal = winners.totalTroops;
        const loserTotal = losers.totalTroops;
        const ratio = winnerTotal / Math.max(loserTotal, 1);

        // Winner casualties: lower when outnumbering. Base 10%, scales with inverse ratio, cap 30%
        const winnerCasualtyRate = Math.min(0.30, 0.10 * (1 / Math.max(ratio, 0.1)));
        // Loser casualties: higher when outnumbered. Base 40%, scales with ratio, no cap (can lose everything)
        const loserCasualtyRate = Math.min(1.0, 0.40 * Math.max(ratio, 1));

        // Apply winner casualties
        const winnerSurviving = {};
        let totalWinnerCasualties = 0;
        for (const [clanId, troops] of Object.entries(winners.armyBreakdown)) {
            const casualties = Math.floor(troops * winnerCasualtyRate);
            totalWinnerCasualties += casualties;
            winnerSurviving[clanId] = troops - casualties;
            ArmySystem.addCasualties(clanId, casualties);
        }

        // Apply loser casualties — survivors retreat
        const loserSurviving = {};
        let totalLoserCasualties = 0;
        let totalLoserSurvivors = 0;
        for (const [clanId, troops] of Object.entries(losers.armyBreakdown)) {
            const casualties = Math.floor(troops * loserCasualtyRate);
            totalLoserCasualties += casualties;
            const surviving = troops - casualties;
            ArmySystem.addCasualties(clanId, casualties);
            if (surviving > 0) {
                loserSurviving[clanId] = surviving;
                totalLoserSurvivors += surviving;
            }
        }

        const winnerNames = winners.clans.map(c => GameState.getClan(c).name);
        const loserNames = losers.clans.map(c => GameState.getClan(c).name);

        // === Start retreat for surviving losers ===
        if (totalLoserSurvivors > 0) {
            this._startRetreat(battle.province, losers.clans, loserSurviving);
        }

        // Check what happens next
        const waiting = battle.waitingAttackers;
        const hasOwner = battle.provinceOwnerTroops;

        if (waiting.length > 0) {
            // Chain battle: winner fights next in queue
            const next = waiting.shift();
            const remainingWaiting = [...waiting];

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

            GameState.addHistory("battle",
                `${winnerNames.join(" + ")} wins! Next: bracket round ${newBattle.bracketRound}`);

        } else if (hasOwner) {
            const winnerSide = {
                clans: winners.clans,
                armyBreakdown: { ...winnerSurviving }
            };

            this.createBattle(battle.province, winnerSide, hasOwner, {
                isSanryo: false,
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

            // Protected provinces: ownership stays with permanent owner
            if (GameState.isProtectedProvince(battle.province)) {
                province.owner = GameState.getProtectedOwner(battle.province);
            } else {
                province.owner = winners.clans[0];
            }

            this._processPendingAttacks(battle.province);

            const totalSurviving = Object.values(winnerSurviving).reduce((s, v) => s + v, 0);
            const retreatMsg = totalLoserSurvivors > 0
                ? ` ${loserNames.join(", ")} retreating with ${totalLoserSurvivors} survivors.`
                : ` ${loserNames.join(", ")} routed.`;
            const protectedMsg = GameState.isProtectedProvince(battle.province)
                ? ` (Imperial territory — ownership unchanged)`
                : "";
            GameState.addHistory("battle",
                `${this.getBattleIcon(battle.terrain)} ${battle.battleType} at ${provData.name}: ` +
                `${winnerNames.join(" + ")} victorious!${retreatMsg}${protectedMsg} ` +
                `Winner casualties: ${totalWinnerCasualties}, Loser casualties: ${totalLoserCasualties}`);
        }

        GameState.save();

        return {
            success: true,
            winner: winnerNames.join(" + "),
            losers: loserNames,
            totalWinnerCasualties,
            totalLoserCasualties,
            retreating: totalLoserSurvivors,
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

    // ============================================================
    // Retreat System
    // ============================================================

    // Start a retreat: find path to allied territory, create retreat entry
    _startRetreat(fromProvinceId, clanIds, survivingBreakdown) {
        if (!GameState.retreatingArmies) GameState.retreatingArmies = [];

        // For each clan, find their own retreat path
        for (const clanId of clanIds) {
            const troops = survivingBreakdown[clanId];
            if (!troops || troops <= 0) continue;

            const path = this._findRetreatPath(fromProvinceId, clanId);
            const clan = GameState.getClan(clanId);

            GameState.retreatingArmies.push({
                id: Date.now() + Math.random(),
                clanId,
                troops,
                path,             // array of province IDs to traverse
                currentStep: 0,   // index into path (0 = first step, at battle province still)
                weeksLeft: 2,     // 2 weeks of movement
                startWeek: GameState.week,
                fromProvince: fromProvinceId,
                destination: path.length > 0 ? path[path.length - 1] : fromProvinceId,
            });

            const destName = path.length > 0 ? PROVINCE_MAP[path[path.length - 1]].name : "unknown";
            GameState.addHistory("move",
                `${clan.name} retreating from ${PROVINCE_MAP[fromProvinceId].name} toward ${destName} (${troops} survivors)`);
        }
    },

    // BFS to find nearest allied/owned province from battle site
    _findRetreatPath(fromProvinceId, clanId) {
        const allies = GameState.getAllies(clanId);
        const friendlySet = new Set([clanId, ...allies]);

        const visited = new Set([fromProvinceId]);
        // BFS queue: each entry is [provinceId, path-so-far]
        const queue = [[fromProvinceId, []]];

        while (queue.length > 0) {
            const [current, path] = queue.shift();

            const provData = PROVINCE_MAP[current];
            if (!provData) continue;

            for (const neighborId of provData.neighbors) {
                if (visited.has(neighborId)) continue;
                visited.add(neighborId);

                const newPath = [...path, neighborId];
                const neighborState = GameState.provinces[neighborId];

                // Check if this is friendly territory
                if (neighborState && neighborState.owner && friendlySet.has(neighborState.owner)) {
                    // If within 2 steps, try to go deeper (1 more step into safe territory)
                    if (newPath.length <= 2) {
                        const deeperProv = PROVINCE_MAP[neighborId];
                        if (deeperProv) {
                            for (const deepId of deeperProv.neighbors) {
                                const deepState = GameState.provinces[deepId];
                                if (deepState && deepState.owner && friendlySet.has(deepState.owner) && deepId !== fromProvinceId) {
                                    return [...newPath, deepId]; // go one deeper
                                }
                            }
                        }
                    }
                    return newPath; // return path to first friendly province
                }

                // Only keep searching within 4 hops (2 weeks = 2 moves, but allow some search depth)
                if (newPath.length < 6) {
                    queue.push([neighborId, newPath]);
                }
            }
        }

        // No friendly territory found — retreat to a random adjacent neutral province
        const provData = PROVINCE_MAP[fromProvinceId];
        if (provData && provData.neighbors.length > 0) {
            const neutral = provData.neighbors.find(n => {
                const s = GameState.provinces[n];
                return !s || !s.owner;
            });
            return neutral ? [neutral] : [provData.neighbors[0]];
        }
        return [];
    },

    // Called each week advance — move retreating armies along their path
    advanceRetreats() {
        if (!GameState.retreatingArmies) return;

        const completed = [];
        const ongoing = [];

        for (const retreat of GameState.retreatingArmies) {
            retreat.weeksLeft--;
            retreat.currentStep++;

            if (retreat.weeksLeft <= 0 || retreat.currentStep >= retreat.path.length) {
                // Retreat complete — place troops at destination
                const destId = retreat.currentStep < retreat.path.length
                    ? retreat.path[retreat.currentStep]
                    : retreat.path[retreat.path.length - 1] || retreat.fromProvince;

                const dest = GameState.provinces[destId];
                if (dest) {
                    dest.armies[retreat.clanId] = (dest.armies[retreat.clanId] || 0) + retreat.troops;
                }

                const clan = GameState.getClan(retreat.clanId);
                const destName = PROVINCE_MAP[destId] ? PROVINCE_MAP[destId].name : "unknown";
                GameState.addHistory("move",
                    `${clan.name} retreat complete — ${retreat.troops} troops arrived at ${destName}`);
                completed.push(retreat);
            } else {
                ongoing.push(retreat);
            }
        }

        GameState.retreatingArmies = ongoing;
    },

    // Get retreating armies at/through a province (for map display)
    getRetreatingArmiesAtProvince(provinceId) {
        if (!GameState.retreatingArmies) return [];
        return GameState.retreatingArmies.filter(r => {
            // Show at current position along the path
            if (r.currentStep === 0) return r.fromProvince === provinceId;
            const idx = Math.min(r.currentStep, r.path.length - 1);
            return r.path[idx] === provinceId;
        });
    },

    // Get all retreating armies for a clan (for troop counting)
    getRetreatingTroops(clanId) {
        if (!GameState.retreatingArmies) return 0;
        return GameState.retreatingArmies
            .filter(r => r.clanId === clanId)
            .reduce((sum, r) => sum + r.troops, 0);
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
    },

    // Create a war record in the DB (triggers Discord channel creation)
    async _createWarRecord(battle, provData) {
        if (!API.enabled) return;
        try {
            // Build war_data with clan info for the Discord channel
            const buildSide = (side) => {
                return side.clans.map(clanId => {
                    const clan = GameState.getClan(clanId);
                    const daimyo = clan && clan.daimyo;
                    // Look up daimyo discord ID from linked accounts (server-side handles this)
                    return {
                        clanId,
                        name: clan ? clan.name : clanId,
                        troops: side.armyBreakdown[clanId] || 0,
                        daimyoRobloxId: daimyo ? daimyo.robloxId : null,
                    };
                });
            };

            const sides = [
                ...buildSide(battle.attacker),
                ...buildSide(battle.defender),
            ];

            // Discord ID resolution is handled server-side in POST /wars

            // Include waiting clans for bracket display
            // waitingAttackers = non-owner clans waiting their turn
            // provinceOwnerTroops = province owner who fights the bracket winner
            const allWaiting = [...(battle.waitingAttackers || [])];
            if (battle.provinceOwnerTroops) {
                allWaiting.push(battle.provinceOwnerTroops);
            }
            const waitingClans = allWaiting.map(block => {
                return block.clans.map(clanId => {
                    const clan = GameState.getClan(clanId);
                    const daimyo = clan && clan.daimyo;
                    return {
                        clanId,
                        name: clan ? clan.name : clanId,
                        troops: block.armyBreakdown[clanId] || 0,
                        daimyoRobloxId: daimyo ? daimyo.robloxId : null,
                    };
                });
            }).flat();

            const isBracket = battle.bracketRound || waitingClans.length > 0;

            const warData = {
                provinceName: provData.name,
                battleType: battle.battleType,
                terrain: battle.terrain,
                sides,
                battleId: battle.id,
                week: battle.week,
                bracketRound: battle.bracketRound || null,
                bracketId: battle.bracketId || null,
                waitingClans: waitingClans.length > 0 ? waitingClans : null,
                isBracket: isBracket || false,
            };

            await API.createWar(battle.province, warData);
        } catch (err) {
            console.warn("[BattleSystem] Failed to create war record:", err.message);
        }
    }
};
