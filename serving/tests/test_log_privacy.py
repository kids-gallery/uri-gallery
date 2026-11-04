from common.logging import _allowlist
import json
def test_raw_values_do_not_copy_private_text():
    for secret in ["child@example.test", "a"*64, "/family/private/photo.jpg", "아이별칭"]:
        out=_allowlist(None,None,{k:secret for k in ["event","worker","model_id","version_label","diagnostic","outcome","status","ts","duration_ms","error_class"]})
        assert secret not in json.dumps(out,ensure_ascii=False)
def test_reviewed_categories_survive():
    out=_allowlist(None,None,{"event":"job_end","worker":"cpu_vision@host:7","job_id":12,"stage_kind":"split","error_class":"storage","duration_ms":1})
    assert out=={"event":"job_end","worker":"cpu_vision","job_id":12,"stage_kind":"split","error_class":"storage","duration_ms":1}
