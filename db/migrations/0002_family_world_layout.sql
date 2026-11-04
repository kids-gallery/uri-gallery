-- 가족별 전시실 설정. 삭제된 가족의 설정도 함께 삭제한다.
CREATE TABLE IF NOT EXISTS family_world_layout (
  family_id BIGINT NOT NULL PRIMARY KEY,
  revision INT UNSIGNED NOT NULL DEFAULT 0,
  rooms_json JSON NOT NULL,
  decor_json JSON NOT NULL,
  CONSTRAINT fk_world_layout_family FOREIGN KEY (family_id) REFERENCES family(family_id) ON DELETE CASCADE
);
