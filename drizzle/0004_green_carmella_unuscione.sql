ALTER TABLE `swap_posts` ADD `edited_at` integer;--> statement-breakpoint
ALTER TABLE `swap_posts` ADD `withdrawn_at` integer;--> statement-breakpoint
ALTER TABLE `swap_posts` ADD `withdrawn_by` integer REFERENCES students(id);