// Movement & Orders System
const MoveSystem = {
    // Create a movement order
    createOrder(clanId, fromProvince, toProvince, troops) {
        if (GameState.phase !== "planning") {
            return { success: false, error: "Can only create orders during Planning Phase" };
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

        const clan = GameState.getClan(clanId);
        GameState.addHistory("move",
            `${clan.name} orders ${troops} troops: ${from.name} → ${to.name} (pending)`);

        return { success: true, order };
    },

    // Commit an order (locks it in)
    commitOrder(orderId) {
        const order = GameState.orders.find(o => o.id === orderId);
        if (!order) return { success: false, error: "Order not found" };
        if (order.status === "committed") return { success: false, error: "Already committed" };

        order.status = "committed";
        order.committedAt = new Date().toISOString();
        GameState.save();

        const clan = GameState.getClan(order.clanId);
        const from = PROVINCE_MAP[order.fromProvince];
        const to = PROVINCE_MAP[order.toProvince];
        GameState.addHistory("move",
            `${clan.name} committed ${order.troops} troops: ${from.name} → ${to.name}`);

        return { success: true };
    },

    // Uncommit an order (12-hour grace period)
    uncommitOrder(orderId) {
        const order = GameState.orders.find(o => o.id === orderId);
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

        return { success: true };
    },

    // Cancel a pending order
    cancelOrder(orderId) {
        const idx = GameState.orders.findIndex(o => o.id === orderId);
        if (idx === -1) return { success: false, error: "Order not found" };

        const order = GameState.orders[idx];
        if (order.status === "committed") {
            return { success: false, error: "Cannot cancel committed orders. Uncommit first." };
        }

        GameState.orders.splice(idx, 1);
        GameState.save();
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

    // Process all committed orders (admin action - executes moves)
    processOrders() {
        const committedOrders = GameState.orders.filter(o => o.status === "committed");

        if (committedOrders.length === 0) {
            return { success: false, error: "No committed orders to process" };
        }

        // Execute each order: remove troops from source, add to destination
        const movements = []; // Track for collision detection

        committedOrders.forEach(order => {
            const fromProv = GameState.provinces[order.fromProvince];
            const toProv = GameState.provinces[order.toProvince];

            // Remove from source
            if (fromProv.armies[order.clanId]) {
                fromProv.armies[order.clanId] -= order.troops;
                if (fromProv.armies[order.clanId] <= 0) {
                    delete fromProv.armies[order.clanId];
                }
            }

            // Track movement
            movements.push({
                clanId: order.clanId,
                toProvince: order.toProvince,
                troops: order.troops
            });

            const clan = GameState.getClan(order.clanId);
            const from = PROVINCE_MAP[order.fromProvince];
            const to = PROVINCE_MAP[order.toProvince];
            GameState.addHistory("move",
                `${clan.name} moved ${order.troops} troops from ${from.name} to ${to.name}`);
        });

        // Group movements by destination
        const byDestination = {};
        movements.forEach(m => {
            if (!byDestination[m.toProvince]) byDestination[m.toProvince] = [];
            byDestination[m.toProvince].push(m);
        });

        // Detect collisions and generate battles
        Object.entries(byDestination).forEach(([provId, movers]) => {
            const province = GameState.provinces[provId];
            const existingArmies = Object.keys(province.armies).filter(cid => province.armies[cid] > 0);

            // Collect all clans that will be in this province
            const allClans = new Set(existingArmies);
            movers.forEach(m => allClans.add(m.clanId));

            // Add arriving troops to province
            movers.forEach(m => {
                province.armies[m.clanId] = (province.armies[m.clanId] || 0) + m.troops;
            });

            // Check for hostile encounter (non-allied clans meeting)
            const clanList = Array.from(allClans);
            const hostileGroups = this._findHostileGroups(clanList);

            if (hostileGroups.length > 1) {
                const provData = PROVINCE_MAP[provId];
                const terrain = TERRAIN_CONFIG[provData.terrain];

                const battle = {
                    id: Date.now() + Math.random(),
                    province: provId,
                    provinceName: provData.name,
                    battleType: terrain.battleType,
                    terrain: provData.terrain,
                    participants: {},
                    status: "pending", // "pending", "resolved"
                    winner: null,
                    week: GameState.week
                };

                // Add each clan's forces
                clanList.forEach(cid => {
                    if (province.armies[cid] > 0) {
                        battle.participants[cid] = {
                            troops: province.armies[cid],
                            clan: GameState.getClan(cid)
                        };
                    }
                });

                GameState.battles.push(battle);
                GameState.addHistory("battle",
                    `Battle at ${provData.name}! ${terrain.battleType} - ${clanList.map(c => GameState.getClan(c).name).join(" vs ")}`);
            }
        });

        // Clear processed orders
        GameState.orders = GameState.orders.filter(o => o.status !== "committed");
        GameState.save();

        return {
            success: true,
            movesProcessed: committedOrders.length,
            battlesGenerated: GameState.battles.filter(b => b.status === "pending").length
        };
    },

    // Find groups of hostile (non-allied) clans
    _findHostileGroups(clanIds) {
        if (clanIds.length <= 1) return [clanIds];

        // Build alliance groups
        const groups = [];
        const assigned = new Set();

        clanIds.forEach(cid => {
            if (assigned.has(cid)) return;
            const group = [cid];
            assigned.add(cid);

            clanIds.forEach(otherId => {
                if (otherId !== cid && !assigned.has(otherId) && GameState.areAllied(cid, otherId)) {
                    group.push(otherId);
                    assigned.add(otherId);
                }
            });

            groups.push(group);
        });

        return groups;
    }
};
