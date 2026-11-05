-- Run automatically by the server on start (every statement is idempotent).
-- Must stay in sync with MechanicDbContext; SchemaTests checks every table and column is here.

CREATE TABLE IF NOT EXISTS `mechanic_stock` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `garage_id` VARCHAR(64) NOT NULL,
  `item_id` VARCHAR(64) NOT NULL,
  `quantity` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_mechanic_stock_garage_item` (`garage_id`, `item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `mechanic_repairs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `garage_id` VARCHAR(64) NOT NULL,
  `plate` VARCHAR(16) NOT NULL,
  `part_id` VARCHAR(64) NOT NULL,
  `mechanic_identifier` VARCHAR(64) NOT NULL,
  `mechanic_name` VARCHAR(64) NOT NULL,
  `repaired_at` DATETIME(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_mechanic_repairs_plate` (`plate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
