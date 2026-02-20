// Map Renderer - Colors provinces from embedded japan.svg, draws armies/arrows/labels
const MapRenderer = {
    svg: null,
    armiesLayer: null,
    arrowsLayer: null,
    labelsLayer: null,
    hoverLayer: null,

    init() {
        this.svg = document.getElementById("game-map");
        this.armiesLayer = document.getElementById("armies-layer");
        this.arrowsLayer = document.getElementById("arrows-layer");
        this.labelsLayer = document.getElementById("labels-layer");
        this.hoverLayer = document.getElementById("hover-layer");

        this.initProvincePaths();
        this.initYezoPaths();
        this.drawLabels();
    },

    // Add data attributes and classes to existing SVG paths
    initProvincePaths() {
        const svgPt = this.svg.createSVGPoint();

        PROVINCES.forEach(prov => {
            const paths = [];
            prov.pathIds.forEach(pid => {
                const path = this.svg.getElementById(pid);
                if (!path) return;
                path.setAttribute("data-province", prov.id);
                path.classList.add("province-path");
                path.removeAttribute("style");
                path.setAttribute("stroke", "#555544");
                path.setAttribute("stroke-width", "0.8");
                paths.push(path);
            });

            // Compute true area centroid by grid-sampling inside the filled paths
            if (paths.length > 0) {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                paths.forEach(p => {
                    const bb = p.getBBox();
                    minX = Math.min(minX, bb.x);
                    minY = Math.min(minY, bb.y);
                    maxX = Math.max(maxX, bb.x + bb.width);
                    maxY = Math.max(maxY, bb.y + bb.height);
                });

                let sumX = 0, sumY = 0, count = 0;
                const step = 4; // sample every 4 SVG units
                for (let x = minX; x <= maxX; x += step) {
                    for (let y = minY; y <= maxY; y += step) {
                        svgPt.x = x;
                        svgPt.y = y;
                        for (const p of paths) {
                            if (p.isPointInFill(svgPt)) {
                                sumX += x;
                                sumY += y;
                                count++;
                                break;
                            }
                        }
                    }
                }

                if (count > 0) {
                    prov.centroid = { x: sumX / count, y: sumY / count };
                } else {
                    prov.centroid = prov.center;
                }
            } else {
                prov.centroid = prov.center;
            }

            // Manual overrides for provinces where auto-centroid sits poorly
            const overrides = {
                mutsu: { x: 540, y: 300 },
            };
            if (overrides[prov.id]) {
                prov.centroid = overrides[prov.id];
            }
        });
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
            const pos = prov.centroid || prov.center;
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", pos.x);
            text.setAttribute("y", pos.y - 2);
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("font-size", "5");
            text.setAttribute("fill", "#e8d5b0");
            text.setAttribute("pointer-events", "none");
            text.setAttribute("font-family", "'Noto Sans JP', sans-serif");
            text.textContent = prov.japaneseName;

            const text2 = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text2.setAttribute("x", pos.x);
            text2.setAttribute("y", pos.y + 4);
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

            const retreating = BattleSystem.getRetreatingArmiesAtProvince(prov.id);

            if (armies.length === 0 && !hasBattle && retreating.length === 0) return;

            const pos = prov.centroid || prov.center;
            const baseX = pos.x;
            const baseY = pos.y + 8;

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

            // Draw retreating armies with a retreat icon
            if (retreating.length > 0) {
                const retY = baseY + (armies.length > 0 ? 10 : 0) + (hasBattle ? 12 : 0);

                retreating.forEach((r, i) => {
                    const clan = GameState.getClan(r.clanId);
                    if (!clan) return;
                    const offsetX = (i - (retreating.length - 1) / 2) * 14;
                    this._drawArmyChip(baseX + offsetX, retY, clan, r.troops, 0.5);

                    // Retreat arrow icon
                    const icon = document.createElementNS("http://www.w3.org/2000/svg", "text");
                    icon.setAttribute("x", baseX + offsetX);
                    icon.setAttribute("y", retY - 5);
                    icon.setAttribute("text-anchor", "middle");
                    icon.setAttribute("font-size", "5");
                    icon.setAttribute("pointer-events", "none");
                    icon.setAttribute("opacity", "0.7");
                    icon.textContent = "\u{1F6A9}"; // flag = retreating
                    this.armiesLayer.appendChild(icon);
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

            // Hide orders from users who don't have permission to see them
            if (!Auth.canMoveArmies(order.clanId)) return;

            const isPending = order.status === "pending";
            const color = isPending ? "#f0c040" : "#40c060";
            const markerEnd = isPending ? "url(#arrow-pending)" : "url(#arrow-committed)";
            const dashArray = isPending ? "3,2" : "none";

            const fromPt = from.centroid || from.center;
            const toPt = to.centroid || to.center;

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

        // Draw retreat arrows
        (GameState.retreatingArmies || []).forEach(retreat => {
            // Current position
            let currentProvId;
            if (retreat.currentStep === 0) {
                currentProvId = retreat.fromProvince;
            } else {
                const idx = Math.min(retreat.currentStep, retreat.path.length - 1);
                currentProvId = retreat.path[idx];
            }

            const destProvId = retreat.destination;
            if (!currentProvId || !destProvId || currentProvId === destProvId) return;

            const fromProv = PROVINCE_MAP[currentProvId];
            const toProv = PROVINCE_MAP[destProvId];
            if (!fromProv || !toProv) return;

            const fromPt = fromProv.centroid || fromProv.center;
            const toPt = toProv.centroid || toProv.center;
            const clan = GameState.getClan(retreat.clanId);

            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", fromPt.x);
            line.setAttribute("y1", fromPt.y);
            line.setAttribute("x2", toPt.x);
            line.setAttribute("y2", toPt.y);
            line.setAttribute("stroke", "#f0a028");
            line.setAttribute("stroke-width", "1");
            line.setAttribute("stroke-dasharray", "2,2");
            line.setAttribute("marker-end", "url(#arrow-retreat)");
            line.setAttribute("opacity", "0.6");
            line.setAttribute("class", "order-arrow");
            this.arrowsLayer.appendChild(line);
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
        this.sendUnclaimedToBack();
    },

    // Show hover overlay: clone province paths into the hover layer (above all provinces)
    showHoverOverlay(provinceId) {
        this.hoverLayer.innerHTML = "";
        if (!provinceId) return;
        const prov = PROVINCE_MAP[provinceId];
        if (!prov) return;
        prov.pathIds.forEach(pid => {
            const orig = this.svg.getElementById(pid);
            if (!orig) return;
            const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
            use.setAttributeNS("http://www.w3.org/1999/xlink", "href", "#" + pid);
            use.setAttribute("fill", orig.getAttribute("fill"));
            use.setAttribute("fill-opacity", "0.8");
            use.setAttribute("stroke", "#e8d5b0");
            use.setAttribute("stroke-width", "3");
            use.setAttribute("pointer-events", "none");
            this.hoverLayer.appendChild(use);
        });
    },

    clearHoverOverlay() {
        this.hoverLayer.innerHTML = "";
    },

    // Send unclaimed province paths to the back of the SVG (behind claimed ones)
    sendUnclaimedToBack() {
        const firstPath = this.svg.querySelector(".province-path");
        if (!firstPath) return;
        PROVINCES.forEach(prov => {
            const state = GameState.provinces[prov.id];
            if (!state || !state.owner) {
                prov.pathIds.forEach(pid => {
                    const path = this.svg.getElementById(pid);
                    if (path && path.parentNode) {
                        path.parentNode.insertBefore(path, firstPath);
                    }
                });
            }
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
