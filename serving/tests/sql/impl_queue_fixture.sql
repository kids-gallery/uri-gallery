-- 시험 전용 대역: 큐 보완 S1~S4(data-model §6). 정본은 B의 db/migrations/0100_impl_queue.sql(T014).
-- T014가 들어오면 conftest가 그 파일을 먼저 찾아 쓰고, 이 파일은 지운다.
ALTER TABLE stage_job
  ADD COLUMN IF NOT EXISTS available_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  ADD COLUMN IF NOT EXISTS priority SMALLINT NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS evaluation_id BIGINT NULL,
  ADD COLUMN IF NOT EXISTS eval_item_id BIGINT NULL;
CREATE INDEX IF NOT EXISTS ix_sj_claim ON stage_job (serving_group, status, available_at, priority, queued_at);
ALTER TABLE stage_job DROP CONSTRAINT IF EXISTS chk_sj_origin;
ALTER TABLE stage_job ADD CONSTRAINT chk_sj_origin
  CHECK (origin IN ('intake','confirm','use_lower','downgrade','caption','eval'));
-- S3 CHECK는 MariaDB에서 거부된다(ERROR 1901: artwork_id가 ON DELETE SET NULL FK). 트리거로 옮긴다 — T014에 전달
ALTER TABLE external_job
  ADD COLUMN IF NOT EXISTS claimed_by VARCHAR(60) NULL,
  ADD COLUMN IF NOT EXISTS claim_expires_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS available_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP());

DELIMITER //
CREATE OR REPLACE TRIGGER trg_stage_job_bi BEFORE INSERT ON stage_job FOR EACH ROW
BEGIN
  IF NEW.origin = 'eval' AND (NEW.artwork_id IS NOT NULL OR NEW.evaluation_id IS NULL) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'S3 eval_job_shape';
  END IF;
  IF NEW.origin <> 'eval' AND NEW.model_version_id IS NOT NULL AND
     (SELECT release_state FROM model_version WHERE version_id = NEW.model_version_id) <> 'active' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'BR-MDL-07 version_not_active';
  END IF;
  IF NEW.artwork_id IS NOT NULL AND (SELECT status FROM artwork WHERE artwork_id = NEW.artwork_id) = 'deleting' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'BR-DEL-01 new_job_blocked';
  END IF;
END//
DELIMITER ;
