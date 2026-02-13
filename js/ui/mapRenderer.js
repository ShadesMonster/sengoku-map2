// Map Renderer - Colors provinces from embedded japan.svg, draws armies/arrows/labels
const MapRenderer = {
    svg: null,
    armiesLayer: null,
    arrowsLayer: null,
    labelsLayer: null,

    init() {
        this.svg = document.getElementById("game-map");
        this.armiesLayer = document.getElementById("armies-layer");
        this.arrowsLayer = document.getElementById("arrows-layer");
        this.labelsLayer = document.getElementById("labels-layer");

        this.initProvincePaths();
        this.initYezoPaths();
        this.drawLabels();
    },

    // Add data attributes and classes to existing SVG paths
    initProvincePaths() {
        PROVINCES.forEach(prov => {
            // Sample border points along each SVG path for arrow routing
            prov._borderPoints = [];
            prov.pathIds.forEach(pid => {
                const path = this.svg.getElementById(pid);
                if (!path) return;
                path.setAttribute("data-province", prov.id);
                path.classList.add("province-path");
                path.removeAttribute("style");
                path.setAttribute("stroke", "#555544");
                path.setAttribute("stroke-width", "0.8");
                const len = path.getTotalLength();
                const step = 3; // sample every ~3 SVG units
                const samples = Math.max(20, Math.round(len / step));
                for (let i = 0; i < samples; i++) {
                    const pt = path.getPointAtLength((i / samples) * len);
                    prov._borderPoints.push({ x: pt.x, y: pt.y });
                }
            });
        });
    },

    // Find the closest point on province border to a target point
    _closestBorderPoint(prov, target) {
        let best = prov.center;
        let bestDist = Infinity;
        for (const pt of prov._borderPoints) {
            const dx = pt.x - target.x;
            const dy = pt.y - target.y;
            const d = dx * dx + dy * dy;
            if (d < bestDist) {
                bestDist = d;
                best = pt;
            }
        }
        return best;
    },

    // Get arrow endpoints: closest border points between two provinces
    _getArrowEndpoints(fromProv, toProv) {
        // Step 1: rough target = closest point on B's border to A's label center
        const roughTo = this._closestBorderPoint(toProv, fromProv.center);
        // Step 2: from point = closest point on A's border toward that rough target
        const fromPt = this._closestBorderPoint(fromProv, roughTo);
        // Step 3: refine to point = closest point on B's border to the from point
        const toPt = this._closestBorderPoint(toProv, fromPt);
        return { from: fromPt, to: toPt };
    },

    // Style Yezo/Hokkaido as non-interactive decoration
    initYezoPaths() {
        YEZO_PATH_IDS.forEach(pid => {
            const path = this.svg.getElementById(pid);
            if (!path) return;
            path.removeAttribute("style");
            path.setAttribute("fill", "#2a2a1e");
            path.setAttribute("fill-opacity", "0.3");
            path.setAttribute("stroke", "#444438");
            path.setAttribute("stroke-width", "0.6");
            path.classList.add("yezo-path");
        });
    },

    drawLabels() {
        this.labelsLayer.innerHTML = "";

        PROVINCES.forEach(prov => {
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", prov.center.x);
            text.setAttribute("y", prov.center.y - 2);
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("font-size", "5");
            text.setAttribute("fill", "#e8d5b0");
            text.setAttribute("pointer-events", "none");
            text.setAttribute("font-family", "'Noto Sans JP', sans-serif");
            text.textContent = prov.japaneseName;

            const text2 = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text2.setAttribute("x", prov.center.x);
            text2.setAttribute("y", prov.center.y + 4);
            text2.setAttribute("text-anchor", "middle");
            text2.setAttribute("font-size", "3.5");
            text2.setAttribute("fill", "#b8a880");
            text2.setAttribute("pointer-events", "none");
            text2.setAttribute("font-family", "'Noto Sans JP', sans-serif");
            text2.textContent = prov.name;

            this.labelsLayer.appendChild(text);
            this.labelsLayer.appendChild(text2);
        });
    },

    drawArmies() {
        this.armiesLayer.innerHTML = "";

        PROVINCES.forEach(prov => {
            const state = GameState.provinces[prov.id];
            if (!state) return;

            const armies = Object.entries(state.armies).filter(([, count]) => count > 0);
            const battleTroops = ArmySystem.getBattleTroopsAtProvince(prov.id);
            const hasBattle = battleTroops.length > 0;

            if (armies.length === 0 && !hasBattle) return;

            const baseX = prov.center.x;
            const baseY = prov.center.y + 8;

            // Draw normal (on-ground) armies
            armies.forEach(([clanId, count], i) => {
                const clan = GameState.getClan(clanId);
                if (!clan) return;

                const offsetX = (i - (armies.length - 1) / 2) * 12;
                this._drawArmyChip(baseX + offsetX, baseY, clan, count, 0.9);
            });

            // Draw battle indicator: attackers LEFT ⚔ defenders RIGHT
            if (hasBattle) {
                const battleY = baseY + (armies.length > 0 ? 10 : 0);

                // Split troops by side
                const attackers = battleTroops.filter(bt => bt.side === "attacker");
                const defenders = battleTroops.filter(bt => bt.side === "defender");

                // Attackers on the left
                attackers.forEach((bt, i) => {
                    const offsetX = -(8 + i * 12);
                    this._drawArmyChip(baseX + offsetX, battleY + 2, bt.clan, bt.count, 0.75);
                });

                // Crossed swords icon in center
                const icon = document.createElementNS("http://www.w3.org/2000/svg", "text");
                icon.setAttribute("x", baseX);
                icon.setAttribute("y", battleY + 4);
                icon.setAttribute("text-anchor", "middle");
                icon.setAttribute("font-size", "7");
                icon.setAttribute("pointer-events", "none");
                icon.textContent = "⚔";
                this.armiesLayer.appendChild(icon);

                // Defenders on the right
                defenders.forEach((bt, i) => {
                    const offsetX = 8 + i * 12;
                    this._drawArmyChip(baseX + offsetX, battleY + 2, bt.clan, bt.count, 0.75);
                });
            }
        });
    },

    _drawArmyChip(x, y, clan, count, opacity) {
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", x - 6);
        rect.setAttribute("y", y - 4);
        rect.setAttribute("width", "12");
        rect.setAttribute("height", "8");
        rect.setAttribute("rx", "1.5");
        rect.setAttribute("fill", clan.color);
        rect.setAttribute("stroke", "#000");
        rect.setAttribute("stroke-width", "0.3");
        rect.setAttribute("opacity", opacity);

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", x);
        text.setAttribute("y", y + 2);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("font-size", "4.5");
        text.setAttribute("font-weight", "bold");
        text.setAttribute("fill", "#fff");
        text.setAttribute("pointer-events", "none");
        text.setAttribute("font-family", "sans-serif");
        text.setAttribute("opacity", opacity);
        text.textContent = this.formatTroops(count);

        this.armiesLayer.appendChild(rect);
        this.armiesLayer.appendChild(text);
    },

    drawArrows() {
        this.arrowsLayer.innerHTML = "";

        GameState.orders.forEach(order => {
            const from = PROVINCE_MAP[order.fromProvince];
            const to = PROVINCE_MAP[order.toProvince];
            if (!from || !to) return;

            const clan = GameState.getClan(order.clanId);
            if (!clan) return;

            if (GameState.selectedClan && order.clanId !== GameState.selectedClan) return;

            const isPending = order.status === "pending";
            const color = isPending ? "#f0c040" : "#40c060";
            const markerEnd = isPending ? "url(#arrow-pending)" : "url(#arrow-committed)";
            const dashArray = isPending ? "3,2" : "none";

            const { from: fromPt, to: toPt } = this._getArrowEndpoints(from, to);

            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", fromPt.x);
            line.setAttribute("y1", fromPt.y);
            line.setAttribute("x2", toPt.x);
            line.setAttribute("y2", toPt.y);
            line.setAttribute("stroke", color);
            line.setAttribute("stroke-width", "1.5");
            line.setAttribute("stroke-dasharray", dashArray);
            line.setAttribute("marker-end", markerEnd);
            line.setAttribute("opacity", "0.8");
            line.setAttribute("class", "order-arrow");

            const midX = (fromPt.x + toPt.x) / 2;
            const midY = (fromPt.y + toPt.y) / 2;

            const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
            label.setAttribute("x", midX);
            label.setAttribute("y", midY - 3);
            label.setAttribute("text-anchor", "middle");
            label.setAttribute("font-size", "4");
            label.setAttribute("font-weight", "bold");
            label.setAttribute("fill", color);
            label.setAttribute("pointer-events", "none");
            label.textContent = order.troops;

            this.arrowsLayer.appendChild(line);
            this.arrowsLayer.appendChild(label);
        });
    },

    update() {
        this.updateProvinceColors();
        this.drawArmies();
        this.drawArrows();
    },

    updateProvinceColors() {
        PROVINCES.forEach(prov => {
            const state = GameState.provinces[prov.id];
            prov.pathIds.forEach(pid => {
                const path = this.svg.getElementById(pid);
                if (!path) return;

                if (state && state.owner) {
                    const clan = GameState.getClan(state.owner);
                    if (clan) {
                        path.setAttribute("fill", clan.color);
                        path.setAttribute("fill-opacity", "0.65");
                        return;
                    }
                }
                path.setAttribute("fill", "#3a3a2a");
                path.setAttribute("fill-opacity", "0.5");
            });
        });
    },

    // Move province paths to front (just before armies layer) so borders render on top
    bringToFront(provinceId) {
        const prov = PROVINCE_MAP[provinceId];
        if (!prov) return;
        prov.pathIds.forEach(pid => {
            const path = this.svg.getElementById(pid);
            if (path) this.armiesLayer.parentNode.insertBefore(path, this.armiesLayer);
        });
    },

    highlightProvince(provinceId, highlight) {
        const prov = PROVINCE_MAP[provinceId];
        if (!prov) return;
        if (highlight) this.bringToFront(provinceId);
        prov.pathIds.forEach(pid => {
            const path = this.svg.getElementById(pid);
            if (!path) return;
            if (highlight) {
                path.classList.add("highlighted");
            } else {
                path.classList.remove("highlighted");
            }
        });
    },

    highlightTargets(provinceId) {
        const prov = PROVINCE_MAP[provinceId];
        if (!prov) return;
        // Bring targets to front, then selected on top
        prov.neighbors.forEach(nId => {
            this.bringToFront(nId);
            const np = PROVINCE_MAP[nId];
            if (!np) return;
            np.pathIds.forEach(pid => {
                const path = this.svg.getElementById(pid);
                if (path) path.classList.add("move-target");
            });
        });
        this.bringToFront(provinceId);
    },

    clearTargetHighlights() {
        this.svg.querySelectorAll(".move-target").forEach(el => {
            el.classList.remove("move-target");
        });
    },

    formatTroops(n) {
        if (n >= 1000) return (n / 1000).toFixed(1) + "k";
        return n.toString();
    }
};
