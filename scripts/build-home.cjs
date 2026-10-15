// Generate both crawlable home pages. Run: node scripts/build-home.cjs
// Edit shared markup/styles in index.html and localized copy in home-translations.json.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const translations = require('./home-translations.json');
const template = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const site = 'https://dbgridy.com';

function render(lang) {
    const copy = translations[lang];
    const url = site + (lang === 'ko' ? '/ko/' : '/');
    let html = template.replace(/<html lang="[^"]+">/, `<html lang="${lang}">`)
        .replace(/<body(?: class="[^"]*")?>/, `<body class="lang-${lang}">`)
        .replace(/<title>.*?<\/title>/, `<title>${copy.title}</title>`);
    html = html.replace(/<([a-z][a-z0-9]*)\b([^>]*\bdata-i18n(?:-html)?="([^"]+)"[^>]*)>[\s\S]*?<\/\1>/gi,
        (match, tag, attrs, key) => {
            const value = key.split('.').reduce((obj, part) => obj?.[part], copy);
            if (typeof value !== 'string') throw new Error(`Missing ${lang} translation: ${key}`);
            return `<${tag}${attrs}>${value}</${tag}>`;
        });
    html = html.replace(/<meta (name|property)="(description|og:title|og:description|og:url|og:locale|og:locale:alternate|twitter:title|twitter:description|twitter:url)" content="[^"]*">/g,
        (match, kind, key) => {
            const values = {
                description: copy.description, 'og:title': copy.title, 'og:description': copy.description,
                'og:url': url, 'og:locale': lang === 'ko' ? 'ko_KR' : 'en_US',
                'og:locale:alternate': lang === 'ko' ? 'en_US' : 'ko_KR',
                'twitter:title': copy.title, 'twitter:description': copy.description, 'twitter:url': url
            };
            return `<meta ${kind}="${key}" content="${values[key]}">`;
        });
    html = html.replace(/<link rel="canonical" href="[^"]+">/, `<link rel="canonical" href="${url}">`)
        .replace(/<a ([^>]*class="logo"[^>]*|[^>]*class="lang-switch"[^>]*)>/g, (match, attrs) => {
            const target = attrs.includes('lang-switch') ? (lang === 'ko' ? '/' : '/ko/') : (lang === 'ko' ? '/ko/' : '/');
            return `<a ${attrs.replace(/href="[^"]*"/, `href="${target}"`)}>`;
        });
    const software = {
        '@type': 'SoftwareApplication', '@id': site + '/#software', name: 'DBGridy', url: site + '/',
        operatingSystem: 'Windows', applicationCategory: 'DeveloperApplication',
        description: copy.hero.desc1, image: site + '/dbgridy192.png',
        screenshot: [site + '/dbgridy-dark.png', site + '/dbgridy-light.png', site + '/terminal.png'],
        downloadUrl: 'https://github.com/BrianMSon/DBGridy/releases',
        license: 'https://github.com/BrianMSon/DBGridy/blob/main/LICENSE.txt',
        author: { '@type': 'Person', name: 'BrianMSon', url: 'https://github.com/BrianMSon' },
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', url: 'https://github.com/BrianMSon/DBGridy/releases' },
        featureList: ['MySQL', 'MongoDB', 'Redis', 'ClickHouse', 'PostgreSQL', 'SQLite', 'Microsoft SQL Server', 'Oracle',
            'Grid-based data editing', 'SQL and JSON query editor', 'CSV, SQL and JSON export', 'SSH terminal', 'SFTP', 'WSL', 'Light and dark themes']
    };
    const data = {
        '@context': 'https://schema.org', '@graph': [
            { '@type': 'WebSite', '@id': site + '/#website', url: site + '/', name: 'DBGridy', inLanguage: ['en', 'ko'] },
            { '@type': 'WebPage', '@id': url + '#webpage', url, name: copy.title, description: copy.description,
                inLanguage: lang, isPartOf: { '@id': site + '/#website' }, about: { '@id': site + '/#software' } },
            software
        ]
    };
    html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/,
        `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n    </script>`);
    return html;
}

fs.mkdirSync(path.join(root, 'ko'), { recursive: true });
fs.writeFileSync(path.join(root, 'index.html'), render('en'));
fs.writeFileSync(path.join(root, 'ko/index.html'), render('ko'));
console.log('Generated index.html and ko/index.html.');
