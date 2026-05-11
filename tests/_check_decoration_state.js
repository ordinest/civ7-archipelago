(function() {
    const out = {};
    try {
        const names = document.querySelectorAll(".tree-card-name");
        out.total = names.length;
        out.decorated_count = 0;
        out.sample_innerHTML = [];
        for (let i = 0; i < names.length; i++) {
            const n = names[i];
            if (n.getAttribute("data-ap-decorated") === "1") out.decorated_count += 1;
            if (i < 3) out.sample_innerHTML.push(n.innerHTML);
        }
        // Try to find what context this document is in
        out.document_title = document.title;
        out.document_URL = document.URL || document.location?.href || "n/a";
        out.body_class = document.body ? document.body.className : "n/a";
    } catch (e) { out.err = String(e); }
    return JSON.stringify(out);
})()
