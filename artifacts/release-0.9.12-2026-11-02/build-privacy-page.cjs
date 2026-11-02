const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
    const { marked } = await import(pathToFileURL('C:/Users/Usser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/marked/lib/marked.esm.js').href);
    const root = path.resolve(__dirname, '../..');
    const markdown = fs.readFileSync(path.join(root, 'docs/store/privacy-policy.md'), 'utf8');
    const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Политика конфиденциальности расширения Funcy: обработка данных, локальное хранение, внешние сервисы и удаление данных.">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
  <title>Политика конфиденциальности — Funcy</title>
  <link rel="canonical" href="https://jgchkcu-maker.github.io/funpay-funcy/privacy-policy.html">
  <style>
    :root { color-scheme: light; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; color: #242135; background: #f6f5fb; }
    * { box-sizing: border-box; }
    body { margin: 0; }
    header { max-width: 940px; margin: 0 auto; padding: 34px 44px 24px; color: #6853ca; font-size: 19px; font-weight: 750; letter-spacing: -.5px; }
    main { max-width: 940px; margin: 0 auto 48px; padding: 36px 44px 40px; background: #fff; border: 1px solid #e5e2ef; border-radius: 20px; }
    h1 { margin: 0 0 18px; font-size: clamp(28px, 5vw, 38px); line-height: 1.2; letter-spacing: -.8px; }
    h2 { margin: 36px 0 14px; font-size: 23px; line-height: 1.3; letter-spacing: -.3px; }
    p, li { font-size: 16px; line-height: 1.75; overflow-wrap: anywhere; }
    p { margin: 14px 0; }
    h1 + p { color: #706a80; font-size: 14px; }
    ul { padding-left: 24px; }
    li { margin: 0 0 14px; }
    a { color: #5e43bf; text-underline-offset: 3px; }
    a:hover { color: #3d258d; }
    a:focus-visible { outline: 2px solid #7663f6; outline-offset: 4px; }
    code { font-size: .92em; background: #f2eff9; border-radius: 4px; padding: 2px 5px; }
    @media(max-width: 640px) { header { padding: 24px 22px 18px; } main { padding: 26px 22px 32px; margin: 0 12px 24px; border-radius: 14px; } p, li { font-size: 15px; } h2 { font-size: 21px; } }
  </style>
</head>
<body>
  <header>Funcy</header>
  <main>
${marked.parse(markdown)}
  </main>
</body>
</html>
`;
    const index = '<!doctype html>\n<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="0;url=privacy-policy.html"><title>Funcy — Политика конфиденциальности</title></head><body><p><a href="privacy-policy.html">Политика конфиденциальности Funcy</a></p></body></html>\n';
    for (const file of ['docs/privacy-policy.html', 'docs/index.html', 'docs/.nojekyll']) {
        if (fs.existsSync(path.join(root, file))) throw new Error(`Refusing to overwrite existing page: ${file}`);
    }
    fs.writeFileSync(path.join(root, 'docs/privacy-policy.html'), html, 'utf8');
    fs.writeFileSync(path.join(root, 'docs/index.html'), index, 'utf8');
    fs.writeFileSync(path.join(root, 'docs/.nojekyll'), '', 'utf8');
    console.log('Prepared privacy page, index and .nojekyll; source text preserved.');
})().catch(error => { console.error(error); process.exit(1); });
