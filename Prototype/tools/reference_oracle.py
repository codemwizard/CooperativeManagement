#!/usr/bin/env python3
"""
Reference oracle for the Symphony prototype computation rules.

PURPOSE: cross-check the seed data and tests/expected-results.json.
It is NOT the application engine. Implement the real engine in the app's own
language, then make it agree with tests/expected-results.json.

Usage (from the kit root):
    python3 tools/reference_oracle.py            # check all cases against expected-results.json
    python3 tools/reference_oracle.py --dump     # print computed results as JSON
"""
import json, sys, copy, os
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RANK = {"none": 0, "asserted": 1, "supported": 2, "verified": 3}


def load(name):
    with open(os.path.join(ROOT, name)) as f:
        return json.load(f)


def effective_state(item, demo_date):
    """Return (state, level). state in none|asserted|supported|verified|disputed|stale."""
    if item is None:
        return "none", "none"
    if item.get("disputed"):
        return "disputed", item["level"]
    vu = item.get("valid_until")
    if vu and demo_date > date.fromisoformat(vu):
        return "stale", item["level"]
    return item["level"], item["level"]


def applies(cond, case):
    if not cond:
        return True
    field = cond["field"].split(".")
    cur = case
    for part in field:
        cur = cur[part]
    return cur == cond["equals"]


def eval_requirement(req, case, demo_date):
    out = {"id": req["id"], "title": req["title"], "state": None, "evidence_ref": None,
           "effective_level": None, "min_level": None, "provided_early": False, "reason": None}
    if not applies(req.get("applies_when"), case):
        out["state"] = "not_applicable"
        out["reason"] = req.get("why") or "Applicability rule excludes it"
        return out
    rule = req["rule"]
    kind = rule["kind"]
    if kind in ("evidence", "evidence_count"):
        item = case["evidence"].get(rule["evidence_type"])
        state, level = effective_state(item, demo_date)
        out["evidence_ref"] = rule["evidence_type"] if item else None
        out["effective_level"] = state if state in ("disputed", "stale") else level
        out["min_level"] = rule["min_level"]
        if state in ("disputed", "stale"):
            out["state"] = "exception"
            out["reason"] = f"Evidence is {state}"
            return out
        ok = RANK[level] >= RANK[rule["min_level"]]
        if kind == "evidence_count" and ok:
            ok = item.get(rule["count_field"], 0) >= rule["min_count"]
            if not ok:
                out["reason"] = f"{rule['count_field']} below {rule['min_count']}"
        out["state"] = "satisfied" if ok else "unresolved"
        return out
    if kind == "assessment_time":
        item = case["evidence"].get(rule["evidence_type"])
        out["state"] = "assessment_time"
        if item:
            state, level = effective_state(item, demo_date)
            out["evidence_ref"] = rule["evidence_type"]
            out["effective_level"] = state if state in ("disputed", "stale") else level
            out["provided_early"] = True
        return out
    if kind == "fit":
        r = case["project"]["request"]
        if rule["check"] == "single_request":
            ok = (r["structure"] == "single"
                  and rule["min_amount"] <= r["amount"] <= rule["max_amount"]
                  and 0 < r["term_months"] <= rule["max_term_months"])
        else:
            ok = (r["structure"] == "per_group"
                  and rule["min_amount"] <= r["amount_per_group"] <= rule["max_amount"]
                  and rule["min_term_months"] <= r["term_months"] <= rule["max_term_months"])
        out["state"] = "satisfied" if ok else "unresolved"
        out["reason"] = None if ok else "Request outside product range or structure"
        return out
    raise ValueError(kind)


def evaluate(case, dest, demo_date):
    reqs = [eval_requirement(r, case, demo_date) for r in dest["requirements"]]
    by = lambda s: [r["id"] for r in reqs if r["state"] == s]
    summary = {
        "ready": not by("unresolved") and not by("exception"),
        "unresolved": by("unresolved"),
        "exceptions": by("exception"),
        "not_applicable": by("not_applicable"),
        "assessment_time": by("assessment_time"),
        "satisfied": len(by("satisfied")),
        "total": len(reqs),
    }
    return {"destination_id": dest["id"], "requirements": reqs, "summary": summary}


def monitoring_state(case, demo_date, window):
    fin = case.get("financing")
    if not fin:
        return None
    worst = "current"
    for c in fin["covenants"]:
        if c["received"]:
            continue
        remaining = (date.fromisoformat(c["due_date"]) - demo_date).days
        if remaining < 0:
            return "overdue"
        if remaining <= window:
            worst = "due"
    return worst


def check_data_integrity(cases):
    problems = []
    for c in cases:
        for t, item in c["evidence"].items():
            if item["level"] in ("supported", "verified") and not item.get("limitation"):
                problems.append(f"{c['id']}.{t}: missing limitation")
            if item["level"] == "verified":
                if not item.get("verified_by"):
                    problems.append(f"{c['id']}.{t}: verified without verifier")
                elif item["verified_by"] == item["supplied_by"]:
                    problems.append(f"{c['id']}.{t}: self-verified")
    return problems


def main():
    meta = load("data/meta.json")
    dests = {d["id"]: d for d in load("data/destinations.json")["destinations"]}
    cases = load("data/cases.json")["cases"]
    demo = date.fromisoformat(meta["demo_date"])
    results = {c["id"]: {d: evaluate(c, dests[d], demo) for d in dests} for c in cases}

    if "--dump" in sys.argv:
        print(json.dumps(results, indent=2))
        return 0

    problems = check_data_integrity(cases)
    expected = load("tests/expected-results.json")["expected"]
    for cid, per_dest in expected.items():
        for did, exp in per_dest.items():
            got = results[cid][did]["summary"]
            for key in ("ready", "unresolved", "exceptions", "not_applicable", "assessment_time"):
                if got[key] != exp[key]:
                    problems.append(f"{cid}/{did}.{key}: expected {exp[key]} got {got[key]}")
            if "satisfied" in exp and got["satisfied"] != exp["satisfied"]:
                problems.append(f"{cid}/{did}.satisfied: expected {exp['satisfied']} got {got['satisfied']}")
    mon = load("tests/expected-results.json")["expected_monitoring"]
    w = meta["monitoring_due_window_days"]
    for cid, exp in mon.items():
        case = next(c for c in cases if c["id"] == cid)
        got = monitoring_state(case, demo, w)
        if got != exp:
            problems.append(f"monitoring {cid}: expected {exp} got {got}")

    if problems:
        print("MISMATCHES:")
        for p in problems:
            print(" -", p)
        return 1
    print(f"OK: {len(cases)} cases x {len(dests)} destinations match expected-results.json; data integrity clean.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
