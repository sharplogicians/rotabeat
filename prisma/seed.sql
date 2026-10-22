-- Initial Seed Data for RotaFlow (app-desk.com/rota_v2)
-- Execute this in phpMyAdmin or MySQL CLI after running schema.sql

-- 1. Create Business Owner Account (Aisha Khan)
-- Default Password: Qwertyuiop@123
INSERT INTO `User` (`id`, `firstName`, `lastName`, `name`, `email`, `username`, `passwordHash`, `role`, `status`, `avatarInitials`, `sessionVersion`, `createdAt`, `updatedAt`)
VALUES ('user-aisha', 'Aisha', 'Khan', 'Aisha Khan', 'aisha.khan@northerntable.co.uk', 'aishakhan', '$2b$10$G34I2eBDvlwP4ZUgDNTwjursed4Z6pcYvCZ0doB6KI0aotVqb4LxW', 'business_owner', 'active', 'AK', 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE `passwordHash` = VALUES(`passwordHash`);

-- 2. Create Initial Locations
INSERT INTO `Location` (`id`, `businessOwnerId`, `managerId`, `name`, `town`, `address`, `city`, `postalCode`, `country`, `phone`, `email`, `timeZone`, `weekStart`, `status`, `createdAt`, `updatedAt`)
VALUES 
('site-bright', 'user-aisha', NULL, 'Bride Leeds Cafe', 'Leeds', '14 Boar Lane, Leeds, LS1 5EL', 'Leeds', 'LS1 5EL', 'UK', '+44 113 234 5678', 'bright.leeds@northerntable.co.uk', 'Europe/London', 'monday', 'active', NOW(), NOW()),
('site-riverside', 'user-aisha', NULL, 'Riverside Kitchen', 'York', '8 Coney Street, York, YO1 9QL', 'York', 'YO1 9QL', 'UK', '+44 190 456 7890', 'riverside.york@northerntable.co.uk', 'Europe/London', 'monday', 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 3. Create Default Organization Settings
INSERT INTO `OrgSettings` (`id`, `orgName`, `timeZone`, `weekStart`, `defaultPayPeriod`, `earlyClockInMinutes`, `lateThresholdMinutes`, `rounding`, `breaksClocked`, `duplicateActionPrevention`, `overtimeEnabled`, `weeklyOvertimeThreshold`, `weeklyApprovalEmailReminder`)
VALUES ('default', 'Northern Table Group', 'Europe/London', 'monday', 'weekly', 15, 5, 'exact', 1, 1, 1, 40, 1)
ON DUPLICATE KEY UPDATE `orgName` = VALUES(`orgName`);
