CREATE TABLE `inference_replies` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`result` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `inference_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`busy_until` integer DEFAULT 0 NOT NULL,
	`lease` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
