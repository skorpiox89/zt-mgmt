ALTER TABLE `controllers`
  ADD COLUMN `planet_download_token` VARCHAR(64) NULL;

CREATE UNIQUE INDEX `controllers_planet_download_token_key`
  ON `controllers`(`planet_download_token`);
