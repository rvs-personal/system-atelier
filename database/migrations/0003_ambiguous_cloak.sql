ALTER TABLE `inference_sessions` ADD `job_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `inference_sessions` ADD `run_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `inference_sessions` ADD `previous_run_id` text DEFAULT '' NOT NULL;