CREATE TABLE `offers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`offerer_id` integer NOT NULL,
	`offered_class_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`closed_reason` text,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`post_id`) REFERENCES `swap_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`offerer_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`offered_class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `offers_one_pending_per_student_post_idx` ON `offers` (`post_id`,`offerer_id`) WHERE "offers"."status" = 'pending';