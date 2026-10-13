#!/usr/bin/env python3
"""把「功能增强脚本」注入到 dist。

背景：你原先用的那套主题 = 基础 React 构建 + 运行时注入脚本，日历按钮（到期时间线）、
资产统计面板、心情/等级系统、资产弹窗布局修正都来自注入脚本，而不是 React 源码。
所以我们重做后必须把这几段增强一起注入，否则这些按钮和效果会丢失。

注入内容（全部来自原包，逐字）：
  1. enhancements/komari-mood-v21.js       心情/等级系统（读 /api/public 的 showMoodSystem / showLevelSystem）
  2. enhancements/komari-asset-fix.js      资产弹窗布局修正（纯 CSS）
  3. enhancements/inline-expiry-asset.js   「到期时间线」按钮 + 「资产统计」面板（原版是内联在 index.html 里的）

不注入原包里的另外三段（inline-04/05/06）：它们是厂商的品牌水印与防篡改检测脚本，
会检查 script[data-k] 标记，注入到我们改过的构建上会误报「Theme files have been tampered with」。
本主题源码自带页脚品牌（Footer.tsx），不需要它。

用法：
    python inject-enhancements.py            # 注入（幂等，重复执行不会重复插入）
    python inject-enhancements.py --check    # 只检查是否已注入
"""

import glob
import io
import os
import shutil
import sys

THEME_DIR = os.path.dirname(os.path.abspath(__file__))
ENH_DIR = os.path.join(THEME_DIR, 'enhancements')
DIST_DIR = os.path.join(THEME_DIR, 'dist')
CHUNKS_DIR = os.path.join(DIST_DIR, '_next', 'static', 'chunks')

MOOD = 'komari-mood-v21.js'
ASSET_FIX = 'komari-asset-fix.js'
INLINE = 'inline-expiry-asset.js'

MARK = 'data-komari-enhancements'


def build_block():
    inline = io.open(os.path.join(ENH_DIR, INLINE), encoding='utf-8').read().strip()
    if '</script' in inline.lower():
        raise SystemExit('inline 脚本里含 </script>，无法安全内联')
    tags = ''.join(
        '<script %s="1" src="/_next/static/chunks/%s" defer></script>' % (MARK, name)
        for name in (MOOD, ASSET_FIX)
    )
    return tags + '<script %s="1">%s</script>' % (MARK, inline)


def html_pages():
    return sorted(glob.glob(os.path.join(DIST_DIR, '**', '*.html'), recursive=True))


def check():
    pages = html_pages()
    injected = [p for p in pages if MARK in io.open(p, encoding='utf-8', errors='replace').read()]
    files_ok = all(os.path.exists(os.path.join(CHUNKS_DIR, n)) for n in (MOOD, ASSET_FIX))
    print('html 页面: %d | 已注入: %d | 增强脚本文件就位: %s' % (len(pages), len(injected), files_ok))
    return len(injected) == len(pages) and files_ok


def main():
    if '--check' in sys.argv:
        raise SystemExit(0 if check() else 1)

    # next dev 会在 dist/ 下留缓存（约 150 MB），打包必须排除
    dev_cache = os.path.join(DIST_DIR, 'dev')
    if os.path.isdir(dev_cache):
        shutil.rmtree(dev_cache, ignore_errors=True)
        print('已清理 dist/dev 缓存')
    if not os.path.isdir(CHUNKS_DIR):
        raise SystemExit('未找到 dist/_next/static/chunks，请先 npm run build')

    for name in (MOOD, ASSET_FIX):
        shutil.copy2(os.path.join(ENH_DIR, name), os.path.join(CHUNKS_DIR, name))

    block = build_block()
    injected, skipped = 0, 0
    for page in html_pages():
        text = io.open(page, encoding='utf-8').read()
        if MARK in text:
            skipped += 1
            continue
        if '</body>' in text:
            text = text.replace('</body>', block + '</body>', 1)
        else:
            text = text + block
        io.open(page, 'w', encoding='utf-8', newline='').write(text)
        injected += 1

    print('已注入 %d 个页面，跳过已注入 %d 个' % (injected, skipped))
    check()


if __name__ == '__main__':
    main()
