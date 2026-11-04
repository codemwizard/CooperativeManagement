#!/usr/bin/env python3
"""Validates data/help.json and data/tours.json against the data files.
Run from the kit root:  python3 tools/validate_help.py
Checks: ids unique; pattern and word limits; banned words; tokens resolve; screens valid;
text_ref resolves; required visible text complete; forbidden terms absent; tour fields valid."""
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
L = lambda n: json.load(open(os.path.join(ROOT, n)))
help_, tours = L("data/help.json"), L("data/tours.json")
meta, dests, inter = L("data/meta.json"), L("data/destinations.json"), L("data/interventions.json")
schema = L("data/capture_event_schema.json")
forb = [t.lower() for t in L("data/forbidden_terms.json")["terms"]]
SCREENS = {s for s in schema["properties"]["screen_id"]["enum"] if s}
ctx = {"meta": meta, "interventions": inter, "destinations": {d["id"]: d for d in dests["destinations"]}}
errs = []
TOKEN = re.compile(r"\{\{\s*([^}|]+?)\s*(?:\|\s*(\w+))?\s*\}\}")

def resolve(path):
    cur = ctx
    for part in path.split("."):
        if isinstance(cur, list): cur = cur[int(part)]
        else: cur = cur[part]
    return cur

def words(s): return len(re.findall(r"\S+", re.sub(r"\{\{[^}]*\}\}", "X", s)))

def render(text, declared):
    def sub(m):
        path, flt = m.group(1), m.group(2)
        if path.startswith("value."):
            if path[6:] not in declared: errs.append(f"undeclared value token {path}")
            return "0"
        try: v = resolve(path)
        except Exception: errs.append(f"unresolvable token {path}"); return "?"
        if flt == "num": return f"{int(v):,}"
        if flt: errs.append(f"unknown filter {flt}")
        return str(v)
    return TOKEN.sub(sub, text)

lim, banned = help_["limits"], [w.lower() for w in help_["banned_words"]]
seen = set()
for e in help_["entries"]:
    i = e["id"]
    if i in seen: errs.append(f"duplicate id {i}")
    seen.add(i)
    if e["pattern"] not in ("tooltip", "popover", "helper"): errs.append(f"{i}: bad pattern")
    for s in e["screens"]:
        if s not in SCREENS: errs.append(f"{i}: unknown screen {s}")
    if "text_ref" in e:
        try: text = resolve(e["text_ref"])
        except Exception: errs.append(f"{i}: text_ref unresolved"); continue
    else: text = e.get("text", "")
    if not text: errs.append(f"{i}: empty text"); continue
    out = render(text, e.get("value_tokens", []))
    n = words(out)
    if n > lim[e["pattern"] + "_max_words"]: errs.append(f"{i}: {n} words exceeds limit")
    low = out.lower()
    for w in banned:
        if re.search(r"\b" + re.escape(w) + r"\b", low): errs.append(f"{i}: banned word '{w}'")
    for t in forb:
        if t in low: errs.append(f"{i}: forbidden term '{t}'")
    if "see_more" in e and e["see_more"]["target_screen"] not in SCREENS: errs.append(f"{i}: see_more screen")
req_ids = {r["id"] for r in help_["required_visible_text"]}
for need in ["boundary.sentence","readiness.not_approval","enrollment.no_prerequisites","projection.line","lender.decides","requirements.illustrative","reliance.caption","export.note"]:
    if need not in req_ids: errs.append(f"missing required visible text {need}")
for r in help_["required_visible_text"]:
    for s in r["must_appear_on"]:
        if s not in SCREENS: errs.append(f"{r['id']}: unknown screen {s}")
need_help = (["state."+x for x in ["none","asserted","supported","verified","disputed","stale"]] +
  ["req."+x for x in meta["requirement_states"]] + ["monitoring."+x for x in meta["monitoring_states"]] +
  ["dispute.reason."+x for x in meta["dispute_reason_codes"]] if "dispute_reason_codes" in meta else
  ["state."+x for x in ["none","asserted","supported","verified","disputed","stale"]] +
  ["req."+x for x in meta["requirement_states"]] + ["monitoring."+x for x in meta["monitoring_states"]])
for n_ in need_help:
    if n_ not in seen: errs.append(f"missing help entry {n_}")
for d in dests["destinations"]:
    if "destination."+d["id"] not in seen: errs.append(f"missing destination.{d['id']}")
    for c in d.get("covenants", []):
        if "covenant."+c["id"] not in seen: errs.append(f"missing covenant.{c['id']}")
for c in inter["classes"]:
    if "intervention."+c not in seen: errs.append(f"missing intervention.{c}")
ids = set()
for s in tours["steps"]:
    k = (s["tour_id"], s["step_id"])
    if k in ids: errs.append(f"duplicate tour step {k}")
    ids.add(k)
    if s["tour_id"] not in ("bank", "nabii"): errs.append(f"{k}: bad tour")
    if s["expected_screen"] not in SCREENS: errs.append(f"{k}: unknown screen")
    if words(s["text"]) > help_["limits"]["tour_max_words"]: errs.append(f"{k}: too long")
    low = s["text"].lower()
    for w in banned:
        if re.search(r"\b" + re.escape(w) + r"\b", low): errs.append(f"{k}: banned word '{w}'")
    for t in forb:
        if t in low: errs.append(f"{k}: forbidden term '{t}'")
if errs:
    print("PROBLEMS:"); [print(" -", e) for e in errs]; sys.exit(1)
print(f"OK: {len(help_['entries'])} help entries, {len(tours['steps'])} tour steps, {len(help_['required_visible_text'])} required visible texts.")
