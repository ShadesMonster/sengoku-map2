// Movement & Orders System
const MoveSystem = {
    // Create a movement order
    createOrder(clanId, fromProvince, toProvince, troops) {
        if (GameState.phase !== "planning") {
            return { success: false, error: "Can only create orders during Planning Phase" };
        }

        // Block new orders if clan already has committed orders
        const hasCommitted = GameState.orders.some(o => o.clanId === clanId && o.status === "committed");
        if (hasCommitted) {
            return { success: false, error: "Orders already committed for this week. Uncommit first to make changes." };
        }

        const from = PROVINCE_MAP[fromProvince];
        const to = PROVINCE_MAP[toProvince];
        if (!from || !to) return { success: false, error: "Invalid province" };

        // Check adjacency
        if (!from.neighbors.includes(toProvince)) {
            return { success: false, error: `${to.name} is not adjacent to ${from.name}` };
        }

        // Check if clan has troops there
        const available = ArmySystem.getArmyInProvince(clanId, fromProvince);
        // Subtract troops already committed from this province
        const committed = this.getOrdersFrom(clanId, fromProvince)
            .reduce((sum, o) => sum + o.troops, 0);
        const canMove = available - committed;

        if (troops > canMove) {
            return { success: false, error: `Only ${canMove} troops available (${committed} already ordered)` };
        }
        if (troops <= 0) {
            return { success: false, error: "Must move at least 1 troop" };
        }
        if (troops % TROOP_UNIT !== 0) {
            return { success: false, error: `Must move in units of ${TROOP_UNIT}` };
        }

        const order = {
            id: Date.now() + Math.random(),
            clanId,
            fromProvince,
            toProvince,
            troops,
            status: "pending", // "pending" or "committed"
            createdAt: new Date().toISOString(),
            committedAt: null
        };

        GameState.orders.push(order);
        GameState.save();
        GameState.flushNow();

        const clan = GameState.getClan(clanId);
        GameState.addHistory("move",
            `${clan.name} orders ${troops} troops: ${from.name} → ${to.name} (pending)`);

        return { success: true, order };
    },

    // Commit an order (locks it in)
    commitOrder(orderId) {
        const numId = Number(orderId);
        const order = GameState.orders.find(o => o.id === numId);
        if (!order) return { success: false, error: "Order not found" };
        if (order.status === "committed") return { success: false, error: "Already committed" };

        order.status = "committed";
        order.committedAt = new Date().toISOString();
        GameState.save();
        GameState.flushNow();

        const clan = GameState.getClan(order.clanId);
        const from = PROVINCE_MAP[order.fromProvince];
        const to = PROVINCE_MAP[order.toProvince];
        GameState.addHistory("move",
            `${clan.name} committed ${order.troops} troops: ${from.name} → ${to.name}`);

        return { success: true };
    },

    // Uncommit an order (12-hour grace period)
    uncommitOrder(orderId) {
        const numId = Number(orderId);
        const order = GameState.orders.find(o => o.id === numId);
        if (!order) return { success: false, error: "Order not found" };
        if (order.status !== "committed") return { success: false, error: "Order is not committed" };

        // Check 12-hour grace period
        const committedAt = new Date(order.committedAt);
        const now = new Date();
        const hoursSince = (now - committedAt) / (1000 * 60 * 60);

        if (hoursSince > 12) {
            return { success: false, error: "12-hour grace period has expired. Cannot uncommit." };
        }

        order.status = "pending";
        order.committedAt = null;
        GameState.save();
        GameState.flushNow();

        return { success: true };
    },

    // Cancel a pending order
    cancelOrder(orderId) {
        const numId = Number(orderId);
        const idx = GameState.orders.findIndex(o => o.id === numId);
        if (idx === -1) return { success: false, error: "Order not found" };

        const order = GameState.orders[idx];
        if (order.status === "committed") {
            return { success: false, error: "Cannot cancel committed orders. Uncommit first." };
        }

        GameState.orders.splice(idx, 1);
        GameState.save();
        GameState.flushNow();
        return { success: true };
    },

    // Get all orders for a clan
    getOrders(clanId) {
        return GameState.orders.filter(o => o.clanId === clanId);
    },

    // Get orders from a specific province
    getOrdersFrom(clanId, provinceId) {
        return GameState.orders.filter(o => o.clanId === clanId && o.fromProvince === provinceId);
    },

    // ============================================================
    // Process all committed orders (admin action)
    // Full army flow: deduct → classify → reinforce/claim/battle
    // ============================================================
    processOrders() {
        const committedOrders = GameState.orders.filter(o => o.status === "committed");

        if (committedOrders.length === 0) {
            return { success: false, error: "No committed orders to process" };
        }

        // Step 1: Deduct all troops from source provinces
        committedOrders.forEach(order => {
            const fromProv = GameState.provinces[order.fromProvince];
            if (fromProv.armies[order.clanId]) {
                fromProv.armies[order.clanId] -= order.troops;
                if (fromProv.armies[order.clanId] <= 0) {
                    delete fromProv.armies[order.clanId];
                }
            }

            const clan = GameState.getClan(order.clanId);
            const from = PROVINCE_MAP[order.fromProvince];
            const to = PROVINCE_MAP[order.toProvince];
            GameState.addHistory("move",
                `${clan.name} marched ${order.troops} troops from ${from.name} to ${to.name}`);
        });

        // Step 2: Group movements by destination
        const byDestination = {};
        committedOrders.forEach(order => {
            if (!byDestination[order.toProvince]) byDestination[order.toProvince] = [];
            byDestination[order.toProvince].push(order);
        });

        // Step 3: Process each destination
        let battlesGenerated = 0;

        Object.entries(byDestination).forEach(([provId, orders]) => {
            const result = this._processDestination(provId, orders);
            battlesGenerated += result.battles;
        });

        // Clear processed orders
        GameState.orders = GameState.orders.filter(o => o.status !== "committed");
        GameState.save();

        return {
            success: true,
            movesProcessed: committedOrders.length,
            battlesGenerated
        };
    },

    // Process all arrivals at a single province
    _processDestination(provId, orders) {
        const province = GameState.provinces[provId];
        const provData = PROVINCE_MAP[provId];

        // Build a map of arriving troops per clan
        const arrivingTroops = {};
        orders.forEach(o => {
            arrivingTroops[o.clanId] = (arrivingTroops[o.clanId] || 0) + o.troops;
        });
        const arrivingClans = Object.keys(arrivingTroops);

        // Build a map of existing troops in province
        const existingTroops = {};
        Object.entries(province.armies).forEach(([cid, count]) => {
            if (count > 0) existingTroops[cid] = count;
        });
        const existingClans = Object.keys(existingTroops);

        // All clans that will be present
        const allClanIds = [...new Set([...arrivingClans, ...existingClans])];

        // Combined troop map (for building alliance blocks)
        const combinedTroops = {};
        allClanIds.forEach(cid => {
            combinedTroops[cid] = (existingTroops[cid] || 0) + (arrivingTroops[cid] || 0);
        });

        // Find hostile groups (alliance blocks)
        const hostileGroups = this._findHostileGroups(allClanIds);

        // --- CASE 1: Only friendlies (1 alliance block) ---
        if (hostileGroups.length <= 1) {
            // Reinforcement or claim
            arrivingClans.forEach(cid => {
                province.armies[cid] = (province.armies[cid] || 0) + arrivingTroops[cid];
            });

            // If province is unowned, first arriving clan claims it (unless protected)
            if (!province.owner && arrivingClans.length > 0) {
                if (GameState.isProtectedProvince(provId)) {
                    province.owner = GameState.getProtectedOwner(provId);
                    GameState.addHistory("move",
                        `${GameState.getClan(arrivingClans[0]).name} occupies imperial territory ${provData.name}`);
                } else {
                    province.owner = arrivingClans[0];
                    const clan = GameState.getClan(arrivingClans[0]);
                    GameState.addHistory("move",
                        `${clan.name} claims uncontrolled ${provData.name}`);
                }
            }
            return { battles: 0 };
        }

        // --- There are hostiles. First, add all arriving troops to province ---
        arrivingClans.forEach(cid => {
            province.armies[cid] = (province.armies[cid] || 0) + arrivingTroops[cid];
        });

        // Build alliance blocks with troop counts
        const allianceBlocks = hostileGroups.map(group => {
            return BattleSystem.buildAllianceBlock(group, combinedTroops);
        }).filter(block => block.clans.length > 0);

        // Check for active battle already at this province
        const activeBattle = BattleSystem.getActiveBattleAt(provId);
        if (activeBattle) {
            // Pending attacks - queue up behind existing battle
            const attackerBlocks = allianceBlocks.filter(block =>
                !block.clans.some(c => c === province.owner || GameState.areAllied(c, province.owner))
            );
            attackerBlocks.forEach(block => {
                BattleSystem.addPendingAttack(provId, block);
            });
            return { battles: 0 };
        }

        // --- CASE 2: Auto-win (province owner has 0 troops) ---
        if (province.owner) {
            const ownerBlock = allianceBlocks.find(block => block.clans.includes(province.owner));
            if (!ownerBlock || Object.values(ownerBlock.armyBreakdown).reduce((s, v) => s + v, 0) === 0) {
                // Owner has no troops
                const hostileBlocks = allianceBlocks.filter(block =>
                    !block.clans.some(c => c === province.owner || GameState.areAllied(c, province.owner))
                );
                if (hostileBlocks.length === 1) {
                    // Single hostile block takes it unopposed (unless protected)
                    if (GameState.isProtectedProvince(provId)) {
                        province.owner = GameState.getProtectedOwner(provId);
                    } else {
                        province.owner = hostileBlocks[0].clans[0];
                    }
                    GameState.addHistory("move",
                        `${GameState.getClan(hostileBlocks[0].clans[0]).name} takes undefended ${provData.name}`);
                    return { battles: 0 };
                }
                // Multiple hostile blocks at undefended province - bracket with no defender
                province.owner = null;
                BattleSystem.createBracketBattles(provId, hostileBlocks);
                return { battles: 1 };
            }
        }

        // --- Identify attacker vs defender ---
        let defenderBlock = null;
        let attackerBlocks = [];

        if (province.owner) {
            allianceBlocks.forEach(block => {
                if (block.clans.includes(province.owner)) {
                    defenderBlock = block;
                } else {
                    // Check if entire block is allied with province owner
                    const allAllied = block.clans.every(c =>
                        GameState.areAllied(c, province.owner) || c === province.owner
                    );
                    if (allAllied && defenderBlock) {
                        // Allied defense: merge into defender block
                        block.clans.forEach(c => {
                            if (!defenderBlock.clans.includes(c)) {
                                defenderBlock.clans.push(c);
                            }
                            defenderBlock.armyBreakdown[c] = (defenderBlock.armyBreakdown[c] || 0) + (block.armyBreakdown[c] || 0);
                        });
                    } else {
                        attackerBlocks.push(block);
                    }
                }
            });
        } else {
            // No owner - all blocks are attackers
            attackerBlocks = [...allianceBlocks];
        }

        // --- CASE 3: Simple attack (1 attacker vs defender) ---
        if (attackerBlocks.length === 1 && defenderBlock) {
            BattleSystem.createBattle(provId, attackerBlocks[0], defenderBlock);
            return { battles: 1 };
        }

        // --- CASE 4: Multi-clan collision (bracket) ---
        if (attackerBlocks.length >= 2) {
            let bracketBlocks = [...attackerBlocks];
            if (defenderBlock) {
                bracketBlocks.push(defenderBlock);
            }
            BattleSystem.createBracketBattles(provId, bracketBlocks);
            return { battles: 1 };
        }

        // --- CASE 5: Single attacker, no defender (uncontrolled) ---
        if (attackerBlocks.length === 1 && !defenderBlock) {
            if (GameState.isProtectedProvince(provId)) {
                province.owner = GameState.getProtectedOwner(provId);
            } else {
                province.owner = attackerBlocks[0].clans[0];
            }
            GameState.addHistory("move",
                `${GameState.getClan(attackerBlocks[0].clans[0]).name} claims ${provData.name}`);
            return { battles: 0 };
        }

        return { battles: 0 };
    },

    // Find groups of hostile (non-allied) clans using union-find
    // so transitive alliances are handled correctly (A-B allied, B-C allied => A,B,C grouped)
    _findHostileGroups(clanIds) {
        if (clanIds.length <= 1) return [clanIds];

        // Union-find with path compression
        const parent = {};
        clanIds.forEach(id => { parent[id] = id; });

        function find(x) {
            if (parent[x] !== x) parent[x] = find(parent[x]);
            return parent[x];
        }
        function union(a, b) {
            parent[find(a)] = find(b);
        }

        // Merge all allied pairs
        for (let i = 0; i < clanIds.length; i++) {
            for (let j = i + 1; j < clanIds.length; j++) {
                if (GameState.areAllied(clanIds[i], clanIds[j])) {
                    union(clanIds[i], clanIds[j]);
                }
            }
        }

        // Collect groups by root
        const groupMap = {};
        clanIds.forEach(cid => {
            const root = find(cid);
            if (!groupMap[root]) groupMap[root] = [];
            groupMap[root].push(cid);
        });

        return Object.values(groupMap);
    }
};
