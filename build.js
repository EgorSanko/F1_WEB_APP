const esbuild = require('esbuild');
const fs = require('fs');

async function build() {
    const start = Date.now();

    const result = await esbuild.build({
        entryPoints: ['src/app.jsx'],
        outfile: 'static/app.min.js',
        bundle: false,
        minify: true,
        sourcemap: true,
        jsx: 'transform',
        jsxFactory: 'React.createElement',
        jsxFragment: 'React.Fragment',
        target: ['es2020'],
        charset: 'utf8',
        legalComments: 'none',
    });

    const jsSize = fs.statSync('static/app.min.js').size;
    const elapsed = Date.now() - start;
    const kb = (jsSize / 1024).toFixed(1);
    console.log('Built static/app.min.js (' + kb + ' KB) in ' + elapsed + 'ms');
    if (result.errors.length) console.error('Errors:', result.errors);
    if (result.warnings.length > 0) console.warn('Warnings:', result.warnings.length);
}

build().catch(function(e) { console.error(e); process.exit(1); });
