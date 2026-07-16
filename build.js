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

    // Build 2: Public JS — from src/public/app.jsx (separate entry, desktop design — production)
    await esbuild.build({
        ...jsxOpts,
        entryPoints: ['src/public/app.jsx'],
        outfile: 'static/public.min.js',
    });

    // Build 3: Public v2 JS — from src/public/v2/app.jsx (redesign, in progress)
    await esbuild.build({
        ...jsxOpts,
        entryPoints: ['src/public/v2/app.jsx'],
        outfile: 'static/public-v2.min.js',
    });

    // Build 4: Public CSS — Tailwind (production design only)
    execSync('npx @tailwindcss/cli -i src/public/input.css -o static/public.css --minify', { stdio: 'pipe' });

    // Build 5: Public v2 CSS — plain CSS file, just copy
    fs.copyFileSync('src/public/v2/styles.css', 'static/public-v2.css');

    const waSize = fs.statSync('static/webapp.min.js').size;
    const pubSize = fs.statSync('static/public.min.js').size;
    const v2Size = fs.statSync('static/public-v2.min.js').size;
    const cssSize = fs.statSync('static/public.css').size;
    const v2CssSize = fs.statSync('static/public-v2.css').size;

    // Cache-busting via content hashes
    const crypto = require('crypto');
    const md5 = (p) => crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex').slice(0, 8);
    const jsHash = md5('static/public.min.js');
    const cssHash = md5('static/public.css');
    const waHash = md5('static/webapp.min.js');
    const v2JsHash = md5('static/public-v2.min.js');
    const v2CssHash = md5('static/public-v2.css');

    let html = fs.readFileSync('public.html', 'utf8');
    html = html.replace(/public\.min\.js(\?v=[a-f0-9]*)?/, 'public.min.js?v=' + jsHash);
    html = html.replace(/public\.css(\?v=[a-f0-9]*)?/, 'public.css?v=' + cssHash);
    fs.writeFileSync('public.html', html);

    let waHtml = fs.readFileSync('webapp.html', 'utf8');
    waHtml = waHtml.replace(/webapp\.min\.js(\?v=[a-f0-9]*)?/, 'webapp.min.js?v=' + waHash);
    fs.writeFileSync('webapp.html', waHtml);

    let v2Html = fs.readFileSync('public-v2.html', 'utf8');
    v2Html = v2Html.replace(/public-v2\.min\.js(\?v=[a-f0-9]*)?/, 'public-v2.min.js?v=' + v2JsHash);
    v2Html = v2Html.replace(/public-v2\.css(\?v=[a-f0-9]*)?/, 'public-v2.css?v=' + v2CssHash);
    fs.writeFileSync('public-v2.html', v2Html);

    const elapsed = Date.now() - start;
    console.log(
        'Built: webapp.min.js (' + (waSize/1024).toFixed(1) + ' KB)' +
        ' + public.min.js (' + (pubSize/1024).toFixed(1) + ' KB)' +
        ' + public.css (' + (cssSize/1024).toFixed(1) + ' KB)' +
        ' + public-v2.min.js (' + (v2Size/1024).toFixed(1) + ' KB)' +
        ' + public-v2.css (' + (v2CssSize/1024).toFixed(1) + ' KB)' +
        ' [v=' + jsHash + ', v2=' + v2JsHash + ']' +
        ' in ' + elapsed + 'ms'
    );
}

build().catch(function(e) { console.error(e); process.exit(1); });
