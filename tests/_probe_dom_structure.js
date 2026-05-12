(function() {
    const out = {};
    try {
        out.body_classes = document.body.className;
        out.body_child_count = document.body.children.length;
        // Look at top-level children
        out.top_children = [];
        for (let i = 0; i < Math.min(document.body.children.length, 20); i++) {
            const c = document.body.children[i];
            out.top_children.push({
                tag: c.tagName.toLowerCase(),
                id: c.id,
                cls: c.className ? c.className.slice(0, 120) : "",
            });
        }
        // Find anything tree-y
        const treeRelated = document.querySelectorAll(
            "tree-card, tree-grid, tree-line, tree-detail, [class*='tree-']"
        );
        out.tree_related_count = treeRelated.length;
        out.tree_related_samples = [];
        for (let i = 0; i < Math.min(treeRelated.length, 5); i++) {
            const el = treeRelated[i];
            out.tree_related_samples.push({
                tag: el.tagName.toLowerCase(),
                id: el.id,
                cls: el.className ? el.className.slice(0, 120) : "",
            });
        }
        // Find any panel that looks active
        const panels = document.querySelectorAll("[class*='panel-'], [class*='screen-']");
        out.panel_count = panels.length;
    } catch (e) {
        out.err = String(e);
    }
    return JSON.stringify(out);
})()
