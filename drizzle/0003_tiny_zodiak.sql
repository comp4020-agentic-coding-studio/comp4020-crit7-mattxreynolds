CREATE TABLE `classes` (
	`id` text PRIMARY KEY NOT NULL,
	`position` integer NOT NULL,
	`day` text NOT NULL,
	`start` text NOT NULL,
	`end` text NOT NULL,
	`room` text NOT NULL,
	`tutor` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `swap_post_join_classes` (
	`post_id` integer NOT NULL,
	`class_id` text NOT NULL,
	PRIMARY KEY(`post_id`, `class_id`),
	FOREIGN KEY (`post_id`) REFERENCES `swap_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `swap_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`leaving_class_id` text NOT NULL,
	`message` text,
	`status` text DEFAULT 'open' NOT NULL,
	`posted_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`leaving_class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `swap_posts_one_open_per_student_idx` ON `swap_posts` (`student_id`) WHERE "swap_posts"."status" = 'open';