const esbuild = require('esbuild');
const fs = require('fs');

async function build() {
    const start = Date.now();

    const commonOpts = {
        entryPoints: ['src/app.jsx'],
        bundle: false,
        minify: true,
        sourcemap: true,
        jsx: 'transform',
        jsxFactory: 'React.createElement',
        jsxFragment: 'React.Fragment',
        target: ['es2020'],
        charset: 'utf8',
        legalComments: 'none',
    };

    // Build 1: WebApp (Telegram Mini App)
    await esbuild.build({
        ...commonOpts,
        outfile: 'static/webapp.min.js',
        define: { '__IS_WEBAPP__': 'true' },
    });

    // Build 2: Public site
    await esbuild.build({
        ...commonOpts,
        outfile: 'static/public.min.js',
        define: { '__IS_WEBAPP__': 'false' },
    });

    const waSize = fs.statSync('static/webapp.min.js').size;
    const pubSize = fs.statSync('static/public.min.js').size;
    const elapsed = Date.now() - start;
    console.log('Built webapp.min.js (' + (waSize / 1024).toFixed(1) + ' KB) + public.min.js (' + (pubSize / 1024).toFixed(1) + ' KB) in ' + elapsed + 'ms');
}

build().catch(function(e) { console.error(e); process.exit(1); });
