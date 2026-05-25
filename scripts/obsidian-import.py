#!/usr/bin/env python3
"""
Obsidian 只读导入脚本

用法:
    python3 scripts/obsidian-import.py /path/to/obsidian/vault --api http://localhost:7001 --token YOUR_TOKEN

功能:
    - 扫描 Obsidian vault 中的 Markdown 文件
    - 按文件夹分类（新闻整理/日刊/现实反馈/研究报告 → 自定义映射）
    - 导入到 Pi Console 的 Page（Wiki）或 WritingMaterial（素材池）
    - 只读：不修改原始 Obsidian 文件

参数:
    vault_path    Obsidian vault 根目录
    --api         Pi Console API 地址 (默认 http://localhost:7001)
    --token       PI_API_TOKEN
    --mode        导入模式: wiki (默认) | materials | both
    --prefix      Wiki 页面标题前缀 (默认 "Obsidian/")
    --dry-run     仅预览，不实际导入
    --tag-map     文件夹→标签映射，格式: folder1=tag1,folder2=tag2
"""

import argparse
import os
import re
import sys
import json
import hashlib
from pathlib import Path
from datetime import datetime

try:
    import httpx
except ImportError:
    print("请安装 httpx: pip3 install httpx")
    sys.exit(1)

YAML_FRONTMATTER = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


def parse_frontmatter(content: str) -> tuple[dict, str]:
    m = YAML_FRONTMATTER.match(content)
    if not m:
        return {}, content
    fm = {}
    for line in m.group(1).split("\n"):
        if ":" in line:
            k, v = line.split(":", 1)
            fm[k.strip()] = v.strip().strip('"').strip("'")
    body = content[m.end():]
    return fm, body


def scan_vault(vault_path: str) -> list[dict]:
    vault = Path(vault_path)
    if not vault.is_dir():
        print(f"[!] Vault 目录不存在: {vault_path}")
        sys.exit(1)

    files = []
    for md_file in vault.rglob("*.md"):
        rel = md_file.relative_to(vault)
        content = md_file.read_text(encoding="utf-8", errors="replace")
        fm, body = parse_frontmatter(content)
        files.append({
            "path": str(rel),
            "abs_path": str(md_file),
            "folder": str(rel.parent) if str(rel.parent) != "." else "",
            "title": fm.get("title", "") or md_file.stem,
            "tags": fm.get("tags", ""),
            "date": fm.get("date", "") or fm.get("created", ""),
            "content": body,
            "size": len(body),
            "hash": hashlib.md5(body.encode()).hexdigest()[:12],
        })
    return files


def categorize(files: list[dict], tag_map: dict[str, str]) -> dict[str, list[dict]]:
    cats: dict[str, list[dict]] = {}
    for f in files:
        folder = f["folder"].lower()
        category = "uncategorized"
        for pattern, cat_name in tag_map.items():
            if pattern.lower() in folder:
                category = cat_name
                break
        cats.setdefault(category, []).append(f)
    return cats


def ensure_space(client: httpx.Client, token: str) -> str:
    spaces_resp = client.get("/api/wiki/spaces", headers={"X-API-Token": token})
    if spaces_resp.status_code == 200:
        for s in spaces_resp.json():
            if s.get("id") == "obsidian-import" or s.get("name") == "Obsidian Import":
                return s["id"]
    try:
        resp = client.post(
            "/api/wiki/spaces",
            json={"name": "Obsidian Import", "description": "从 Obsidian vault 导入的页面"},
            headers={"X-API-Token": token},
        )
        if resp.status_code in (200, 201):
            data = resp.json()
            return data.get("id", "obsidian-import")
    except Exception:
        pass
    return "obsidian-import"


def import_to_wiki(client: httpx.Client, token: str, files: list[dict], prefix: str):
    space_id = ensure_space(client, token)
    success = 0
    failed = 0
    for f in files:
        title = f"{prefix}{f['folder']}/{f['title']}" if f["folder"] else f"{prefix}{f['title']}"
        try:
            resp = client.post(
                "/api/wiki/pages",
                json={
                    "title": title,
                    "content": f["content"],
                    "space_id": space_id,
                },
                headers={"X-API-Token": token},
            )
            if resp.status_code in (200, 201):
                success += 1
            else:
                failed += 1
                print(f"  [!] {f['path']}: {resp.status_code} {resp.text[:80]}")
        except Exception as e:
            failed += 1
            print(f"  [!] {f['path']}: {e}")
    return success, failed


