(function () {
    // Probe: how does the tree-card mastery tier render text?
    // Hypothesis A: it has its own LOC key per mastery (overridable).
    // Hypothesis B: it shows the base node's name with a tier suffix (composed at render time).
    // Hypothesis C: it shows the unlocks list from `unlocksByDepth` and the player is seeing those unlock names.
    const out = {};

    try {
        const cards = document.querySelectorAll("tree-card");
        out.tree_cards_in_dom = cards.length;
        if (cards.length === 0) {
            out.note = "No tree-cards in DOM. Open the tech tree first.";
            return JSON.stringify(out);
        }

        // Pick first tree-card and dump its structure
        const card = cards[0];
        out.first_card = {
            type: card.getAttribute("type"),
            name_attr: card.getAttribute("name"),
            unlocks_attr: card.getAttribute("unlocks-by-depth"),
        };

        // Walk the rendered DOM under the card. Look for tier elements and their text.
        const tierContainers = card.querySelectorAll("[level]");
        out.tier_count = tierContainers.length;
        out.tiers = [];
        for (const t of tierContainers) {
            const nameEl = t.querySelector(".tree-card-name");
            const unlocksEl = t.querySelector(".tree-card-unlocks");
            out.tiers.push({
                level_attr: t.getAttribute("level"),
                id_attr: t.id,
                name_text: nameEl ? nameEl.textContent : null,
                name_innerHTML: nameEl ? nameEl.innerHTML.slice(0, 200) : null,
                unlocks_text: unlocksEl ? unlocksEl.textContent.slice(0, 200) : null,
                unlocks_children_count: unlocksEl ? unlocksEl.children.length : 0,
            });
        }
    } catch (e) {
        out.err = String(e);
    }
    return JSON.stringify(out);
})()
