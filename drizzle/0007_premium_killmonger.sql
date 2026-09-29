CREATE TABLE `private_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sender_id` integer NOT NULL,
	`recipient_id` integer NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`read_at` integer,
	FOREIGN KEY (`sender_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipient_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `private_messages_sender_idx` ON `private_messages` (`sender_id`);--> statement-breakpoint
CREATE INDEX `private_messages_recipient_idx` ON `private_messages` (`recipient_id`);