def import_to_materials(client: httpx.Client, token: str, files: list[dict], project_id: str | None):
    if not project_id:
        print("  [!] 导入素材需要 --project-id 参数")
        return 0, len(files)
    success = 0
    failed = 0
    for f in files:
        try:
            resp = client.post(
                f"/api/writing/projects/{project_id}/materials",
                json={
                    "source_type": "obsidian",
                    "source_id": f["hash"],
                    "title": f["title"],
                    "snippet": f["content"][:500],
                    "relevance_note": f"来自 Obsidian: {f['path']}",
                },
                headers={"X-API-Token": token},
            )
            if resp.status_code in (200, 201):
                success += 1
            else:
                failed += 1
        except Exception:
            failed += 1
    return success, failed


def main():
    parser = argparse.ArgumentParser(description="Obsidian 只读导入到 Pi Console")
    parser.add_argument("vault_path", help="Obsidian vault 根目录")
    parser.add_argument("--api", default="http://localhost:7001", help="Pi Console API 地址")
    parser.add_argument("--token", required=True, help="PI_API_TOKEN")
    parser.add_argument("--mode", choices=["wiki", "materials", "both"], default="wiki")
    parser.add_argument("--prefix", default="Obsidian/", help="Wiki 页面前缀")
    parser.add_argument("--project-id", default=None, help="写作项目 ID (materials 模式)")
    parser.add_argument("--dry-run", action="store_true", help="仅预览")
    parser.add_argument(
        "--tag-map",
        default="",
        help="文件夹映射: 新闻=news,日刊=daily-journal,研究=research",
    )
    args = parser.parse_args()

    tag_map = {}
    if args.tag_map:
        for pair in args.tag_map.split(","):
            if "=" in pair:
                k, v = pair.split("=", 1)
                tag_map[k.strip()] = v.strip()

    print("=" * 40)
    print("  Obsidian 只读导入")
    print("=" * 40)
    print(f"Vault: {args.vault_path}")
    print(f"API:   {args.api}")
    print(f"模式:  {args.mode}")
    print("")

    files = scan_vault(args.vault_path)
    print(f"扫描到 {len(files)} 个 Markdown 文件")

    cats = categorize(files, tag_map)
    for cat, cat_files in sorted(cats.items()):
        print(f"  {cat}: {len(cat_files)} 个文件")

    if args.dry_run:
        print("\n[dry-run] 预览完成，未实际导入")
        print("\n文件列表:")
        for cat, cat_files in sorted(cats.items()):
            print(f"\n  [{cat}]")
            for f in cat_files[:10]:
                print(f"    {f['path']} ({f['size']} chars)")
            if len(cat_files) > 10:
                print(f"    ... 还有 {len(cat_files) - 10} 个")
        return

    client = httpx.Client(base_url=args.api, timeout=30)

    total_ok = 0
    total_fail = 0

    if args.mode in ("wiki", "both"):
        print(f"\n[1] 导入到 Wiki (前缀: {args.prefix})...")
        ok, fail = import_to_wiki(client, args.token, files, args.prefix)
        total_ok += ok
        total_fail += fail
        print(f"  成功: {ok}, 失败: {fail}")

    if args.mode in ("materials", "both"):
        print(f"\n[2] 导入到素材池...")
        ok, fail = import_to_materials(client, args.token, files, args.project_id)
        total_ok += ok
        total_fail += fail
        print(f"  成功: {ok}, 失败: {fail}")

    print(f"\n{'=' * 40}")
    print(f"  导入完成: {total_ok} 成功 / {total_fail} 失败")
    print(f"  Obsidian 原文件未修改")
    print(f"{'=' * 40}")


if __name__ == "__main__":
    main()
