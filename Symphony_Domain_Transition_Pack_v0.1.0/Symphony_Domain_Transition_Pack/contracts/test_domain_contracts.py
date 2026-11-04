"""Executable reference-oracle contracts; stdlib only."""
from dataclasses import dataclass, field
import unittest

@dataclass
class S:
    enrollment: str="draft"
    authority: bool=False
    certificate_officers: list=field(default_factory=list)
    appointments: list=field(default_factory=list)
    bylaw_effective: bool=False
    minutes: list=field(default_factory=list)
    resolutions: list=field(default_factory=list)
    evidence: list=field(default_factory=list)
    findings: list=field(default_factory=list)
    disputes: list=field(default_factory=list)
    events: list=field(default_factory=list)
    outbox: list=field(default_factory=list)
    receipts: dict=field(default_factory=dict)
    version: int=0
    validation_runs: list=field(default_factory=list)

def emit(s, name, payload, key=None):
    if key and key in s.receipts:
        old_payload, result=s.receipts[key]
        if old_payload != repr(payload): raise ValueError("IDEMPOTENCY_PAYLOAD_MISMATCH")
        return result
    eid=f"e{len(s.events)+1}"
    s.events.append({"id":eid,"type":name,"payload":payload})
    s.outbox.append({"event_id":eid,"topic":name})
    s.version+=1
    result={"event_id":eid,"version":s.version}
    if key: s.receipts[key]=(repr(payload),result)
    return result

def handover(s, authority):
    if not authority: raise ValueError("AUTHORITY_REQUIRED")
    s.authority=True; s.enrollment="active"; emit(s,"enrollment.handover_accepted",{})

def appoint(s, person, position, source, start, end=None, exclusive=True, replace_current=False):
    if not source: raise ValueError("APPOINTMENT_SOURCE_REQUIRED")
    for a in s.appointments:
        if exclusive and a["position"]==position and a["status"]=="active":
            if replace_current and a["start"] < start:
                a["end"] = (start[:4] + "-" + start[5:7] + "-" + start[8:10])
                a["status"] = "terminated"
                continue
            if start <= (a["end"] or "9999-12-31") and a["start"] <= (end or "9999-12-31"):
                raise ValueError("EXCLUSIVE_APPOINTMENT_OVERLAP")
    row={"person":person,"position":position,"source":source,"start":start,"end":end,"exclusive":exclusive,"status":"active"}
    s.appointments.append(row); emit(s,"appointment.activated",row)


def check_tenant(expected_tenant, referenced_tenant):
    if expected_tenant != referenced_tenant: raise ValueError("CROSS_TENANT_REFERENCE")


def check_version(expected, actual):
    if expected != actual: raise ValueError("STALE_AGGREGATE_VERSION")


def authorize(role, action):
    read_only = {"pfi_analyst", "pfi_credit", "ta_observer", "verifier_readonly"}
    if action == "mutate_cooperative_source" and role in read_only:
        raise ValueError("READ_ONLY_ROLE")

def bylaw_effective(s, proof):
    if not proof: raise ValueError("REGISTRATION_EVIDENCE_REQUIRED")
    s.bylaw_effective=True; emit(s,"bylaw.version_effective",{})

def minutes(s, content):
    row={"version":len(s.minutes)+1,"content":content,"status":"submitted"}
    s.minutes.append(row); emit(s,"minutes.version_submitted",row.copy()); return row

def approve(s, n):
    v=next(x for x in s.minutes if x["version"]==n); v["status"]="approved"
    emit(s,"minutes.version_approved",{"version":n})

def resolution(s,n,conditions):
    v=next(x for x in s.minutes if x["version"]==n)
    if v["status"]!="approved": raise ValueError("APPROVED_MINUTES_REQUIRED")
    row={"minutes_version":n,"status":"effective" if conditions else "adopted"}
    s.resolutions.append(row); emit(s,"resolution."+row["status"],row); return row

def evidence(s,supplier,content):
    row={"id":f"v{len(s.evidence)+1}","supplier":supplier,"content":content,"verification":None,"admission":None}
    s.evidence.append(row); emit(s,"evidence.version_submitted",{"id":row["id"]}); return row

def verify(s,v,actor):
    if v["supplier"]==actor: raise ValueError("SELF_VERIFICATION")
    f={"evidence_id":v["id"],"result":"verified_conformant"}
    s.findings.append(f); v["verification"]=f["result"]; emit(s,"verification.finding_recorded",f)

def admit(s,v):
    v["admission"]="accepted"; emit(s,"evidence.version_admitted",{"id":v["id"]})

def dispute(s,v):
    d={"evidence_id":v["id"],"status":"open"}; s.disputes.append(d); emit(s,"evidence.dispute_raised",d)

def rely(s,v):
    if any(d["evidence_id"]==v["id"] and d["status"]=="open" for d in s.disputes): return False
    return v["verification"]=="verified_conformant"

