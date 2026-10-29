"""Validate the repository's review-only Cloudflare MCP setup without network access."""
from pathlib import Path
import tomllib

root = Path(__file__).resolve().parents[3]
config_path = root / ".codex" / "config.toml"
agents_path = root / "AGENTS.md"
config = tomllib.loads(config_path.read_text(encoding="utf-8"))
assert config == {
    "mcp_servers": {
        "cloudflare": {
            "url": "https://mcp.cloudflare.com/mcp",
        }
    }
}, "Cloudflare project config may not include extra servers, tokens or permissions"
instructions = agents_path.read_text(encoding="utf-8")
assert "npx -y skills add cloudflare/skills --skill '*' --yes --global" in instructions
assert "codex mcp login cloudflare" in instructions
assert "read-only account and D1 inventory" in instructions
assert "separately created and independently verified" in instructions
assert "Never request or log credentials" in instructions
print("PASS: official Cloudflare MCP URL, safe project scope and owner-controlled OAuth instructions; no secrets or remote writes")
