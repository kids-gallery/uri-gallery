"""결과 기록 공통 — 저장소 확정 + stored_object INSERT."""
from __future__ import annotations

from pathlib import Path

from common.storage import LocalStorage

EXT = {"mask": "png", "cutout": "png", "joints": "json", "depth": "png",
       "result_animated": "mp4", "result_relief": "png", "result_glb": "glb"}


def store_output(cur, storage: LocalStorage, ctx, kind: str, tmp_path: str) -> int:
    """tmp 파일을 가족 영역으로 옮기고 stored_object 행을 만든다."""
    prefix = LocalStorage.artwork_prefix(ctx.original_key)
    key = LocalStorage.new_key(prefix, kind, EXT.get(kind, Path(tmp_path).suffix.lstrip(".") or "bin"))
    storage.promote(Path(tmp_path), key)
    cur.execute("""INSERT INTO stored_object (owner_kind, family_id, artwork_id, object_kind, object_key)
                   VALUES ('family', %s, %s, %s, %s)""", (ctx.family_id, ctx.artwork_id, kind, key))
    return cur.lastrowid


def open_judge(cur, artwork_id: int) -> None:
    """split이 끝나면(성공·낮춤·소진 모두) judge를 연다(stage-job §2)."""
    cur.execute("""UPDATE stage_job SET available_at = UTC_TIMESTAMP()
                    WHERE artwork_id = %s AND stage_kind = 'judge' AND status IN ('queued','retry_wait')
                      AND available_at > UTC_TIMESTAMP()""", (artwork_id,))


def upsert_outcome(cur, artwork_id: int, **cols) -> None:
    names = ", ".join(cols)
    ph = ", ".join(["%s"] * len(cols))
    upd = ", ".join(f"{k} = VALUES({k})" for k in cols)
    cur.execute(f"INSERT INTO artwork_outcome (artwork_id, {names}) VALUES (%s, {ph}) "
                f"ON DUPLICATE KEY UPDATE {upd}", (artwork_id, *cols.values()))


def active_version(cur, model_id: str) -> dict | None:
    cur.execute("""SELECT version_id, version_label, license_confirmed, exec_device, runtime
                     FROM model_version WHERE model_id = %s AND release_state = 'active'""", (model_id,))
    return cur.fetchone()
