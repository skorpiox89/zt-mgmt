CREATE TABLE `test_machines` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `host` VARCHAR(255) NOT NULL,
    `port` INTEGER NOT NULL DEFAULT 22,
    `username` VARCHAR(100) NOT NULL,
    `password_enc` TEXT NOT NULL,
    `remark` VARCHAR(255) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `status` ENUM('UNKNOWN', 'ONLINE', 'OFFLINE') NOT NULL DEFAULT 'UNKNOWN',
    `last_checked_at` DATETIME(3) NULL,
    `switch_status` ENUM('IDLE', 'RUNNING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'IDLE',
    `last_switch_at` DATETIME(3) NULL,
    `last_switch_message` VARCHAR(255) NULL,
    `current_controller_id` INTEGER NULL,
    `current_network_id` VARCHAR(32) NULL,
    `current_network_name` VARCHAR(120) NULL,
    `current_node_id` VARCHAR(32) NULL,
    `current_member_id` VARCHAR(32) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `test_machines_name_key`(`name`),
    PRIMARY KEY (`id`)
);

CREATE TABLE `test_machine_switch_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `machine_id` INTEGER NOT NULL,
    `operator_user_id` INTEGER NOT NULL,
    `target_controller_id` INTEGER NOT NULL,
    `target_network_id` VARCHAR(32) NOT NULL,
    `target_network_name` VARCHAR(120) NULL,
    `node_id` VARCHAR(32) NULL,
    `member_id` VARCHAR(32) NULL,
    `status` ENUM('IDLE', 'RUNNING', 'SUCCESS', 'FAILED') NOT NULL,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finished_at` DATETIME(3) NULL,
    `summary` VARCHAR(255) NULL,
    `detail_log` LONGTEXT NULL,

    INDEX `test_machine_switch_logs_machine_id_started_at_idx`(`machine_id`, `started_at`),
    PRIMARY KEY (`id`),
    CONSTRAINT `test_machine_switch_logs_machine_id_fkey`
      FOREIGN KEY (`machine_id`) REFERENCES `test_machines`(`id`)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `test_machine_switch_logs_operator_user_id_fkey`
      FOREIGN KEY (`operator_user_id`) REFERENCES `admin_users`(`id`)
      ON DELETE RESTRICT ON UPDATE CASCADE
);
