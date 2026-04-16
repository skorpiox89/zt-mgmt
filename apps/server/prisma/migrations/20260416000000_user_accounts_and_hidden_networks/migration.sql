-- AlterTable
ALTER TABLE `admin_users`
    ADD COLUMN `role` ENUM('ADMIN', 'USER') NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE `user_hidden_networks` (
    `user_id` INTEGER NOT NULL,
    `controller_id` INTEGER NOT NULL,
    `network_id` VARCHAR(32) NOT NULL,

    PRIMARY KEY (`user_id`, `controller_id`, `network_id`),
    CONSTRAINT `user_hidden_networks_user_id_fkey`
        FOREIGN KEY (`user_id`) REFERENCES `admin_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
