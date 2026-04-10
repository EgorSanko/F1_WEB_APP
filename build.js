const esbuild = require('esbuild');
const { execSync } = require('child_process');
const fs = require('fs');

async function build() {
    const start = Date.now();

    const jsxOpts = {
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

    // Build 1: WebApp JS (Telegram Mini App) — from src/app.jsx
    await esbuild.build({
        ...jsxOpts,
        entryPoints: ['src/app.jsx'],
        outfile: 'static/webapp.min.js',
        define: { '__IS_WEBAPP__': 'true' },
    });

    // Build 2: Public JS — from src/public/app.jsx (separate entry, desktop design)
    await esbuild.build({
        ...jsxOpts,
        entryPoints: ['src/public/app.jsx'],
        outfile: 'static/public.min.js',
    });

    // Build 3: Public CSS — Tailwind
    execSync('npx @tailwindcss/cli -i src/public/input.css -o static/public.css --minify', { stdio: 'pipe' });

    const waSize = fs.statSync('static/webapp.min.js').size;
    const pubSize = fs.statSync('static/public.min.js').size;
    const cssSize = fs.statSync('static/public.css').size;

    // Cache-busting: update public.html with content hashes
    const crypto = require('crypto');
    const jsHash = crypto.createHash('md5').update(fs.readFileSync('static/public.min.js')).digest('hex').slice(0, 8);
    const cssHash = crypto.createHash('md5').update(fs.readFileSync('static/public.css')).digest('hex').slice(0, 8);
    let html = fs.readFileSync('public.html', 'utf8');
    html = html.replace(/public\.min\.js(\?v=[a-f0-9]*)?/, 'public.min.js?v=' + jsHash);
    html = html.replace(/public\.css(\?v=[a-f0-9]*)?/, 'public.css?v=' + cssHash);
    fs.writeFileSync('public.html', html);

    const elapsed = Date.now() - start;
    console.log(
        'Built: webapp.min.js (' + (waSize/1024).toFixed(1) + ' KB)' +
        ' + public.min.js (' + (pubSize/1024).toFixed(1) + ' KB)' +
        ' + public.css (' + (cssSize/1024).toFixed(1) + ' KB)' +
        ' [v=' + jsHash + ']' +
        ' in ' + elapsed + 'ms'
    );
}

build().catch(function(e) { console.error(e); process.exit(1); });
