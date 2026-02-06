// Map Interaction - Zoom, pan, province clicks, move mode
const MapInteraction = {
    container: null,
    svg: null,
    viewBox: { x: 0, y: 0, w: 732, h: 777 },
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    dragMoved: false,
    selectedProvince: null,
    moveMode: false,
    moveFrom: null,
    zoomLevel: 1,
    minZoom: 0.5,
    maxZoom: 4,

    init() {
        this.container = document.getElementById("map-container");
        this.svg = document.getElementById("game-map");

        // Mouse wheel zoom
        this.container.addEventListener("wheel", (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 1.1 : 0.9;
            this.zoom(delta, e.clientX, e.clientY);
        });

        // Pan with left-click drag
        this.container.addEventListener("mousedown", (e) => {
            if (e.button === 0 || e.button === 1) {
                this.isDragging = true;
                this.dragMoved = false;
                this.dragStart = { x: e.clientX, y: e.clientY };
                this.container.style.cursor = "grabbing";
                e.preventDefault();
            }
        });

        this.container.addEventListener("mousemove", (e) => {
            if (!this.isDragging) return;
            const dx = (e.clientX - this.dragStart.x) * (this.viewBox.w / this.container.clientWidth);
            const dy = (e.clientY - this.dragStart.y) * (this.viewBox.h / this.container.clientHeight);
            if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
                this.dragMoved = true;
            }
            this.viewBox.x -= dx;
            this.viewBox.y -= dy;
            this.dragStart = { x: e.clientX, y: e.clientY };
            this.updateViewBox();
        });

        this.container.addEventListener("mouseup", () => {
            this.isDragging = false;
            this.container.style.cursor = "default";
        });

        this.container.addEventListener("mouseleave", () => {
            this.isDragging = false;
            this.container.style.cursor = "default";
        });

        // Province click - use data-province attribute
        this.svg.addEventListener("click", (e) => {
            if (this.dragMoved) return;
            const target = e.target.closest(".province-path");
            if (target) {
                const provId = target.getAttribute("data-province");
                if (provId) this.selectProvince(provId);
            } else if (this.moveMode) {
                this.cancelMoveMode();
            }
        });

        // Province hover - bring to front so border renders above neighbors
        this.svg.addEventListener("mouseover", (e) => {
            const target = e.target.closest(".province-path");
            if (target) {
                const provId = target.getAttribute("data-province");
                if (provId) MapRenderer.bringToFront(provId);
                // Keep selected province on top of hovered ones
                if (this.selectedProvince && this.selectedProvince !== provId) {
                    MapRenderer.bringToFront(this.selectedProvince);
                }
                target.classList.add("hovered");
            }
        });

        this.svg.addEventListener("mouseout", (e) => {
            const target = e.target.closest(".province-path");
            if (target) {
                target.classList.remove("hovered");
            }
        });

        // Touch support for mobile
        let touchStartDist = 0;
        let lastTouch = null;

        this.container.addEventListener("touchstart", (e) => {
            if (e.touches.length === 2) {
                touchStartDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
            } else if (e.touches.length === 1) {
                lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
        }, { passive: true });

        this.container.addEventListener("touchmove", (e) => {
            if (e.touches.length === 2) {
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const delta = touchStartDist / dist;
                const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                this.zoom(delta, cx, cy);
                touchStartDist = dist;
            } else if (e.touches.length === 1 && lastTouch) {
                const dx = (e.touches[0].clientX - lastTouch.x) * (this.viewBox.w / this.container.clientWidth);
                const dy = (e.touches[0].clientY - lastTouch.y) * (this.viewBox.h / this.container.clientHeight);
                this.viewBox.x -= dx;
                this.viewBox.y -= dy;
                lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                this.updateViewBox();
            }
        }, { passive: true });
    },

    zoom(factor, cx, cy) {
        const rect = this.container.getBoundingClientRect();
        const mouseX = ((cx - rect.left) / rect.width) * this.viewBox.w + this.viewBox.x;
        const mouseY = ((cy - rect.top) / rect.height) * this.viewBox.h + this.viewBox.y;

        const newW = this.viewBox.w * factor;
        const newH = this.viewBox.h * factor;

        // Clamp zoom
        if (newW < 732 / this.maxZoom || newW > 732 / this.minZoom) return;

        this.viewBox.x = mouseX - (mouseX - this.viewBox.x) * (newW / this.viewBox.w);
        this.viewBox.y = mouseY - (mouseY - this.viewBox.y) * (newH / this.viewBox.h);
        this.viewBox.w = newW;
        this.viewBox.h = newH;

        this.updateViewBox();
    },

    updateViewBox() {
        this.svg.setAttribute("viewBox",
            `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.w} ${this.viewBox.h}`);
    },

    selectProvince(provinceId) {
        // If in move mode, handle as target selection
        if (this.moveMode && this.moveFrom) {
            const from = PROVINCE_MAP[this.moveFrom];
            if (from.neighbors.includes(provinceId)) {
                this.handleMoveTarget(provinceId);
                return;
            }
        }

        // Deselect previous
        if (this.selectedProvince) {
            MapRenderer.highlightProvince(this.selectedProvince, false);
        }

        this.selectedProvince = provinceId;
        MapRenderer.highlightProvince(provinceId, true);
        Panels.showProvincePanel(provinceId);
    },

    enterMoveMode(fromProvinceId) {
        this.moveMode = true;
        this.moveFrom = fromProvinceId;
        MapRenderer.highlightTargets(fromProvinceId);
        Notifications.show("Select a neighboring province to move to", "info");
    },

    handleMoveTarget(toProvinceId) {
        const clanId = GameState.selectedClan;
        if (!clanId) return;

        const available = ArmySystem.getArmyInProvince(clanId, this.moveFrom);
        const committed = MoveSystem.getOrdersFrom(clanId, this.moveFrom)
            .reduce((sum, o) => sum + o.troops, 0);
        const canMove = available - committed;

        if (canMove <= 0) {
            Notifications.show("No available troops to move", "error");
            this.cancelMoveMode();
            return;
        }

        // Show move modal with slider
        const modal = document.getElementById("move-modal");
        const slider = document.getElementById("move-slider");
        const countDisplay = document.getElementById("move-count-display");
        const fromInfo = document.getElementById("move-from-info");

        const from = PROVINCE_MAP[this.moveFrom];
        const to = PROVINCE_MAP[toProvinceId];

        fromInfo.innerHTML = `<strong>${from.name}</strong> → <strong>${to.name}</strong>`;
        slider.max = canMove;
        slider.value = canMove;
        countDisplay.textContent = canMove;

        slider.oninput = () => {
            countDisplay.textContent = slider.value;
        };

        modal.classList.remove("hidden");

        // Set up targets display
        const targetsDiv = document.getElementById("move-targets");
        targetsDiv.innerHTML = `
            <button class="modal-btn confirm" id="move-confirm">
                Move ${canMove} troops to ${to.name}
            </button>
        `;

        document.getElementById("move-confirm").onclick = () => {
            const troops = parseInt(slider.value);
            const result = MoveSystem.createOrder(clanId, this.moveFrom, toProvinceId, troops);
            if (result.success) {
                Notifications.show(`Order created: ${troops} troops → ${to.name}`, "success");
                MapRenderer.update();
                if (this.selectedProvince) Panels.showProvincePanel(this.selectedProvince);
            } else {
                Notifications.show(result.error, "error");
            }
            modal.classList.add("hidden");
            this.cancelMoveMode();
        };

        slider.oninput = () => {
            countDisplay.textContent = slider.value;
            document.getElementById("move-confirm").textContent =
                `Move ${slider.value} troops to ${to.name}`;
        };

        document.getElementById("move-cancel").onclick = () => {
            modal.classList.add("hidden");
            this.cancelMoveMode();
        };
    },

    cancelMoveMode() {
        this.moveMode = false;
        this.moveFrom = null;
        MapRenderer.clearTargetHighlights();
    },

    // Center map on a province
    centerOn(provinceId) {
        const prov = PROVINCE_MAP[provinceId];
        if (!prov) return;
        const viewW = 300;
        const viewH = 320;
        this.viewBox.x = prov.center.x - viewW / 2;
        this.viewBox.y = prov.center.y - viewH / 2;
        this.viewBox.w = viewW;
        this.viewBox.h = viewH;
        this.updateViewBox();
    }
};
