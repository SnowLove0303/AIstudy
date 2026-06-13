# -*- coding: utf-8 -*-
r"""
AIstudy course-library MCP service console.

Run from PowerShell:
  python .\MCP.py
  python .\MCP.py status --json
  python .\MCP.py outline --course "金融市场基础知识"
"""

from __future__ import annotations

import argparse
import datetime as _dt
import html
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Iterable


APP_NAME = "AIstudy"
PROJECT_ROOT = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("APPDATA", "")) / "aistudy" / "data"
COURSES_JSON = DATA_DIR / "courses.json"
MYSQL_JSON = DATA_DIR / "mysql.json"
CONTRACT_PATH = PROJECT_ROOT / "mcp" / "aistudy-notion-knowledge-import.contract.json"
GUIDE_PATH = PROJECT_ROOT / "docs" / "mcp-notion-knowledge-import.md"
LOG_PATH = PROJECT_ROOT / ".omx" / "mcp-service.log"
SAFE_TAGS = {"p", "br", "ul", "ol", "li", "strong", "b", "em", "i", "u", "s"}
BLOCKED_TAGS = {"script", "style", "iframe", "object", "embed", "form"}


def configure_console() -> None:
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")


def now_iso() -> str:
    return _dt.datetime.now(_dt.timezone.utc).isoformat()


def timestamp() -> str:
    return _dt.datetime.now().strftime("%Y%m%d-%H%M%S")


def log_event(action: str, detail: str) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(f"[{now_iso()}] {action}: {detail}\n")


def print_json(value: Any) -> None:
    print(json.dumps(value, ensure_ascii=False, indent=2))


def read_json_file(path: Path) -> Any:
    raw = path.read_text(encoding="utf-8-sig")
    return json.loads(raw)


def write_json_atomic(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(payload, ensure_ascii=False, indent=2)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False, dir=str(path.parent), suffix=".tmp") as handle:
        handle.write(encoded)
        temp_path = Path(handle.name)
    read_json_file(temp_path)
    os.replace(temp_path, path)


def normalize_payload(payload: Any) -> dict[str, Any]:
    if isinstance(payload, list):
        return {"version": 1, "source": "array", "courses": payload}
    if isinstance(payload, dict) and isinstance(payload.get("courses"), list):
        return payload
    raise ValueError("courses.json 格式不正确：必须是课程数组或包含 courses 数组的对象")


def load_payload() -> dict[str, Any]:
    if not COURSES_JSON.exists():
        raise FileNotFoundError(f"课程库不存在：{COURSES_JSON}")
    return normalize_payload(read_json_file(COURSES_JSON))


def save_payload(payload: dict[str, Any]) -> None:
    payload["version"] = payload.get("version", 1)
    payload["savedAt"] = now_iso()
    write_json_atomic(COURSES_JSON, payload)
    log_event("save-json", str(COURSES_JSON))


def backup_courses(reason: str = "manual") -> Path:
    if not COURSES_JSON.exists():
        raise FileNotFoundError(f"无法备份，课程库不存在：{COURSES_JSON}")
    backup_path = DATA_DIR / f"courses.json.before-{reason}-{timestamp()}.bak"
    shutil.copy2(COURSES_JSON, backup_path)
    log_event("backup", str(backup_path))
    return backup_path


def latest_backups(limit: int = 10) -> list[Path]:
    if not DATA_DIR.exists():
        return []
    backups = sorted(DATA_DIR.glob("courses.json.before-*.bak"), key=lambda item: item.stat().st_mtime, reverse=True)
    return backups[:limit]


