// Army System - Levy raising, splitting, rally cap enforcement
const ArmySystem = {
    // Raise levy in a province owned by the clan
    raiseLevy(clanId, provinceId, amount) {
        const clan = GameState.getClan(clanId);
        const province = GameState.provinces[provinceId];
        if (!clan || !province) return { success: false, error: "Invalid clan or province" };
        if (province.owner !== clanId) return { success: false, error: "You don't own this province" };
        if (GameState.phase !== "planning") return { success: false, error: "Can only raise levies during Planning Phase" };

        const currentTotal = GameState.getTotalTroops(clanId);
        const maxRaise = clan.rallyCap - currentTotal;
        if (maxRaise <= 0) return { success: false, error: `Rally Cap reached (${clan.rallyCap})` };

        const actual = Math.min(amount, maxRaise);
        province.armies[clanId] = (province.armies[clanId] || 0) + actual;

        GameState.addHistory("system", `${clan.name} raised ${actual} levies in ${PROVINCE_MAP[provinceId].name}`);
        GameState.save();

        return { success: true, raised: actual, total: province.armies[clanId] };
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

    // Get rally cap info for a clan
    getRallyInfo(clanId) {
        const clan = GameState.getClan(clanId);
        if (!clan) return null;
        const total = GameState.getTotalTroops(clanId);
        return {
            current: total,
            cap: clan.rallyCap,
            available: Math.max(0, clan.rallyCap - total),
            percentage: Math.round((total / clan.rallyCap) * 100)
        };
    },

    // Get all armies in a province
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
    }
};
