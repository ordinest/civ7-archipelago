(function () {
    const out = {};

    // Use a known node: NODE_TECH_AQ_AGRICULTURE (free root, has mastery? no — but try a non-root)
    // Find any tree-card-name and dump its ancestor chain up 6 levels.
    const names = document.querySelectorAll(".tree-card-name");
    out.total_names = names.length;
    if (names.length === 0) return JSON.stringify(out);

    // For first 3 names, dump ancestor chain
    out.ancestor_walks = [];
    for (let i = 0; i < Math.min(names.length, 3); i++) {
        const chain = [];
        let cur = names[i];
        for (let d = 0; d < 8 && cur && cur !== document.body; d++) {
            chain.push({
                depth: d,
                tag: cur.tagName ? cur.tagName.toLowerCase() : "?",
                id: cur.id || "",
                cls: cur.className ? cur.className.slice(0, 100) : "",
                level: cur.getAttribute ? cur.getAttribute("level") : null,
                type: cur.getAttribute ? cur.getAttribute("type") : null,
            });
            cur = cur.parentNode;
        }
        out.ancestor_walks.push(chain);
    }

    // Count hitboxes vs names
    out.hitbox_count = document.querySelectorAll(".tree-card-hitbox").length;
    out.fxs_activatable_count = document.querySelectorAll("fxs-activatable").length;
    out.elements_with_level = document.querySelectorAll("[level]").length;
    out.elements_with_type_attr_tech = document.querySelectorAll('[type^="NODE_"]').length;
    out.elements_with_id_tree_card_type = document.querySelectorAll('[id^="tree-card-type"]').length;

    // Look for "_dNNN" placeholder text in any .tree-card-name
    out.weird_names = [];
    for (let i = 0; i < names.length; i++) {
        const txt = names[i].textContent;
        if (/^_d\d+$/.test(txt)) {
            out.weird_names.push({ idx: i, text: txt });
        }
    }

    return JSON.stringify(out);
})()
