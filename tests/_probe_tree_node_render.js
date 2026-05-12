(function () {
    const out = {};

    // Find tree-card-name nodes (those are inside the actual rendered tree-cards)
    const names = document.querySelectorAll(".tree-card-name");
    out.tree_card_name_count = names.length;

    if (names.length === 0) {
        // Try other selectors
        out.alt_search = {
            "tree-card": document.querySelectorAll("tree-card").length,
            ".tree-card-hitbox": document.querySelectorAll(".tree-card-hitbox").length,
            ".tree-node-icon": document.querySelectorAll(".tree-node-icon").length,
            "[id^='tree-card-type']": document.querySelectorAll("[id^='tree-card-type']").length,
            "[type^='NODE_TECH']": document.querySelectorAll("[type^='NODE_TECH']").length,
            "[type^='NODE_CIVIC']": document.querySelectorAll("[type^='NODE_CIVIC']").length,
        };
        return JSON.stringify(out);
    }

    // For each tree-card-name found, walk up to find the tier element and pull its text
    out.samples = [];
    for (let i = 0; i < Math.min(names.length, 6); i++) {
        const n = names[i];
        // Walk up to find the hitbox (carries `type` and `level` attrs)
        let cur = n;
        let hitbox = null;
        while (cur && cur !== document.body) {
            if (cur.classList && cur.classList.contains("tree-card-hitbox")) {
                hitbox = cur;
                break;
            }
            cur = cur.parentNode;
        }
        const unlocksEl = hitbox ? hitbox.querySelector(".tree-card-unlocks") : null;
        out.samples.push({
            level: hitbox ? hitbox.getAttribute("level") : null,
            type: hitbox ? hitbox.getAttribute("type") : null,
            name_text: n.textContent.slice(0, 120),
            name_innerHTML: n.innerHTML.slice(0, 200),
            unlocks_text: unlocksEl ? unlocksEl.textContent.slice(0, 200) : null,
        });
    }

    return JSON.stringify(out);
})()
