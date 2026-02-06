// Map Renderer - Draws SVG provinces, armies, arrows, labels
const MapRenderer = {
    svg: null,
    provincesLayer: null,
    armiesLayer: null,
    arrowsLayer: null,
    labelsLayer: null,

    init() {
        this.svg = document.getElementById("game-map");
        this.provincesLayer = document.getElementById("provinces-layer");
        this.armiesLayer = document.getElementById("armies-layer");
        this.arrowsLayer = document.getElementById("arrows-layer");
        this.labelsLayer = document.getElementById("labels-layer");

        this.drawProvinces();
        this.drawLabels();
    },

    drawProvinces() {
        this.provincesLayer.innerHTML = "";

        PROVINCES.forEach(prov => {
            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            g.setAttribute("class", "province-group");
            g.setAttribute("data-id", prov.id);

            // Province shape
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", prov.path);
            path.setAttribute("class", "province-path");
            path.setAttribute("data-id", prov.id);
            path.setAttribute("data-terrain", prov.terrain);

            // Color based on owner
            const state = GameState.provinces[prov.id];
            if (state && state.owner) {
                const clan = GameState.getClan(state.owner);
                if (clan) {
                    path.setAttribute("fill", clan.color);
                    path.setAttribute("fill-opacity", "0.6");
                }
            } else {
                path.setAttribute("fill", "#3a3a2a");
                path.setAttribute("fill-opacity", "0.5");
            }

            path.setAttribute("stroke", "#8b7355");
            path.setAttribute("stroke-width", "1.5");

            g.appendChild(path);
            this.provincesLayer.appendChild(g);
        });
    },

    drawLabels() {
        this.labelsLayer.innerHTML = "";

        PROVINCES.forEach(prov => {
            // Province name label
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", prov.center.x);
            text.setAttribute("y", prov.center.y - 5);
            text.setAttribute("class", "province-label");
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("font-size", "7");
            text.setAttribute("fill", "#e8d5b0");
            text.setAttribute("pointer-events", "none");
            text.textContent = prov.japaneseName;

            // English name below
            const text2 = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text2.setAttribute("x", prov.center.x);
            text2.setAttribute("y", prov.center.y + 4);
            text2.setAttribute("class", "province-label-en");
            text2.setAttribute("text-anchor", "middle");
            text2.setAttribute("font-size", "5");
            text2.setAttribute("fill", "#c4b08a");
            text2.setAttribute("pointer-events", "none");
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
            if (armies.length === 0) return;

            const baseX = prov.center.x;
            const baseY = prov.center.y + 12;

            armies.forEach(([clanId, count], i) => {
                const clan = GameState.getClan(clanId);
                if (!clan) return;

                const offsetX = (i - (armies.length - 1) / 2) * 16;

                // Army icon background
                const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                rect.setAttribute("x", baseX + offsetX - 8);
                rect.setAttribute("y", baseY - 6);
                rect.setAttribute("width", "16");
                rect.setAttribute("height", "12");
                rect.setAttribute("rx", "2");
                rect.setAttribute("fill", clan.color);
                rect.setAttribute("stroke", "#000");
                rect.setAttribute("stroke-width", "0.5");
                rect.setAttribute("opacity", "0.9");

                // Troop count
                const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                text.setAttribute("x", baseX + offsetX);
                text.setAttribute("y", baseY + 3);
                text.setAttribute("text-anchor", "middle");
                text.setAttribute("font-size", "6");
                text.setAttribute("font-weight", "bold");
                text.setAttribute("fill", "#fff");
                text.setAttribute("pointer-events", "none");
                text.textContent = this.formatTroops(count);

                this.armiesLayer.appendChild(rect);
                this.armiesLayer.appendChild(text);
            });
        });
    },

    drawArrows() {
        this.arrowsLayer.innerHTML = "";

        GameState.orders.forEach(order => {
            const from = PROVINCE_MAP[order.fromProvince];
            const to = PROVINCE_MAP[order.toProvince];
            if (!from || !to) return;

            const clan = GameState.getClan(order.clanId);
            if (!clan) return;

            // Only show arrows for currently selected clan or all if admin
            if (GameState.selectedClan && order.clanId !== GameState.selectedClan) return;

            const isPending = order.status === "pending";
            const color = isPending ? "#f0c040" : "#40c060";
            const markerEnd = isPending ? "url(#arrow-pending)" : "url(#arrow-committed)";
            const dashArray = isPending ? "4,3" : "none";

            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", from.center.x);
            line.setAttribute("y1", from.center.y);
            line.setAttribute("x2", to.center.x);
            line.setAttribute("y2", to.center.y);
            line.setAttribute("stroke", color);
            line.setAttribute("stroke-width", "2");
            line.setAttribute("stroke-dasharray", dashArray);
            line.setAttribute("marker-end", markerEnd);
            line.setAttribute("opacity", "0.8");
            line.setAttribute("class", "order-arrow");

            // Troop count on the arrow
            const midX = (from.center.x + to.center.x) / 2;
            const midY = (from.center.y + to.center.y) / 2;

            const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
            label.setAttribute("x", midX);
            label.setAttribute("y", midY - 4);
            label.setAttribute("text-anchor", "middle");
            label.setAttribute("font-size", "6");
            label.setAttribute("font-weight", "bold");
            label.setAttribute("fill", color);
            label.setAttribute("pointer-events", "none");
            label.textContent = order.troops;

            this.arrowsLayer.appendChild(line);
            this.arrowsLayer.appendChild(label);
        });
    },

    // Update the entire map
    update() {
        this.updateProvinceColors();
        this.drawArmies();
        this.drawArrows();
    },

    updateProvinceColors() {
        PROVINCES.forEach(prov => {
            const path = this.provincesLayer.querySelector(`[data-id="${prov.id}"]`);
            if (!path) return;

            const state = GameState.provinces[prov.id];
            if (state && state.owner) {
                const clan = GameState.getClan(state.owner);
                if (clan) {
                    path.setAttribute("fill", clan.color);
                    path.setAttribute("fill-opacity", "0.6");
                    return;
                }
            }
            path.setAttribute("fill", "#3a3a2a");
            path.setAttribute("fill-opacity", "0.5");
        });
    },

    // Highlight a province
    highlightProvince(provinceId, highlight) {
        const path = this.provincesLayer.querySelector(`[data-id="${provinceId}"]`);
        if (!path) return;
        if (highlight) {
            path.classList.add("highlighted");
        } else {
            path.classList.remove("highlighted");
        }
    },

    // Highlight move targets
    highlightTargets(provinceId) {
        const prov = PROVINCE_MAP[provinceId];
        if (!prov) return;
        prov.neighbors.forEach(nId => {
            const path = this.provincesLayer.querySelector(`[data-id="${nId}"]`);
            if (path) path.classList.add("move-target");
        });
    },

    clearTargetHighlights() {
        this.provincesLayer.querySelectorAll(".move-target").forEach(el => {
            el.classList.remove("move-target");
        });
    },

    formatTroops(n) {
        if (n >= 1000) return (n / 1000).toFixed(1) + "k";
        return n.toString();
    }
};
