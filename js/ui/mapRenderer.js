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
            prov.pathIds.forEach(pid => {
                const path = this.svg.getElementById(pid);
                if (!path) return;
                path.setAttribute("data-province", prov.id);
                path.classList.add("province-path");
                path.removeAttribute("style");
                path.setAttribute("stroke", "#555544");
                path.setAttribute("stroke-width", "0.8");
            });
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
            if (armies.length === 0) return;

            const baseX = prov.center.x;
            const baseY = prov.center.y + 8;

            armies.forEach(([clanId, count], i) => {
                const clan = GameState.getClan(clanId);
                if (!clan) return;

                const offsetX = (i - (armies.length - 1) / 2) * 12;

                const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                rect.setAttribute("x", baseX + offsetX - 6);
                rect.setAttribute("y", baseY - 4);
                rect.setAttribute("width", "12");
                rect.setAttribute("height", "8");
                rect.setAttribute("rx", "1.5");
                rect.setAttribute("fill", clan.color);
                rect.setAttribute("stroke", "#000");
                rect.setAttribute("stroke-width", "0.3");
                rect.setAttribute("opacity", "0.9");

                const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                text.setAttribute("x", baseX + offsetX);
                text.setAttribute("y", baseY + 2);
                text.setAttribute("text-anchor", "middle");
                text.setAttribute("font-size", "4.5");
                text.setAttribute("font-weight", "bold");
                text.setAttribute("fill", "#fff");
                text.setAttribute("pointer-events", "none");
                text.setAttribute("font-family", "sans-serif");
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

            if (GameState.selectedClan && order.clanId !== GameState.selectedClan) return;

            const isPending = order.status === "pending";
            const color = isPending ? "#f0c040" : "#40c060";
            const markerEnd = isPending ? "url(#arrow-pending)" : "url(#arrow-committed)";
            const dashArray = isPending ? "3,2" : "none";

            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", from.center.x);
            line.setAttribute("y1", from.center.y);
            line.setAttribute("x2", to.center.x);
            line.setAttribute("y2", to.center.y);
            line.setAttribute("stroke", color);
            line.setAttribute("stroke-width", "1.5");
            line.setAttribute("stroke-dasharray", dashArray);
            line.setAttribute("marker-end", markerEnd);
            line.setAttribute("opacity", "0.8");
            line.setAttribute("class", "order-arrow");

            const midX = (from.center.x + to.center.x) / 2;
            const midY = (from.center.y + to.center.y) / 2;

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
        prov.neighbors.forEach(nId => {
            const np = PROVINCE_MAP[nId];
            if (!np) return;
            np.pathIds.forEach(pid => {
                const path = this.svg.getElementById(pid);
                if (path) path.classList.add("move-target");
            });
        });
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
