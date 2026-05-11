(function() {
    // Uninstall any previous decorator so we can iterate.
    if (Game._AP_TREE_OBSERVER) {
        try { Game._AP_TREE_OBSERVER.disconnect(); } catch (e) {}
    }
    Game._AP_TREE_DECORATOR_INSTALLED = true;

    function findCardType(el) {
        // Walk up the DOM until we find an ancestor with a `type` attribute
        // matching our location keys (tree-card or its hitbox).
        let cur = el;
        while (cur) {
            if (cur.getAttribute) {
                const t = cur.getAttribute("type");
                if (t) return t;
            }
            cur = cur.parentNode;
        }
        return null;
    }

    function decorateNameText(nameEl) {
        try {
            const type = findCardType(nameEl);
            if (!type) return;
            const info = (Game._AP_LOCATION_INFO || {})[type];
            if (!info) return;
            // Replace the displayed name with the AP item.
            const apText = info.item + "  ·  " + info.player;
            if (nameEl.innerHTML === apText) return;  // already done
            nameEl.innerHTML = apText;
            const color = ({
                "progression": "#d9a4ff",
                "useful": "#9ad6ff",
                "filler": "#cccccc",
                "trap": "#ff8a8a"
            })[info.classification] || "#ffffff";
            nameEl.style.color = color;
            nameEl.setAttribute("data-ap-decorated", "1");
        } catch (e) {
            console.log("[AP] decorateNameText error: " + e);
        }
    }

    function decorateUnlocks(unlocksEl) {
        try {
            const type = findCardType(unlocksEl);
            if (!type) return;
            const info = (Game._AP_LOCATION_INFO || {})[type];
            if (!info) return;
            if (unlocksEl.getAttribute("data-ap-decorated") === "1") return;
            unlocksEl.innerHTML = "";
            const label = document.createElement("div");
            label.style.cssText = "font-size: 11px; color: #ffd76b; padding: 0 4px;";
            label.textContent = "→ " + info.item;
            unlocksEl.appendChild(label);
            unlocksEl.setAttribute("data-ap-decorated", "1");
        } catch (e) {
            console.log("[AP] decorateUnlocks error: " + e);
        }
    }

    function scanAll() {
        try {
            const names = document.querySelectorAll(".tree-card-name");
            for (let i = 0; i < names.length; i++) decorateNameText(names[i]);
            const unlocks = document.querySelectorAll(".tree-card-unlocks");
            for (let i = 0; i < unlocks.length; i++) decorateUnlocks(unlocks[i]);
            return { names: names.length, unlocks: unlocks.length };
        } catch (e) {
            return { err: String(e) };
        }
    }

    const initial = scanAll();

    const observer = new MutationObserver(function(mutations) {
        for (const mut of mutations) {
            for (const node of mut.addedNodes) {
                if (node.nodeType !== 1) continue;
                if (node.classList && node.classList.contains("tree-card-name")) {
                    decorateNameText(node);
                } else if (node.classList && node.classList.contains("tree-card-unlocks")) {
                    decorateUnlocks(node);
                } else if (node.querySelectorAll) {
                    const innerNames = node.querySelectorAll(".tree-card-name");
                    for (let i = 0; i < innerNames.length; i++) decorateNameText(innerNames[i]);
                    const innerUnlocks = node.querySelectorAll(".tree-card-unlocks");
                    for (let i = 0; i < innerUnlocks.length; i++) decorateUnlocks(innerUnlocks[i]);
                }
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    Game._AP_TREE_OBSERVER = observer;

    return JSON.stringify({
        installed: true,
        initial: initial,
        location_info_entries: Object.keys(Game._AP_LOCATION_INFO || {}).length
    });
})()
