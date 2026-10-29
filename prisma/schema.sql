-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(191) NULL,
    `role` ENUM('business_owner', 'head_office', 'manager', 'kiosk') NOT NULL DEFAULT 'business_owner',
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `avatarInitials` VARCHAR(191) NOT NULL DEFAULT 'BO',
    `sessionVersion` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Location` (
    `id` VARCHAR(191) NOT NULL,
    `businessOwnerId` VARCHAR(191) NOT NULL,
    `managerId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `town` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL DEFAULT 'UK',
    `postalCode` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `timeZone` VARCHAR(191) NOT NULL DEFAULT 'Europe/London',
    `weekStart` VARCHAR(191) NOT NULL DEFAULT 'monday',
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Location_managerId_key`(`managerId`),
    INDEX `Location_businessOwnerId_idx`(`businessOwnerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KioskDevice` (
    `id` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `registeredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastActiveAt` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `registrationCode` VARCHAR(191) NULL,
    `codeExpiresAt` DATETIME(3) NULL,

    INDEX `KioskDevice_locationId_idx`(`locationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Employee` (
    `id` VARCHAR(191) NOT NULL,
    `employeeNumber` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `jobTitle` VARCHAR(191) NOT NULL,
    `primarySiteId` VARCHAR(191) NOT NULL,
    `managerId` VARCHAR(191) NULL,
    `payType` ENUM('hourly', 'salaried') NOT NULL DEFAULT 'hourly',
    `hourlyRate` DOUBLE NULL,
    `salaryAnnual` DOUBLE NULL,
    `startDate` VARCHAR(191) NOT NULL,
    `status` ENUM('active', 'inactive', 'left') NOT NULL DEFAULT 'active',
    `leavingDate` VARCHAR(191) NULL,
    `leavingReason` VARCHAR(191) NULL,
    `pinSet` BOOLEAN NOT NULL DEFAULT true,
    `pinHash` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Employee_employeeNumber_key`(`employeeNumber`),
    UNIQUE INDEX `Employee_email_key`(`email`),
    INDEX `Employee_primarySiteId_idx`(`primarySiteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Shift` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `date` VARCHAR(191) NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL,
    `unpaidBreakMinutes` INTEGER NOT NULL DEFAULT 30,
    `role` VARCHAR(191) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Shift_siteId_idx`(`siteId`),
    INDEX `Shift_employeeId_idx`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Rota` (
    `id` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `weekStart` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `publishedAt` DATETIME(3) NULL,
    `lockedAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Rota_siteId_idx`(`siteId`),
    UNIQUE INDEX `Rota_siteId_weekStart_key`(`siteId`, `weekStart`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttendanceRecord` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `date` VARCHAR(191) NOT NULL,
    `shiftId` VARCHAR(191) NULL,
    `scheduledStartTime` VARCHAR(191) NULL,
    `scheduledEndTime` VARCHAR(191) NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'clock_event',
    `grossMinutes` INTEGER NOT NULL DEFAULT 0,
    `totalBreakMinutes` INTEGER NOT NULL DEFAULT 0,
    `workedMinutes` INTEGER NOT NULL DEFAULT 0,
    `exceptionsJson` VARCHAR(191) NOT NULL DEFAULT '[]',
    `status` ENUM('normal', 'exception', 'corrected', 'reviewed') NOT NULL DEFAULT 'normal',
    `correctionReason` VARCHAR(191) NULL,
    `correctedBy` VARCHAR(191) NULL,
    `correctedAt` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AttendanceRecord_siteId_idx`(`siteId`),
    INDEX `AttendanceRecord_employeeId_idx`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttendanceAudit` (
    `id` VARCHAR(191) NOT NULL,
    `attendanceRecordId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `changedBy` VARCHAR(191) NOT NULL,
    `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `action` VARCHAR(191) NOT NULL,
    `changesJson` TEXT NOT NULL,
    `reason` TEXT NOT NULL,

    INDEX `AttendanceAudit_attendanceRecordId_idx`(`attendanceRecordId`),
    INDEX `AttendanceAudit_employeeId_idx`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClockEvent` (
    `id` VARCHAR(191) NOT NULL,
    `attendanceRecordId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `timestamp` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'kiosk',
    `deviceId` VARCHAR(191) NULL,

    INDEX `ClockEvent_attendanceRecordId_idx`(`attendanceRecordId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WeeklyApproval` (
    `id` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `weekStart` VARCHAR(191) NOT NULL,
    `status` ENUM('open', 'under_review', 'approved', 'exported') NOT NULL DEFAULT 'open',
    `reviewedEmployeeIds` VARCHAR(191) NOT NULL DEFAULT '[]',
    `ownerReviewedEmployeeIds` VARCHAR(191) NOT NULL DEFAULT '[]',
    `managerApprovedBy` VARCHAR(191) NULL,
    `managerApprovedAt` VARCHAR(191) NULL,
    `approvedBy` VARCHAR(191) NULL,
    `approvedAt` VARCHAR(191) NULL,
    `reopenedReason` VARCHAR(191) NULL,
    `reopenedBy` VARCHAR(191) NULL,
    `reopenedAt` VARCHAR(191) NULL,
    `lastUpdatedBy` VARCHAR(191) NOT NULL,
    `lastUpdatedAt` VARCHAR(191) NOT NULL,

    INDEX `WeeklyApproval_siteId_idx`(`siteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PayrollExport` (
    `id` VARCHAR(191) NOT NULL,
    `payPeriodLabel` VARCHAR(191) NOT NULL,
    `weekStart` VARCHAR(191) NOT NULL,
    `siteIdsJson` VARCHAR(191) NOT NULL DEFAULT '[]',
    `employeeCount` INTEGER NOT NULL,
    `totalPayableHours` DOUBLE NOT NULL,
    `generatedBy` VARCHAR(191) NOT NULL,
    `generatedAt` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'completed',
    `csvData` TEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditEvent` (
    `id` VARCHAR(191) NOT NULL,
    `timestamp` VARCHAR(191) NOT NULL,
    `userName` VARCHAR(191) NOT NULL,
    `role` ENUM('business_owner', 'head_office', 'manager', 'kiosk') NOT NULL,
    `siteId` VARCHAR(191) NULL,
    `entity` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `previousValue` TEXT NULL,
    `newValue` TEXT NULL,
    `reason` VARCHAR(191) NULL,
    `source` VARCHAR(191) NOT NULL,

    INDEX `AuditEvent_siteId_idx`(`siteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrgSettings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default',
    `timeZone` VARCHAR(191) NOT NULL DEFAULT 'Europe/London',
    `weekStart` VARCHAR(191) NOT NULL DEFAULT 'monday',
    `defaultPayPeriod` VARCHAR(191) NOT NULL DEFAULT 'weekly',
    `earlyClockInMinutes` INTEGER NOT NULL DEFAULT 15,
    `lateThresholdMinutes` INTEGER NOT NULL DEFAULT 5,
    `rounding` VARCHAR(191) NOT NULL DEFAULT 'exact',
    `breaksClocked` BOOLEAN NOT NULL DEFAULT true,
    `duplicateActionPrevention` BOOLEAN NOT NULL DEFAULT true,
    `overtimeEnabled` BOOLEAN NOT NULL DEFAULT true,
    `weeklyOvertimeThreshold` INTEGER NOT NULL DEFAULT 40,
    `weeklyApprovalEmailReminder` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AppNotification` (
    `id` VARCHAR(191) NOT NULL,
    `recipientRole` VARCHAR(191) NOT NULL DEFAULT 'management',
    `recipientUserId` VARCHAR(191) NULL,
    `employeeId` VARCHAR(191) NULL,
    `employeeName` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `siteName` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `timestamp` VARCHAR(191) NOT NULL,
    `read` BOOLEAN NOT NULL DEFAULT false,
    `resolved` BOOLEAN NOT NULL DEFAULT false,
    `resolvedAt` DATETIME(3) NULL,
    `isWarning` BOOLEAN NOT NULL DEFAULT false,
    `metaJson` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AppNotification_siteId_idx`(`siteId`),
    INDEX `AppNotification_recipientRole_idx`(`recipientRole`),
    INDEX `AppNotification_employeeId_idx`(`employeeId`),
    INDEX `AppNotification_resolved_idx`(`resolved`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NotificationAuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `recipient` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NULL,
    `weekStart` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL,
    `reason` TEXT NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `NotificationAuditLog_siteId_idx`(`siteId`),
    INDEX `NotificationAuditLog_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordResetToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PasswordResetToken_token_key`(`token`),
    INDEX `PasswordResetToken_userId_idx`(`userId`),
    INDEX `PasswordResetToken_token_idx`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Location` ADD CONSTRAINT `Location_businessOwnerId_fkey` FOREIGN KEY (`businessOwnerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KioskDevice` ADD CONSTRAINT `KioskDevice_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `Location`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_primarySiteId_fkey` FOREIGN KEY (`primarySiteId`) REFERENCES `Location`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Shift` ADD CONSTRAINT `Shift_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Shift` ADD CONSTRAINT `Shift_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Location`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Rota` ADD CONSTRAINT `Rota_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Location`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceRecord` ADD CONSTRAINT `AttendanceRecord_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceRecord` ADD CONSTRAINT `AttendanceRecord_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Location`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceAudit` ADD CONSTRAINT `AttendanceAudit_attendanceRecordId_fkey` FOREIGN KEY (`attendanceRecordId`) REFERENCES `AttendanceRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClockEvent` ADD CONSTRAINT `ClockEvent_attendanceRecordId_fkey` FOREIGN KEY (`attendanceRecordId`) REFERENCES `AttendanceRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WeeklyApproval` ADD CONSTRAINT `WeeklyApproval_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Location`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Location`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

