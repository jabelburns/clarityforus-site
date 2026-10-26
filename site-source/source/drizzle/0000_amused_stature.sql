CREATE TABLE `analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_entity_id` text NOT NULL,
	`analysis_type` text NOT NULL,
	`analysis_version` integer NOT NULL,
	`status` text NOT NULL,
	`model_name` text,
	`generated_at` text,
	`source_snapshot_at` text,
	`methodology_version` text NOT NULL,
	`summary` text,
	`limitations` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`subject_entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `analyses_subject_version_idx` ON `analyses` (`subject_entity_id`,`analysis_type`,`analysis_version`);--> statement-breakpoint
CREATE TABLE `analysis_findings` (
	`id` text PRIMARY KEY NOT NULL,
	`analysis_id` text NOT NULL,
	`prompt_key` text NOT NULL,
	`finding_class` text NOT NULL,
	`finding_text` text NOT NULL,
	`confidence` real,
	`sequence` integer DEFAULT 0 NOT NULL,
	`source_id` text,
	FOREIGN KEY (`analysis_id`) REFERENCES `analyses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `analysis_findings_analysis_idx` ON `analysis_findings` (`analysis_id`);--> statement-breakpoint
CREATE TABLE `bill_sponsors` (
	`id` text PRIMARY KEY NOT NULL,
	`bill_entity_id` text NOT NULL,
	`person_entity_id` text NOT NULL,
	`sponsor_type` text NOT NULL,
	`joined_date` text,
	`withdrawn_date` text,
	`source_id` text,
	FOREIGN KEY (`bill_entity_id`) REFERENCES `bills`(`entity_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bill_sponsors_unique_idx` ON `bill_sponsors` (`bill_entity_id`,`person_entity_id`,`sponsor_type`);--> statement-breakpoint
CREATE TABLE `bills` (
	`entity_id` text PRIMARY KEY NOT NULL,
	`congress` integer NOT NULL,
	`bill_type` text NOT NULL,
	`bill_number` text NOT NULL,
	`title` text NOT NULL,
	`policy_area` text,
	`introduced_date` text,
	`current_status` text,
	`latest_action` text,
	`latest_action_date` text,
	`official_url` text NOT NULL,
	`source_id` text,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bills_congress_number_idx` ON `bills` (`congress`,`bill_type`,`bill_number`);--> statement-breakpoint
CREATE TABLE `candidacies` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_entity_id` text NOT NULL,
	`election_entity_id` text NOT NULL,
	`party` text,
	`status` text NOT NULL,
	`incumbent` integer DEFAULT false NOT NULL,
	`ballot_status` text,
	`fec_candidate_id` text,
	`source_id` text,
	FOREIGN KEY (`candidate_entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`election_entity_id`) REFERENCES `elections`(`entity_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `candidacies_candidate_election_idx` ON `candidacies` (`candidate_entity_id`,`election_entity_id`);--> statement-breakpoint
CREATE TABLE `case_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`case_entity_id` text NOT NULL,
	`challenged_entity_id` text NOT NULL,
	`challenge_type` text NOT NULL,
	`legal_question` text,
	`current_outcome` text,
	`source_id` text,
	FOREIGN KEY (`case_entity_id`) REFERENCES `court_cases`(`entity_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`challenged_entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `case_challenges_unique_idx` ON `case_challenges` (`case_entity_id`,`challenged_entity_id`,`challenge_type`);--> statement-breakpoint
CREATE TABLE `committees` (
	`entity_id` text PRIMARY KEY NOT NULL,
	`committee_type` text,
	`designation` text,
	`party` text,
	`treasurer` text,
	`fec_committee_id` text,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `committees_fec_committee_id_unique` ON `committees` (`fec_committee_id`);--> statement-breakpoint
CREATE TABLE `court_cases` (
	`entity_id` text PRIMARY KEY NOT NULL,
	`court` text NOT NULL,
	`docket_number` text NOT NULL,
	`filed_date` text,
	`terminated_date` text,
	`case_status` text,
	`nature_of_suit` text,
	`opinion_status` text,
	`official_url` text,
	`source_id` text,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `court_cases_docket_idx` ON `court_cases` (`court`,`docket_number`);--> statement-breakpoint
CREATE TABLE `elections` (
	`entity_id` text PRIMARY KEY NOT NULL,
	`office_name` text NOT NULL,
	`state_code` text,
	`district` text,
	`election_date` text,
	`cycle` integer NOT NULL,
	`election_type` text NOT NULL,
	`stage` text,
	`result_status` text,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `entities` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`canonical_name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`jurisdiction_level` text DEFAULT 'federal' NOT NULL,
	`state_code` text,
	`district` text,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`image_url` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `entities_type_idx` ON `entities` (`entity_type`);--> statement-breakpoint
CREATE INDEX `entities_name_idx` ON `entities` (`normalized_name`);--> statement-breakpoint
CREATE INDEX `entities_state_idx` ON `entities` (`state_code`);--> statement-breakpoint
CREATE TABLE `entity_aliases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_id` text NOT NULL,
	`alias` text NOT NULL,
	`normalized_alias` text NOT NULL,
	`alias_type` text DEFAULT 'name' NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `entity_aliases_lookup_idx` ON `entity_aliases` (`normalized_alias`);--> statement-breakpoint
CREATE UNIQUE INDEX `entity_aliases_unique_idx` ON `entity_aliases` (`entity_id`,`normalized_alias`,`alias_type`);--> statement-breakpoint
CREATE TABLE `executive_orders` (
	`entity_id` text PRIMARY KEY NOT NULL,
	`document_number` text NOT NULL,
	`executive_order_number` text,
	`signing_date` text,
	`publication_date` text NOT NULL,
	`president_entity_id` text,
	`citation` text,
	`disposition_notes` text,
	`status` text DEFAULT 'published' NOT NULL,
	`official_url` text NOT NULL,
	`source_id` text,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`president_entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `executive_orders_document_number_unique` ON `executive_orders` (`document_number`);--> statement-breakpoint
CREATE TABLE `external_ids` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_id` text NOT NULL,
	`source_system` text NOT NULL,
	`external_id` text NOT NULL,
	`official_url` text,
	`is_primary` integer DEFAULT false NOT NULL,
	`verified_at` text,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `external_ids_source_unique_idx` ON `external_ids` (`source_system`,`external_id`);--> statement-breakpoint
CREATE INDEX `external_ids_entity_idx` ON `external_ids` (`entity_id`);--> statement-breakpoint
CREATE TABLE `ingest_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`source_system` text NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`finished_at` text,
	`status` text NOT NULL,
	`records_seen` integer DEFAULT 0 NOT NULL,
	`records_written` integer DEFAULT 0 NOT NULL,
	`error_text` text
);
--> statement-breakpoint
CREATE TABLE `member_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`vote_entity_id` text NOT NULL,
	`person_entity_id` text NOT NULL,
	`position` text NOT NULL,
	`source_id` text,
	FOREIGN KEY (`vote_entity_id`) REFERENCES `votes`(`entity_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_votes_unique_idx` ON `member_votes` (`vote_entity_id`,`person_entity_id`);--> statement-breakpoint
CREATE TABLE `money_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_type` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`transaction_date` text NOT NULL,
	`contributor_entity_id` text,
	`committee_entity_id` text,
	`candidate_entity_id` text,
	`memo` text,
	`fec_transaction_id` text,
	`filing_id` text,
	`amendment_indicator` text,
	`source_id` text NOT NULL,
	FOREIGN KEY (`contributor_entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`committee_entity_id`) REFERENCES `committees`(`entity_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`candidate_entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `money_contributor_idx` ON `money_transactions` (`contributor_entity_id`);--> statement-breakpoint
CREATE INDEX `money_committee_idx` ON `money_transactions` (`committee_entity_id`);--> statement-breakpoint
CREATE INDEX `money_candidate_idx` ON `money_transactions` (`candidate_entity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `money_fec_transaction_idx` ON `money_transactions` (`fec_transaction_id`);--> statement-breakpoint
CREATE TABLE `offices` (
	`entity_id` text PRIMARY KEY NOT NULL,
	`branch` text NOT NULL,
	`title` text NOT NULL,
	`chamber` text,
	`state_code` text,
	`district` text,
	`term_start` text,
	`term_end` text,
	`is_current` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`from_entity_id` text NOT NULL,
	`to_entity_id` text NOT NULL,
	`relationship_type` text NOT NULL,
	`description` text,
	`start_date` text,
	`end_date` text,
	`amount_cents` integer,
	`currency` text DEFAULT 'USD' NOT NULL,
	`confidence` real DEFAULT 1 NOT NULL,
	`evidence_class` text DEFAULT 'source_fact' NOT NULL,
	`source_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`from_entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `relationships_from_idx` ON `relationships` (`from_entity_id`);--> statement-breakpoint
CREATE INDEX `relationships_to_idx` ON `relationships` (`to_entity_id`);--> statement-breakpoint
CREATE INDEX `relationships_type_idx` ON `relationships` (`relationship_type`);--> statement-breakpoint
CREATE TABLE `site_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `source_records` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`entity_id` text,
	`external_id` text NOT NULL,
	`raw_json` text NOT NULL,
	`fetched_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`transformed_at` text,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_records_external_unique_idx` ON `source_records` (`source_id`,`external_id`);--> statement-breakpoint
CREATE INDEX `source_records_entity_idx` ON `source_records` (`entity_id`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`source_system` text NOT NULL,
	`record_type` text NOT NULL,
	`publisher` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`document_date` text,
	`retrieved_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_modified_at` text,
	`checksum` text,
	`coverage_note` text
);
--> statement-breakpoint
CREATE INDEX `sources_system_idx` ON `sources` (`source_system`);--> statement-breakpoint
CREATE UNIQUE INDEX `sources_url_idx` ON `sources` (`url`);--> statement-breakpoint
CREATE TABLE `votes` (
	`entity_id` text PRIMARY KEY NOT NULL,
	`congress` integer NOT NULL,
	`chamber` text NOT NULL,
	`session` text,
	`roll_number` integer NOT NULL,
	`vote_date` text NOT NULL,
	`question` text,
	`description` text,
	`result` text,
	`bill_entity_id` text,
	`official_url` text NOT NULL,
	`source_id` text,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bill_entity_id`) REFERENCES `bills`(`entity_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `votes_roll_unique_idx` ON `votes` (`congress`,`chamber`,`session`,`roll_number`);