ALTER TABLE `test_machines`
  ADD COLUMN `zerotier_service_status` ENUM('UNKNOWN', 'NOT_INSTALLED', 'RUNNING', 'STOPPED') NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN `last_zerotier_checked_at` DATETIME(3) NULL;
