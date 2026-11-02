#!/usr/bin/env python3
"""Собирает игру в один файл snegokat.html (CSS и JS внутри) — удобно для телефона."""
import re, pathlib
root = pathlib.Path(__file__).parent
html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'css/style.css').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="css/style.css">', '<style>\n' + css + '\n</style>')
def inline(m):
    js = (root / m.group(1)).read_text(encoding='utf-8')
    return '<script>\n' + js.replace('</script', '<\\/script') + '\n</script>'
html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
(root / 'snegokat.html').write_text(html, encoding='utf-8')
print('snegokat.html:', len(html) // 1024, 'KB')
