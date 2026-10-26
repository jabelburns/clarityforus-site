CREATE TABLE `backfill_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`dataset` text NOT NULL,
	`scope` text DEFAULT 'default' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`cursor` text,
	`records_seen` integer DEFAULT 0 NOT NULL,
	`records_written` integer DEFAULT 0 NOT NULL,
	`batches_completed` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`started_at` text,
	`completed_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `backfill_jobs_dataset_scope_idx` ON `backfill_jobs` (`dataset`,`scope`);--> statement-breakpoint
CREATE INDEX `backfill_jobs_status_idx` ON `backfill_jobs` (`status`);