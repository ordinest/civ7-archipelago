(function () {
    const out = {};
    // Find a tree-card-v2 that's NOT the first (avoid Agriculture which has no mastery).
    // Pick one we know has mastery. NODE_TECH_AQ_POTTERY = hash ???
    // Just grab the first 3 tree-card-v2 elements and dump their HTML structure (truncated).
    const cards = document.querySelectorAll("tree-card-v2");
    out.tree_card_v2_count = cards.length;

    // Count hitboxes inside cards by class
    let parentHitboxes = 0;
    let childHitboxes = 0;
    const cards_with_mastery = [];
    for (let i = 0; i < cards.length; i++) {
        const c = cards[i];
        const parent = c.querySelectorAll("fxs-activatable.parent-node");
        const all = c.querySelectorAll("fxs-activatable");
        parentHitboxes += parent.length;
        childHitboxes += (all.length - parent.length);
        if (all.length > 1) {
            cards_with_mastery.push({
                type: c.getAttribute("type"),
                hitbox_count: all.length,
                parent_count: parent.length,
            });
        }
    }
    out.total_parent_hitboxes = parentHitboxes;
    out.total_child_hitboxes = childHitboxes;
    out.cards_with_multiple_hitboxes = cards_with_mastery.slice(0, 5);

    // For the first card with multiple hitboxes (i.e., a card with mastery), dump children
    if (cards_with_mastery.length > 0) {
        const target = document.querySelector(
            `tree-card-v2[type="${cards_with_mastery[0].type}"]`
        );
        if (target) {
            const allActivatables = target.querySelectorAll("fxs-activatable");
            out.mastery_card_structure = [];
            for (let i = 0; i < allActivatables.length; i++) {
                const a = allActivatables[i];
                const nameEl = a.querySelector(".tree-card-name");
                out.mastery_card_structure.push({
                    idx: i,
                    id: a.id,
                    cls: a.className.slice(0, 200),
                    level_attr: a.getAttribute("level"),
                    type_attr: a.getAttribute("type"),
                    name_text: nameEl ? nameEl.textContent.slice(0, 100) : null,
                });
            }
        }
    }

    return JSON.stringify(out);
})()
