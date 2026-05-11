(function() {
    const out = {};
    try {
        out.has_customElements = typeof customElements !== "undefined";
        if (typeof customElements !== "undefined") {
            const klass = customElements.get("tree-card");
            out.has_tree_card_class = !!klass;
            if (klass) {
                out.proto_methods = Object.getOwnPropertyNames(klass.prototype)
                    .filter(n => n !== "constructor");
            }
        }
    } catch (e) { out.ce_err = String(e); }

    // Existing tree-card elements in DOM (might be 0 if tech tree closed)
    try {
        const all = document.querySelectorAll("tree-card");
        out.tree_card_count = all.length;
        if (all[0]) {
            const t = all[0];
            out.first_card = {
                type: t.getAttribute("type"),
                name: t.getAttribute("name"),
                hasInnerName: !!t.querySelector(".tree-card-name"),
                hasUnlocks: !!t.querySelector(".tree-card-unlocks"),
                innerHTML_len: (t.innerHTML || "").length
            };
        }
    } catch (e) { out.dom_err = String(e); }

    // Check Locale availability
    try {
        out.has_Locale = typeof Locale !== "undefined";
        out.has_MustGetElement = typeof MustGetElement !== "undefined";
    } catch (e) {}

    return JSON.stringify(out);
})()