class DomainContracts(unittest.TestCase):
    def test_SC001_self_enroller_cannot_handover_without_authority(self):
        s=S()
        with self.assertRaisesRegex(ValueError,"AUTHORITY_REQUIRED"): handover(s,False)
        self.assertEqual(s.enrollment,"draft")
    def test_SC002_appointment_requires_source(self):
        with self.assertRaisesRegex(ValueError,"APPOINTMENT_SOURCE_REQUIRED"): appoint(S(),"p","chair",None,"2026-01-01")
    def test_SC003_certificate_officers_not_current_appointments(self):
        s=S(); s.certificate_officers=["old chair"]; self.assertEqual(s.appointments,[])
    def test_SC004_replacement_preserves_history(self):
        s=S(); appoint(s,"p1","chair","agm1","2025-01-01")
        appoint(s,"p2","chair","agm2","2026-01-01",replace_current=True)
        self.assertEqual(len(s.appointments),2); self.assertEqual(s.appointments[0]["end"],"2026-01-01")
        self.assertEqual(s.appointments[0]["status"],"terminated")
    def test_SC005_overlapping_exclusive_appointments_rejected(self):
        s=S(); appoint(s,"p1","chair","agm1","2026-01-01")
        with self.assertRaisesRegex(ValueError,"EXCLUSIVE_APPOINTMENT_OVERLAP"): appoint(s,"p2","chair","agm2","2026-02-01")
    def test_SC006_bylaw_effectiveness_requires_proof(self):
        s=S()
        with self.assertRaisesRegex(ValueError,"REGISTRATION_EVIDENCE_REQUIRED"): bylaw_effective(s,False)
        self.assertFalse(s.bylaw_effective)
    def test_SC007_minutes_correction_creates_version(self):
        s=S(); a=minutes(s,"original"); b=minutes(s,"corrected")
        self.assertEqual((a["version"],b["version"]),(1,2)); self.assertEqual(s.minutes[0]["content"],"original")
    def test_SC008_resolution_requires_approved_minutes(self):
        s=S(); minutes(s,"draft")
        with self.assertRaisesRegex(ValueError,"APPROVED_MINUTES_REQUIRED"): resolution(s,1,True)
        approve(s,1); self.assertEqual(resolution(s,1,False)["status"],"adopted")
    def test_SC009_new_evidence_has_no_inherited_verification(self):
        s=S(); a=evidence(s,"supplier","v1"); verify(s,a,"verifier"); b=evidence(s,"supplier","v2")
        self.assertIsNone(b["verification"])
    def test_SC010_supplier_cannot_verify_own_evidence(self):
        s=S(); a=evidence(s,"u1","v1")
        with self.assertRaisesRegex(ValueError,"SELF_VERIFICATION"): verify(s,a,"u1")
    def test_SC011_finding_is_exact_version(self):
        s=S(); a=evidence(s,"u1","a"); b=evidence(s,"u1","b"); verify(s,a,"u2")
        self.assertEqual(s.findings[0]["evidence_id"],a["id"]); self.assertIsNone(b["verification"])
    def test_SC012_admission_is_not_verification(self):
        s=S(); a=evidence(s,"u1","a"); admit(s,a)
        self.assertEqual(a["admission"],"accepted"); self.assertIsNone(a["verification"])
    def test_SC013_open_dispute_blocks_unqualified_reliance(self):
        s=S(); a=evidence(s,"u1","a"); verify(s,a,"u2"); dispute(s,a); self.assertFalse(rely(s,a))
    def test_SC014_validation_run_is_snapshot(self):
        s=S(); s.validation_runs.append({"id":"1","outcome":"unresolved"}); s.validation_runs.append({"id":"2","outcome":"satisfied"})
        self.assertEqual(s.validation_runs[0]["outcome"],"unresolved")
    def test_SC015_cross_tenant_reference_rejected(self):
        with self.assertRaisesRegex(ValueError,"CROSS_TENANT_REFERENCE"): check_tenant("tenant-A","tenant-B")
    def test_SC016_idempotent_replay_does_not_duplicate_event(self):
        s=S(); a=emit(s,"cooperative.created",{"name":"x"},"k"); b=emit(s,"cooperative.created",{"name":"x"},"k")
        self.assertEqual(a,b); self.assertEqual(len(s.events),1)
        with self.assertRaisesRegex(ValueError,"IDEMPOTENCY_PAYLOAD_MISMATCH"): emit(s,"cooperative.created",{"name":"y"},"k")
    def test_SC017_stale_expected_version_rejected(self):
        s=S(); expected=s.version; emit(s,"x",{})
        with self.assertRaisesRegex(ValueError,"STALE_AGGREGATE_VERSION"): check_version(expected,s.version)
    def test_SC018_event_and_outbox_emitted_together(self):
        s=S(); emit(s,"x",{}); self.assertEqual(s.events[0]["id"],s.outbox[0]["event_id"])
    def test_SC019_read_only_institutional_role_cannot_mutate(self):
        with self.assertRaisesRegex(ValueError,"READ_ONLY_ROLE"): authorize("pfi_analyst","mutate_cooperative_source")
    def test_SC020_unknown_vacancy_does_not_claim_compliance(self):
        p={"requirement":"unknown","filled":False,"validation":"unresolved"}
        self.assertEqual(p["validation"],"unresolved"); self.assertFalse(p["filled"])

if __name__=="__main__": unittest.main()
