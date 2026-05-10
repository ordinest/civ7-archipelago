const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
try {
    new Function(src);
    console.log('parse OK');
} catch (e) {
    console.log('parse FAIL: ' + e.message);
    process.exit(1);
}
