(function() {
    if (Game._AP_TREE_DECORATOR_INSTALLED) {
        return JSON.stringify({already_installed: true});
    }
    Game._AP_TREE_DECORATOR_INSTALLED = true;

    function decorateCard(card) {
        try {
            if (!card.getAttribute) return;
            const type = card.getAttribute("type");
            if (!type) return;
            if (card.querySelector(".ap-badge")) return;
            const info = (Game._AP_LOCATION_INFO || {})[type];
            if (!info) return;
            const badge = document.createElement("div");
            badge.className = "ap-badge";
            badge.style.cssText =
                "position: absolute; bottom: 4px; left: 4px; right: 4px;" +
                " background: rgba(0,128,255,0.85); color: white;" +
                " font-size: 11px; padding: 2px 4px; pointer-events: none;" +
                " z-index: 100; text-align: center;" +
                " border-radius: 2px;";
            const classColor = {
                "progression": "rgba(160,80,200,0.9)",
                "useful": "rgba(0,140,220,0.85)",
                "filler": "rgba(80,80,80,0.7)",
                "trap": "rgba(180,40,40,0.85)"
            }[info.classification] || "rgba(0,128,255,0.85)";
            badge.style.background = classColor;
            badge.textContent = "AP: " + info.item;
            if (card.style) card.style.position = card.style.position || "relative";
            card.appendChild(badge);
        } catch (e) {
            console.log("[AP] decorateCard error: " + e);
        }
    }

    function scanAll() {
        try {
            const cards = document.querySelectorAll("tree-card");
            for (let i = 0; i < cards.length; i++) decorateCard(cards[i]);
            return cards.length;
        } catch (e) {
            return -1;
        }
    }

    const initialCount = scanAll();

    const observer = new MutationObserver(function(mutations) {
        for (const mut of mutations) {
            for (const node of mut.addedNodes) {
                if (node.nodeType !== 1) continue;
                if (node.tagName && node.tagName.toLowerCase() === "tree-card") {
                    decorateCard(node);
                } else if (node.querySelectorAll) {
                    const subs = node.querySelectorAll("tree-card");
                    for (let j = 0; j < subs.length; j++) decorateCard(subs[j]);
                }
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    Game._AP_TREE_OBSERVER = observer;

    return JSON.stringify({
        installed: true,
        initial_cards_scanned: initialCount,
        location_info_entries: Object.keys(Game._AP_LOCATION_INFO || {}).length
    });
})()