def ai_study_running() -> bool:
    try:
        result = subprocess.run(
            ["tasklist", "/FI", "IMAGENAME eq AIstudy.exe", "/FO", "CSV", "/NH"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            check=False,
        )
        return "AIstudy.exe" in result.stdout
    except Exception:
        return False


def stop_ai_study() -> bool:
    if not ai_study_running():
        return True
    result = subprocess.run(["taskkill", "/IM", "AIstudy.exe", "/F"], capture_output=True, text=True, check=False)
    log_event("stop-aistudy", f"exit={result.returncode}")
    return result.returncode == 0


def ensure_safe_write_context(auto_close: bool = False) -> None:
    if not ai_study_running():
        return
    if auto_close:
        if stop_ai_study():
            return
    raise RuntimeError("AIstudy 正在运行。直接写课程库前请先关闭 AIstudy，或在交互菜单选择自动关闭。")


@dataclass
class NodeRecord:
    node_id: str
    topic: str
    path: list[str]
    depth: int
    parent_id: str
    order: int

    @property
    def node_path(self) -> str:
        return " / ".join(self.path)


def iter_nodes(node: dict[str, Any], path: list[str] | None = None, depth: int = 0, parent_id: str = "", order_base: int = 0) -> Iterable[NodeRecord]:
    path = path or []
    node_id = str(node.get("id", ""))
    topic = str(node.get("topic", "")).strip()
    current_path = [*path, topic] if topic else path
    yield NodeRecord(node_id=node_id, topic=topic, path=current_path, depth=depth, parent_id=parent_id, order=order_base)
    for index, child in enumerate(node.get("children") or []):
        if isinstance(child, dict):
            yield from iter_nodes(child, current_path, depth + 1, node_id, index)


def get_course(payload: dict[str, Any], course_query: str) -> dict[str, Any]:
    courses = payload.get("courses", [])
    exact = [course for course in courses if str(course.get("title", "")).strip() == course_query.strip()]
    if len(exact) == 1:
        return exact[0]
    by_id = [course for course in courses if str(course.get("id", "")).strip() == course_query.strip()]
    if len(by_id) == 1:
        return by_id[0]
    fuzzy = [course for course in courses if course_query.strip() and course_query.strip() in str(course.get("title", ""))]
    if len(fuzzy) == 1:
        return fuzzy[0]
    if len(exact) + len(by_id) + len(fuzzy) > 1:
        raise ValueError("课程匹配不唯一，请使用课程 id")
    raise ValueError(f"找不到课程：{course_query}")


def get_node(course: dict[str, Any], node_query: str) -> NodeRecord:
    node_index = list(iter_nodes(course.get("mindMap", {}).get("nodeData", {})))
    exact_id = [node for node in node_index if node.node_id == node_query]
    if len(exact_id) == 1:
        return exact_id[0]
    exact_topic = [node for node in node_index if node.topic == node_query]
    if len(exact_topic) == 1:
        return exact_topic[0]
    path_match = [node for node in node_index if node.node_path == node_query]
    if len(path_match) == 1:
        return path_match[0]
    if len(exact_topic) + len(path_match) > 1:
        raise ValueError("节点匹配不唯一，请使用 nodeId")
    raise ValueError(f"找不到节点：{node_query}")


class SafeHtmlParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.parts: list[str] = []
        self.blocked: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag in BLOCKED_TAGS:
            self.blocked.append(tag)
            return
        if tag not in SAFE_TAGS:
            return
        for attr_name, attr_value in attrs:
            if attr_name.lower().startswith("on") or (attr_value and "javascript:" in attr_value.lower()):
                self.blocked.append(f"{tag}.{attr_name}")
                return
        self.parts.append(f"<{tag}>")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in SAFE_TAGS and tag != "br":
            self.parts.append(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        self.parts.append(html.escape(data, quote=False))

    def handle_entityref(self, name: str) -> None:
        self.parts.append(f"&{name};")

    def handle_charref(self, name: str) -> None:
        self.parts.append(f"&#{name};")


def text_to_html(value: str) -> str:
    lines = value.splitlines()
    if not lines:
        return ""
    paragraphs: list[str] = []
    for line in lines:
        if line == "":
            paragraphs.append("<p><br></p>")
        else:
            paragraphs.append(f"<p>{html.escape(line, quote=False)}</p>")
    return "\n".join(paragraphs)


def sanitize_html(value: str) -> str:
    candidate = value.strip()
    if not candidate:
        raise ValueError("写入内容为空")
    if not re.search(r"</?[a-zA-Z][^>]*>", candidate):
        candidate = text_to_html(value)
    parser = SafeHtmlParser()
    parser.feed(candidate)
    if parser.blocked:
        raise ValueError(f"HTML 含不安全内容：{', '.join(parser.blocked)}")
    sanitized = "".join(parser.parts).strip()
    plain = strip_html(sanitized).strip()
    if not plain and "<br>" not in sanitized:
        raise ValueError("安全过滤后内容为空")
    return sanitized


def strip_html(value: str) -> str:
    text = re.sub(r"<br\s*/?>", "\n", value, flags=re.I)
    text = re.sub(r"</p\s*>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    return html.unescape(text)


def command_status(args: argparse.Namespace) -> dict[str, Any]:
    config = load_mysql_config()
    mysql_reachable = mysql_port_reachable(config) if config else False
    report = {
        "contractReady": CONTRACT_PATH.exists(),
        "guideReady": GUIDE_PATH.exists(),
        "jsonDatabaseReady": COURSES_JSON.exists(),
        "jsonDatabasePath": str(COURSES_JSON),
        "mysqlConfigReady": MYSQL_JSON.exists(),
        "mysqlConnected": mysql_reachable,
        "notionCacheReady": (Path(os.environ.get("APPDATA", "")) / "Notion" / "notion.db").exists(),
        "backupCount": len(latest_backups(50)),
        "aiStudyRunning": ai_study_running(),
        "logPath": str(LOG_PATH),
    }
    log_event("status", f"json={report['jsonDatabaseReady']} mysql={report['mysqlConnected']}")
    return report


def command_list_courses(args: argparse.Namespace) -> list[dict[str, Any]]:
    payload = load_payload()
    rows = []
    for index, course in enumerate(payload.get("courses", []), start=1):
        nodes = list(iter_nodes(course.get("mindMap", {}).get("nodeData", {})))
        knowledge = course.get("knowledgePoints") or {}
        rows.append({
            "index": index,
            "id": course.get("id"),
            "title": course.get("title"),
            "category": course.get("category", ""),
            "progress": course.get("progress", 0),
            "nodes": len(nodes),
            "knowledgePoints": len([value for value in knowledge.values() if str(value).strip()]),
        })
    log_event("list-courses", f"count={len(rows)}")
    return rows


def command_outline(args: argparse.Namespace) -> list[dict[str, Any]]:
    payload = load_payload()
    course = get_course(payload, args.course)
    rows = []
    for node in iter_nodes(course.get("mindMap", {}).get("nodeData", {})):
        if args.depth is not None and node.depth > args.depth:
            continue
        rows.append({
            "nodeId": node.node_id,
            "topic": node.topic,
            "depth": node.depth,
            "parentId": node.parent_id,
            "path": node.node_path,
        })
    log_event("outline", f"course={course.get('title')} nodes={len(rows)}")
    return rows


def command_search_nodes(args: argparse.Namespace) -> list[dict[str, Any]]:
    payload = load_payload()
    courses = [get_course(payload, args.course)] if args.course else payload.get("courses", [])
    keyword = str(args.keyword).strip().lower()
    if not keyword:
        raise ValueError("搜索词不能为空")
    rows: list[dict[str, Any]] = []
    for course in courses:
        for node in iter_nodes(course.get("mindMap", {}).get("nodeData", {})):
            haystack = f"{node.topic} {node.node_path}".lower()
            if keyword in haystack:
                rows.append({
                    "courseTitle": course.get("title"),
                    "nodeId": node.node_id,
                    "topic": node.topic,
                    "depth": node.depth,
                    "path": node.node_path,
                })
            if len(rows) >= args.limit:
                break
    log_event("search-nodes", f"keyword={args.keyword} count={len(rows)}")
    return rows


def command_search_knowledge(args: argparse.Namespace) -> list[dict[str, Any]]:
    payload = load_payload()
    courses = [get_course(payload, args.course)] if args.course else payload.get("courses", [])
    keyword = str(args.keyword).strip().lower()
    if not keyword:
        raise ValueError("搜索词不能为空")
    rows: list[dict[str, Any]] = []
    for course in courses:
        node_index = {node.node_id: node for node in iter_nodes(course.get("mindMap", {}).get("nodeData", {}))}
        for node_id, html_value in (course.get("knowledgePoints") or {}).items():
            plain_text = strip_html(str(html_value)).strip()
            if keyword not in plain_text.lower():
                continue
            node = node_index.get(str(node_id))
            rows.append({
                "courseTitle": course.get("title"),
                "nodeId": node_id,
                "nodePath": node.node_path if node else "<孤立知识点>",
                "preview": compact_text(plain_text, 120),
            })
            if len(rows) >= args.limit:
                break
    log_event("search-knowledge", f"keyword={args.keyword} count={len(rows)}")
    return rows


def command_read_knowledge(args: argparse.Namespace) -> dict[str, Any]:
    payload = load_payload()
    course = get_course(payload, args.course)
    node = get_node(course, args.node)
    html_value = str((course.get("knowledgePoints") or {}).get(node.node_id, ""))
    report = {
        "courseId": course.get("id"),
        "courseTitle": course.get("title"),
        "nodeId": node.node_id,
        "nodePath": node.node_path,
        "html": html_value,
        "plainText": strip_html(html_value),
    }
    log_event("read-knowledge", f"{course.get('title')}::{node.node_path}")
    return report


def command_write_knowledge(args: argparse.Namespace) -> dict[str, Any]:
    ensure_safe_write_context(auto_close=args.close_app)
    payload = load_payload()
    course = get_course(payload, args.course)
    node = get_node(course, args.node)
    raw = args.text
    if args.file:
        raw = Path(args.file).read_text(encoding="utf-8")
    if raw is None:
        raise ValueError("缺少写入内容，请传 --text 或 --file")
    sanitized = sanitize_html(raw)
    knowledge_points = dict(course.get("knowledgePoints") or {})
    if args.skip_existing and str(knowledge_points.get(node.node_id, "")).strip():
        return {
            "written": False,
            "reason": "skip_existing",
            "nodeId": node.node_id,
            "nodePath": node.node_path,
        }
    backup_path = backup_courses("mcp-write")
    knowledge_points[node.node_id] = sanitized
    course["knowledgePoints"] = knowledge_points
    course["updatedAt"] = now_iso()
    save_payload(payload)
    verify_payload = load_payload()
    verify_course = get_course(verify_payload, str(course.get("id")))
    verified = str((verify_course.get("knowledgePoints") or {}).get(node.node_id, "")).strip() == sanitized.strip()
    if not verified:
        raise RuntimeError("写后校验失败")
    mysql_synced = sync_mysql_if_requested(args.sync_mysql)
    report = {
        "written": True,
        "courseId": course.get("id"),
        "courseTitle": course.get("title"),
        "nodeId": node.node_id,
        "nodePath": node.node_path,
        "backupPath": str(backup_path),
        "mysqlSynced": mysql_synced,
        "plainTextPreview": strip_html(sanitized).strip()[:120],
    }
    log_event("write-knowledge", f"{course.get('title')}::{node.node_path}")
    return report


def command_clear_knowledge(args: argparse.Namespace) -> dict[str, Any]:
    ensure_safe_write_context(auto_close=args.close_app)
    payload = load_payload()
    course = get_course(payload, args.course)
    node = get_node(course, args.node)
    knowledge_points = dict(course.get("knowledgePoints") or {})
    existed = node.node_id in knowledge_points
    backup_path = backup_courses("mcp-clear")
    knowledge_points.pop(node.node_id, None)
    course["knowledgePoints"] = knowledge_points
    course["updatedAt"] = now_iso()
    save_payload(payload)
    mysql_synced = sync_mysql_if_requested(args.sync_mysql)
    report = {
        "cleared": existed,
        "courseId": course.get("id"),
        "courseTitle": course.get("title"),
        "nodeId": node.node_id,
        "nodePath": node.node_path,
        "backupPath": str(backup_path),
        "mysqlSynced": mysql_synced,
    }
    log_event("clear-knowledge", f"{course.get('title')}::{node.node_path}")
    return report


def command_backup(args: argparse.Namespace) -> dict[str, Any]:
    backup_path = backup_courses("mcp-manual")
    return {"backupPath": str(backup_path), "size": backup_path.stat().st_size}


def command_restore(args: argparse.Namespace) -> dict[str, Any]:
    ensure_safe_write_context(auto_close=args.close_app)
    source = Path(args.backup)
    if not source.exists():
        raise FileNotFoundError(f"备份不存在：{source}")
    read_json_file(source)
    current_backup = backup_courses("mcp-before-restore")
    shutil.copy2(source, COURSES_JSON)
    read_json_file(COURSES_JSON)
    mysql_synced = sync_mysql_if_requested(args.sync_mysql)
    log_event("restore", str(source))
    return {
        "restoredFrom": str(source),
        "previousBackupPath": str(current_backup),
        "mysqlSynced": mysql_synced,
    }


def command_validate(args: argparse.Namespace) -> dict[str, Any]:
    payload = load_payload()
    courses = payload.get("courses", [])
    problems: list[str] = []
    for course in courses:
        title = course.get("title", "<untitled>")
        if not course.get("id"):
            problems.append(f"{title}: 缺少 course.id")
        if not course.get("title"):
            problems.append(f"{title}: 缺少 title")
        node_ids = {node.node_id for node in iter_nodes(course.get("mindMap", {}).get("nodeData", {})) if node.node_id}
        for node_id in (course.get("knowledgePoints") or {}).keys():
            if node_id not in node_ids:
                problems.append(f"{title}: knowledgePoints 孤立 nodeId={node_id}")
        for node_id in (course.get("branchMindMaps") or {}).keys():
            if node_id not in node_ids:
                problems.append(f"{title}: branchMindMaps 孤立 nodeId={node_id}")
    report = {
        "valid": not problems,
        "courseCount": len(courses),
        "problemCount": len(problems),
        "problems": problems[:200],
    }
    log_event("validate", f"valid={report['valid']} problems={report['problemCount']}")
    return report


def command_export_course(args: argparse.Namespace) -> dict[str, Any]:
    payload = load_payload()
    course = get_course(payload, args.course)
    output = Path(args.output) if args.output else PROJECT_ROOT / ".omx" / f"course-{safe_filename(str(course.get('title')))}-{timestamp()}.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    write_json_atomic(output, course)
    log_event("export-course", str(output))
    return {"courseTitle": course.get("title"), "courseId": course.get("id"), "output": str(output)}


def command_import_course(args: argparse.Namespace) -> dict[str, Any]:
    ensure_safe_write_context(auto_close=args.close_app)
    imported = read_json_file(Path(args.input))
    if not isinstance(imported, dict) or not imported.get("id") or not imported.get("title") or not imported.get("mindMap"):
        raise ValueError("导入文件不是合法课程对象")
    payload = load_payload()
    courses = list(payload.get("courses", []))
    existing_index = next((index for index, course in enumerate(courses) if course.get("id") == imported.get("id")), None)
    if existing_index is not None and not args.replace:
        raise ValueError("课程 id 已存在。需要覆盖时传 --replace")
    backup_path = backup_courses("mcp-import-course")
    if existing_index is None:
        courses.insert(0, imported)
    else:
        courses[existing_index] = imported
    payload["courses"] = courses
    save_payload(payload)
    mysql_synced = sync_mysql_if_requested(args.sync_mysql)
    log_event("import-course", str(imported.get("title")))
    return {
        "imported": True,
        "courseTitle": imported.get("title"),
        "courseId": imported.get("id"),
        "backupPath": str(backup_path),
        "mysqlSynced": mysql_synced,
    }


def command_sync_mysql(args: argparse.Namespace) -> dict[str, Any]:
    synced = sync_mysql()
    return {"mysqlSynced": synced}


def command_list_backups(args: argparse.Namespace) -> list[dict[str, Any]]:
    return [{"path": str(path), "size": path.stat().st_size, "modified": _dt.datetime.fromtimestamp(path.stat().st_mtime).isoformat()} for path in latest_backups(args.limit)]


def command_export_outline(args: argparse.Namespace) -> dict[str, Any]:
    payload = load_payload()
    course = get_course(payload, args.course)
    output = Path(args.output) if args.output else PROJECT_ROOT / ".omx" / f"outline-{safe_filename(str(course.get('title')))}-{timestamp()}.md"
    output.parent.mkdir(parents=True, exist_ok=True)
    lines = [f"# {course.get('title')}", ""]
    for node in iter_nodes(course.get("mindMap", {}).get("nodeData", {})):
        if args.depth is not None and node.depth > args.depth:
            continue
        prefix = "  " * max(node.depth, 0)
        lines.append(f"{prefix}- {node.topic}  ")
        lines.append(f"{prefix}  - nodeId: `{node.node_id}`")
    output.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    log_event("export-outline", str(output))
    return {"courseTitle": course.get("title"), "output": str(output)}


def command_report(args: argparse.Namespace) -> dict[str, Any]:
    output = Path(args.output) if args.output else PROJECT_ROOT / ".omx" / f"mcp-report-{timestamp()}.md"
    output.parent.mkdir(parents=True, exist_ok=True)
    status = command_status(argparse.Namespace())
    validation = command_validate(argparse.Namespace())
    courses = command_list_courses(argparse.Namespace())
    backups = command_list_backups(argparse.Namespace(limit=5))
    lines = [
        "# AIstudy MCP 巡检报告",
        "",
        f"- 生成时间：{now_iso()}",
        f"- 课程库：{COURSES_JSON}",
        f"- 日志：{LOG_PATH}",
        "",
        "## 状态",
        "",
        *dict_to_bullets(status),
        "",
        "## 课程库校验",
        "",
        *dict_to_bullets(validation),
        "",
        "## 课程概览",
        "",
        markdown_table(courses),
        "",
        "## 最近备份",
        "",
        markdown_table(backups),
        "",
    ]
    output.write_text("\n".join(lines), encoding="utf-8")
    log_event("report", str(output))
    return {
        "output": str(output),
        "valid": validation.get("valid"),
        "courseCount": validation.get("courseCount"),
        "mysqlConnected": status.get("mysqlConnected"),
    }


def safe_filename(value: str) -> str:
    return re.sub(r'[\\/:*?"<>|\s]+', "_", value).strip("_") or "course"


def load_mysql_config() -> dict[str, Any] | None:
    if not MYSQL_JSON.exists():
        return None
    try:
        config = read_json_file(MYSQL_JSON)
    except Exception:
        return None
    if not isinstance(config, dict) or not config.get("host") or not config.get("user") or not config.get("database"):
        return None
    return config


def mysql_port_reachable(config: dict[str, Any] | None, timeout: float = 0.8) -> bool:
    if not config:
        return False
    host = str(config.get("host", "127.0.0.1"))
    port = int(config.get("port", 3306))
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def sync_mysql_if_requested(requested: bool) -> bool:
    if not requested:
        return False
    return sync_mysql()


def sync_mysql() -> bool:
    config = load_mysql_config()
    if not mysql_port_reachable(config):
        log_event("sync-mysql", "skipped: mysql not reachable")
        return False
    if not (PROJECT_ROOT / "node_modules" / "mysql2").exists():
        log_event("sync-mysql", "skipped: mysql2 dependency missing")
        return False
    script = r"""
const fs = require('fs');
const mysql = require('mysql2/promise');

const configPath = process.argv[1];
const payloadPath = process.argv[2];

async function main() {
  const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
  const config = readJson(configPath);
  const payload = readJson(payloadPath);
  const courses = Array.isArray(payload) ? payload : payload.courses;
  if (!Array.isArray(courses)) throw new Error('Invalid courses payload');
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port || 3306,
    user: config.user,
    password: config.password || '',
    database: config.database,
    charset: 'utf8mb4'
  });
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS courses (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      position_index INT NOT NULL DEFAULT 0,
      title VARCHAR(255) NOT NULL,
      category VARCHAR(255) NOT NULL DEFAULT '',
      description TEXT NULL,
      progress INT NOT NULL DEFAULT 0,
      created_at VARCHAR(64) NULL,
      payload_json LONGTEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_meta (
      meta_key VARCHAR(64) NOT NULL PRIMARY KEY,
      meta_value TEXT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await connection.beginTransaction();
  try {
    const ids = [];
    for (let index = 0; index < courses.length; index += 1) {
      const course = courses[index];
      ids.push(String(course.id));
      await connection.execute(`
        INSERT INTO courses (
          id, position_index, title, category, description, progress, created_at, payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          position_index = VALUES(position_index),
          title = VALUES(title),
          category = VALUES(category),
          description = VALUES(description),
          progress = VALUES(progress),
          created_at = VALUES(created_at),
          payload_json = VALUES(payload_json)
      `, [
        String(course.id),
        index,
        course.title || '',
        course.category || '',
        course.description || '',
        course.progress || 0,
        course.createdAt || null,
        JSON.stringify(course)
      ]);
    }
    if (ids.length > 0) {
      await connection.query('DELETE FROM courses WHERE id NOT IN (?)', [ids]);
    } else {
      await connection.query('DELETE FROM courses');
    }
    await connection.execute(`
      INSERT INTO app_meta (meta_key, meta_value)
      VALUES ('courses_saved_at', ?)
      ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)
    `, [new Date().toISOString()]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
"""
    result = subprocess.run(
        ["node", "-e", script, str(MYSQL_JSON), str(COURSES_JSON)],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    ok = result.returncode == 0
    log_event("sync-mysql", "ok" if ok else result.stderr.strip()[:300])
    return ok


def format_table(rows: list[dict[str, Any]]) -> str:
    if not rows:
        return "无数据"
    columns = list(rows[0].keys())
    widths = {column: max(len(str(column)), *(len(str(row.get(column, ""))) for row in rows)) for column in columns}
    header = "  ".join(str(column).ljust(widths[column]) for column in columns)
    sep = "  ".join("-" * widths[column] for column in columns)
    body = "\n".join("  ".join(str(row.get(column, "")).ljust(widths[column]) for column in columns) for row in rows)
    return f"{header}\n{sep}\n{body}"


def compact_text(value: str, limit: int = 120) -> str:
    compacted = re.sub(r"\s+", " ", value).strip()
    return compacted if len(compacted) <= limit else f"{compacted[:limit - 1]}…"


def dict_to_bullets(value: dict[str, Any]) -> list[str]:
    return [f"- {key}：{json.dumps(item, ensure_ascii=False) if isinstance(item, (dict, list)) else item}" for key, item in value.items()]


def markdown_table(rows: list[dict[str, Any]]) -> str:
    if not rows:
        return "无数据"
    columns = list(rows[0].keys())
    header = "| " + " | ".join(columns) + " |"
    separator = "| " + " | ".join("---" for _ in columns) + " |"
    body = []
    for row in rows:
        body.append("| " + " | ".join(str(row.get(column, "")).replace("|", "\\|").replace("\n", " ") for column in columns) + " |")
    return "\n".join([header, separator, *body])


def print_result(result: Any, as_json: bool = False) -> None:
    if as_json:
        print_json(result)
    elif isinstance(result, list) and all(isinstance(item, dict) for item in result):
        print(format_table(result))
    elif isinstance(result, dict):
        print_json(result)
    else:
        print(result)


def ask(prompt: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    value = input(f"{prompt}{suffix}: ").strip()
    return value or default


def route_header(title: str, summary: str, writes_data: bool = False) -> None:
    print(f"\n{title}")
    print(f"用途：{summary}")
    print(f"数据影响：{'可能写入课程库，执行前会备份并校验。' if writes_data else '只读，不会修改课程库。'}")


def interactive_menu() -> None:
    while True:
        print("\nAIstudy MCP - 课程库路线选择")
        print("1. 巡检路线：状态 / 校验 / 课程概览")
        print("2. 读取路线：课程 / 目录 / 知识点")
        print("3. 写入路线：写知识点 / 清空知识点")
        print("4. 备份路线：备份 / 查看备份 / 回滚")
        print("5. 迁移路线：导出课程 / 导入课程")
        print("6. 数据库路线：MySQL 状态 / 同步")
        print("0. 退出")
        choice = ask("选择路线")
        try:
            if choice == "1":
                route_inspection()
            elif choice == "2":
                route_read()
            elif choice == "3":
                route_write()
            elif choice == "4":
                route_backup()
            elif choice == "5":
                route_migration()
            elif choice == "6":
                route_mysql()
            elif choice == "0":
                return
            else:
                print("无效路线")
        except Exception as error:
            print(f"失败：{error}")


def route_inspection() -> None:
    while True:
        route_header("巡检路线", "确认 MCP 契约、课程库 JSON、Notion 缓存、MySQL、备份和课程结构是否正常。")
        print("1. MCP 状态检测：看接口、文件、数据库是否就绪")
        print("2. 课程库结构校验：检查孤立知识点和缺失字段")
        print("3. 课程概览：列出课程数量、节点数量、知识点数量")
        print("4. 一键巡检：连续执行状态、校验、概览")
        print("5. 生成巡检报告：输出 Markdown 报告到 .omx")
        print("0. 返回路线选择")
        choice = ask("选择步骤")
        if choice == "1":
            print_result(command_status(argparse.Namespace()), False)
        elif choice == "2":
            print_result(command_validate(argparse.Namespace()), False)
        elif choice == "3":
            print_result(command_list_courses(argparse.Namespace()), False)
        elif choice == "4":
            print("\n[MCP 状态]")
            print_result(command_status(argparse.Namespace()), False)
            print("\n[课程校验]")
            print_result(command_validate(argparse.Namespace()), False)
            print("\n[课程概览]")
            print_result(command_list_courses(argparse.Namespace()), False)
        elif choice == "5":
            output = ask("报告输出路径，留空自动生成")
            print_result(command_report(argparse.Namespace(output=output or None)), False)
        elif choice == "0":
            return
        else:
            print("无效步骤")


def route_read() -> None:
    while True:
        route_header("读取路线", "查看课程、目录节点和知识点内容，适合先定位 nodeId 再交给写入路线。")
        print("1. 列出课程：查看课程 id、节点数、知识点数")
        print("2. 查看课程目录：按层级展开目录节点")
        print("3. 搜索目录节点：按关键词找 nodeId")
        print("4. 读取知识点：查看某个节点正文")
        print("5. 搜索知识点正文：全文搜索已写入内容")
        print("6. 导出目录 Markdown：把目录和 nodeId 导出成文档")
        print("0. 返回路线选择")
        choice = ask("选择步骤")
        if choice == "1":
            print_result(command_list_courses(argparse.Namespace()), False)
        elif choice == "2":
            course = ask("课程标题或 id", "金融市场基础知识")
            depth_raw = ask("最大层级，留空为全部")
            depth = int(depth_raw) if depth_raw else None
            print_result(command_outline(argparse.Namespace(course=course, depth=depth)), False)
        elif choice == "3":
            course = ask("课程标题或 id，留空表示所有课程")
            keyword = ask("搜索词")
            limit = int(ask("最多显示多少条", "30"))
            print_result(command_search_nodes(argparse.Namespace(course=course or None, keyword=keyword, limit=limit)), False)
        elif choice == "4":
            course = ask("课程标题或 id", "金融市场基础知识")
            node = ask("nodeId / 节点标题 / 完整路径")
            print_result(command_read_knowledge(argparse.Namespace(course=course, node=node)), False)
        elif choice == "5":
            course = ask("课程标题或 id，留空表示所有课程")
            keyword = ask("正文关键词")
            limit = int(ask("最多显示多少条", "30"))
            print_result(command_search_knowledge(argparse.Namespace(course=course or None, keyword=keyword, limit=limit)), False)
        elif choice == "6":
            course = ask("课程标题或 id", "金融市场基础知识")
            depth_raw = ask("最大层级，留空为全部")
            depth = int(depth_raw) if depth_raw else None
            output = ask("输出路径，留空自动生成")
            print_result(command_export_outline(argparse.Namespace(course=course, depth=depth, output=output or None)), False)
        elif choice == "0":
            return
        else:
            print("无效步骤")


def route_write() -> None:
    while True:
        route_header("写入路线", "按 nodeId 或唯一节点名写入知识点正文。写入前会备份，写后会校验。", writes_data=True)
        print("1. 写入知识点：把文本或 HTML 写到指定节点")
        print("2. 清空知识点：删除指定节点正文")
        print("3. 先查 nodeId：跳转到目录搜索")
        print("0. 返回路线选择")
        choice = ask("选择步骤")
        if choice == "1":
            course = ask("课程标题或 id", "金融市场基础知识")
            node = ask("nodeId / 节点标题 / 完整路径")
            source = ask("内容来源：1=直接输入，2=读取文件", "1")
            text = None
            file_path = None
            if source == "2":
                file_path = ask("文件路径")
            else:
                print("输入正文，结束请输入单独一行 .end")
                lines: list[str] = []
                while True:
                    line = input()
                    if line == ".end":
                        break
                    lines.append(line)
                text = "\n".join(lines)
            close_app = confirm_close_if_running()
            skip_existing = ask("已有内容时跳过？yes/no", "no").lower() == "yes"
            sync_mysql = ask("写入后同步 MySQL？yes/no", "no").lower() == "yes"
            print_result(command_write_knowledge(argparse.Namespace(course=course, node=node, text=text, file=file_path, close_app=close_app, skip_existing=skip_existing, sync_mysql=sync_mysql)), False)
        elif choice == "2":
            course = ask("课程标题或 id", "金融市场基础知识")
            node = ask("nodeId / 节点标题 / 完整路径")
            close_app = confirm_close_if_running()
            sync_mysql = ask("清空后同步 MySQL？yes/no", "no").lower() == "yes"
            print_result(command_clear_knowledge(argparse.Namespace(course=course, node=node, close_app=close_app, sync_mysql=sync_mysql)), False)
        elif choice == "3":
            course = ask("课程标题或 id，留空表示所有课程")
            keyword = ask("搜索词")
            limit = int(ask("最多显示多少条", "30"))
            print_result(command_search_nodes(argparse.Namespace(course=course or None, keyword=keyword, limit=limit)), False)
        elif choice == "0":
            return
        else:
            print("无效步骤")


def route_backup() -> None:
    while True:
        route_header("备份路线", "在写入、导入或回滚前保护课程库，适合做危险操作前的安全点。", writes_data=True)
        print("1. 立即备份课程库：复制当前 courses.json")
        print("2. 查看备份列表：按时间列出最近备份")
        print("3. 回滚到备份：用指定备份恢复课程库")
        print("0. 返回路线选择")
        choice = ask("选择步骤")
        if choice == "1":
            print_result(command_backup(argparse.Namespace()), False)
        elif choice == "2":
            print_result(command_list_backups(argparse.Namespace(limit=20)), False)
        elif choice == "3":
            backup = ask("备份路径")
            close_app = confirm_close_if_running()
            sync_mysql = ask("回滚后同步 MySQL？yes/no", "no").lower() == "yes"
            print_result(command_restore(argparse.Namespace(backup=backup, close_app=close_app, sync_mysql=sync_mysql)), False)
        elif choice == "0":
            return
        else:
            print("无效步骤")


def route_migration() -> None:
    while True:
        route_header("迁移路线", "把课程作为 JSON 文件导出或导入，适合跨机器迁移或做课程级备份。", writes_data=True)
        print("1. 导出课程：导出单个课程 JSON")
        print("2. 导入课程：导入课程 JSON，支持同 id 覆盖")
        print("3. 导出目录 Markdown：只导出目录和 nodeId，不含课程数据")
        print("0. 返回路线选择")
        choice = ask("选择步骤")
        if choice == "1":
            course = ask("课程标题或 id", "金融市场基础知识")
            output = ask("输出路径，留空自动生成")
            print_result(command_export_course(argparse.Namespace(course=course, output=output or None)), False)
        elif choice == "2":
            input_path = ask("课程 JSON 路径")
            replace = ask("同 id 时覆盖？yes/no", "no").lower() == "yes"
            close_app = confirm_close_if_running()
            sync_mysql = ask("导入后同步 MySQL？yes/no", "no").lower() == "yes"
            print_result(command_import_course(argparse.Namespace(input=input_path, replace=replace, close_app=close_app, sync_mysql=sync_mysql)), False)
        elif choice == "3":
            course = ask("课程标题或 id", "金融市场基础知识")
            depth_raw = ask("最大层级，留空为全部")
            depth = int(depth_raw) if depth_raw else None
            output = ask("输出路径，留空自动生成")
            print_result(command_export_outline(argparse.Namespace(course=course, depth=depth, output=output or None)), False)
        elif choice == "0":
            return
        else:
            print("无效步骤")


def route_mysql() -> None:
    while True:
        route_header("数据库路线", "检查 MySQL 连接，并把 JSON 课程库同步到 MySQL。JSON 仍是本地安全底稿。", writes_data=True)
        print("1. 查看 MCP / MySQL 状态：确认配置和端口可用")
        print("2. 同步 JSON 到 MySQL：把当前 courses.json 写入 MySQL")
        print("3. 生成巡检报告：把数据库状态写入报告")
        print("0. 返回路线选择")
        choice = ask("选择步骤")
        if choice == "1":
            print_result(command_status(argparse.Namespace()), False)
        elif choice == "2":
            print_result(command_sync_mysql(argparse.Namespace()), False)
        elif choice == "3":
            output = ask("报告输出路径，留空自动生成")
            print_result(command_report(argparse.Namespace(output=output or None)), False)
        elif choice == "0":
            return
        else:
            print("无效步骤")


def confirm_close_if_running() -> bool:
    if not ai_study_running():
        return False
    return ask("AIstudy 正在运行，是否自动关闭后继续？yes/no", "no").lower() == "yes"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="AIstudy 课程库 MCP PowerShell 服务入口")
    parser.add_argument("--json", action="store_true", help="以 JSON 输出结果")
    subparsers = parser.add_subparsers(dest="command")

    subparsers.add_parser("status", help="状态检测")
    subparsers.add_parser("list", help="列出课程")

    outline = subparsers.add_parser("outline", help="查看课程目录节点")
    outline.add_argument("--course", required=True)
    outline.add_argument("--depth", type=int)

    search_nodes = subparsers.add_parser("search-nodes", help="搜索目录节点")
    search_nodes.add_argument("--keyword", required=True)
    search_nodes.add_argument("--course")
    search_nodes.add_argument("--limit", type=int, default=30)

    read = subparsers.add_parser("knowledge-read", help="读取知识点")
    read.add_argument("--course", required=True)
    read.add_argument("--node", required=True)

    search_knowledge = subparsers.add_parser("knowledge-search", help="搜索知识点正文")
    search_knowledge.add_argument("--keyword", required=True)
    search_knowledge.add_argument("--course")
    search_knowledge.add_argument("--limit", type=int, default=30)

    write = subparsers.add_parser("knowledge-write", help="写入知识点")
    write.add_argument("--course", required=True)
    write.add_argument("--node", required=True)
    write.add_argument("--text")
    write.add_argument("--file")
    write.add_argument("--close-app", action="store_true")
    write.add_argument("--skip-existing", action="store_true")
    write.add_argument("--sync-mysql", action="store_true")

    clear = subparsers.add_parser("knowledge-clear", help="清空知识点")
    clear.add_argument("--course", required=True)
    clear.add_argument("--node", required=True)
    clear.add_argument("--close-app", action="store_true")
    clear.add_argument("--sync-mysql", action="store_true")

    subparsers.add_parser("backup", help="备份课程库")

    backups = subparsers.add_parser("backups", help="查看备份")
    backups.add_argument("--limit", type=int, default=10)

    restore = subparsers.add_parser("restore", help="回滚备份")
    restore.add_argument("--backup", required=True)
    restore.add_argument("--close-app", action="store_true")
    restore.add_argument("--sync-mysql", action="store_true")

    subparsers.add_parser("validate", help="校验课程库")

    report = subparsers.add_parser("report", help="生成 MCP 巡检报告")
    report.add_argument("--output")

    export_course = subparsers.add_parser("export-course", help="导出课程")
    export_course.add_argument("--course", required=True)
    export_course.add_argument("--output")

    export_outline = subparsers.add_parser("export-outline", help="导出课程目录 Markdown")
    export_outline.add_argument("--course", required=True)
    export_outline.add_argument("--depth", type=int)
    export_outline.add_argument("--output")

    import_course = subparsers.add_parser("import-course", help="导入课程")
    import_course.add_argument("--input", required=True)
    import_course.add_argument("--replace", action="store_true")
    import_course.add_argument("--close-app", action="store_true")
    import_course.add_argument("--sync-mysql", action="store_true")

    subparsers.add_parser("sync-mysql", help="同步 MySQL")
    subparsers.add_parser("menu", help="打开交互菜单")
    return parser


COMMANDS = {
    "status": command_status,
    "list": command_list_courses,
    "outline": command_outline,
    "search-nodes": command_search_nodes,
    "knowledge-read": command_read_knowledge,
    "knowledge-search": command_search_knowledge,
    "knowledge-write": command_write_knowledge,
    "knowledge-clear": command_clear_knowledge,
    "backup": command_backup,
    "backups": command_list_backups,
    "restore": command_restore,
    "validate": command_validate,
    "report": command_report,
    "export-course": command_export_course,
    "export-outline": command_export_outline,
    "import-course": command_import_course,
    "sync-mysql": command_sync_mysql,
}


def main() -> int:
    configure_console()
    parser = build_parser()
    argv = sys.argv[1:]
    json_output = "--json" in argv
    if json_output:
        argv = [item for item in argv if item != "--json"]
    args = parser.parse_args(argv)
    args.json = json_output or getattr(args, "json", False)
    if not args.command or args.command == "menu":
        interactive_menu()
        return 0
    try:
        result = COMMANDS[args.command](args)
        print_result(result, args.json)
        return 0
    except Exception as error:
        log_event("error", f"{args.command}: {error}")
        if args.json:
            print_json({"ok": False, "error": str(error)})
        else:
            print(f"失败：{error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
