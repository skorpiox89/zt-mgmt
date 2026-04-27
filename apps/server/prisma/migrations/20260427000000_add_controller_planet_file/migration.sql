ALTER TABLE `controllers`
  ADD COLUMN `planet_file_content` MEDIUMBLOB NULL,
  ADD COLUMN `planet_file_size` INTEGER NULL,
  ADD COLUMN `planet_file_uploaded_at` DATETIME(3) NULL;
