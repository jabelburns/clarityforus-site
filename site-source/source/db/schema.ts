import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const entities = sqliteTable(
  "entities",
  {
    id: text("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    canonicalName: text("canonical_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    jurisdictionLevel: text("jurisdiction_level").notNull().default("federal"),
    stateCode: text("state_code"),
    district: text("district"),
    description: text("description"),
    status: text("status").notNull().default("active"),
    imageUrl: text("image_url"),
    ...timestamps,
  },
  (table) => [
    index("entities_type_idx").on(table.entityType),
    index("entities_name_idx").on(table.normalizedName),
    index("entities_state_idx").on(table.stateCode),
  ],
);

export const entityAliases = sqliteTable(
  "entity_aliases",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entityId: text("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    normalizedAlias: text("normalized_alias").notNull(),
    aliasType: text("alias_type").notNull().default("name"),
  },
  (table) => [
    index("entity_aliases_lookup_idx").on(table.normalizedAlias),
    uniqueIndex("entity_aliases_unique_idx").on(
      table.entityId,
      table.normalizedAlias,
      table.aliasType,
    ),
  ],
);

export const sources = sqliteTable(
  "sources",
  {
    id: text("id").primaryKey(),
    sourceSystem: text("source_system").notNull(),
    recordType: text("record_type").notNull(),
    publisher: text("publisher").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    documentDate: text("document_date"),
    retrievedAt: text("retrieved_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    lastModifiedAt: text("last_modified_at"),
    checksum: text("checksum"),
    coverageNote: text("coverage_note"),
  },
  (table) => [
    index("sources_system_idx").on(table.sourceSystem),
    uniqueIndex("sources_url_idx").on(table.url),
  ],
);

export const externalIds = sqliteTable(
  "external_ids",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entityId: text("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    sourceSystem: text("source_system").notNull(),
    externalId: text("external_id").notNull(),
    officialUrl: text("official_url"),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    verifiedAt: text("verified_at"),
  },
  (table) => [
    uniqueIndex("external_ids_source_unique_idx").on(
      table.sourceSystem,
      table.externalId,
    ),
    index("external_ids_entity_idx").on(table.entityId),
  ],
);

export const sourceRecords = sqliteTable(
  "source_records",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    entityId: text("entity_id").references(() => entities.id, {
      onDelete: "set null",
    }),
    externalId: text("external_id").notNull(),
    rawJson: text("raw_json").notNull(),
    fetchedAt: text("fetched_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    transformedAt: text("transformed_at"),
  },
  (table) => [
    uniqueIndex("source_records_external_unique_idx").on(
      table.sourceId,
      table.externalId,
    ),
    index("source_records_entity_idx").on(table.entityId),
  ],
);

export const offices = sqliteTable("offices", {
  entityId: text("entity_id")
    .primaryKey()
    .references(() => entities.id, { onDelete: "cascade" }),
  branch: text("branch").notNull(),
  title: text("title").notNull(),
  chamber: text("chamber"),
  stateCode: text("state_code"),
  district: text("district"),
  termStart: text("term_start"),
  termEnd: text("term_end"),
  isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(false),
});

export const elections = sqliteTable("elections", {
  entityId: text("entity_id")
    .primaryKey()
    .references(() => entities.id, { onDelete: "cascade" }),
  officeName: text("office_name").notNull(),
  stateCode: text("state_code"),
  district: text("district"),
  electionDate: text("election_date"),
  cycle: integer("cycle").notNull(),
  electionType: text("election_type").notNull(),
  stage: text("stage"),
  resultStatus: text("result_status"),
});

export const candidacies = sqliteTable(
  "candidacies",
  {
    id: text("id").primaryKey(),
    candidateEntityId: text("candidate_entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    electionEntityId: text("election_entity_id")
      .notNull()
      .references(() => elections.entityId, { onDelete: "cascade" }),
    party: text("party"),
    status: text("status").notNull(),
    incumbent: integer("incumbent", { mode: "boolean" }).notNull().default(false),
    ballotStatus: text("ballot_status"),
    fecCandidateId: text("fec_candidate_id"),
    sourceId: text("source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("candidacies_candidate_election_idx").on(
      table.candidateEntityId,
      table.electionEntityId,
    ),
  ],
);

export const committees = sqliteTable("committees", {
  entityId: text("entity_id")
    .primaryKey()
    .references(() => entities.id, { onDelete: "cascade" }),
  committeeType: text("committee_type"),
  designation: text("designation"),
  party: text("party"),
  treasurer: text("treasurer"),
  fecCommitteeId: text("fec_committee_id").unique(),
});

export const bills = sqliteTable(
  "bills",
  {
    entityId: text("entity_id")
      .primaryKey()
      .references(() => entities.id, { onDelete: "cascade" }),
    congress: integer("congress").notNull(),
    billType: text("bill_type").notNull(),
    billNumber: text("bill_number").notNull(),
    title: text("title").notNull(),
    policyArea: text("policy_area"),
    introducedDate: text("introduced_date"),
    currentStatus: text("current_status"),
    latestAction: text("latest_action"),
    latestActionDate: text("latest_action_date"),
    officialUrl: text("official_url").notNull(),
    sourceId: text("source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("bills_congress_number_idx").on(
      table.congress,
      table.billType,
      table.billNumber,
    ),
  ],
);

export const billSponsors = sqliteTable(
  "bill_sponsors",
  {
    id: text("id").primaryKey(),
    billEntityId: text("bill_entity_id")
      .notNull()
      .references(() => bills.entityId, { onDelete: "cascade" }),
    personEntityId: text("person_entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    sponsorType: text("sponsor_type").notNull(),
    joinedDate: text("joined_date"),
    withdrawnDate: text("withdrawn_date"),
    sourceId: text("source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("bill_sponsors_unique_idx").on(
      table.billEntityId,
      table.personEntityId,
      table.sponsorType,
    ),
  ],
);

export const votes = sqliteTable(
  "votes",
  {
    entityId: text("entity_id")
      .primaryKey()
      .references(() => entities.id, { onDelete: "cascade" }),
    congress: integer("congress").notNull(),
    chamber: text("chamber").notNull(),
    session: text("session"),
    rollNumber: integer("roll_number").notNull(),
    voteDate: text("vote_date").notNull(),
    question: text("question"),
    description: text("description"),
    result: text("result"),
    billEntityId: text("bill_entity_id").references(() => bills.entityId, {
      onDelete: "set null",
    }),
    officialUrl: text("official_url").notNull(),
    sourceId: text("source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("votes_roll_unique_idx").on(
      table.congress,
      table.chamber,
      table.session,
      table.rollNumber,
    ),
  ],
);

export const memberVotes = sqliteTable(
  "member_votes",
  {
    id: text("id").primaryKey(),
    voteEntityId: text("vote_entity_id")
      .notNull()
      .references(() => votes.entityId, { onDelete: "cascade" }),
    personEntityId: text("person_entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    position: text("position").notNull(),
    sourceId: text("source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("member_votes_unique_idx").on(
      table.voteEntityId,
      table.personEntityId,
    ),
  ],
);

export const executiveOrders = sqliteTable("executive_orders", {
  entityId: text("entity_id")
    .primaryKey()
    .references(() => entities.id, { onDelete: "cascade" }),
  documentNumber: text("document_number").notNull().unique(),
  executiveOrderNumber: text("executive_order_number"),
  signingDate: text("signing_date"),
  publicationDate: text("publication_date").notNull(),
  presidentEntityId: text("president_entity_id").references(() => entities.id, {
    onDelete: "set null",
  }),
  citation: text("citation"),
  dispositionNotes: text("disposition_notes"),
  status: text("status").notNull().default("published"),
  officialUrl: text("official_url").notNull(),
  sourceId: text("source_id").references(() => sources.id, {
    onDelete: "set null",
  }),
});

export const courtCases = sqliteTable(
  "court_cases",
  {
    entityId: text("entity_id")
      .primaryKey()
      .references(() => entities.id, { onDelete: "cascade" }),
    court: text("court").notNull(),
    docketNumber: text("docket_number").notNull(),
    filedDate: text("filed_date"),
    terminatedDate: text("terminated_date"),
    caseStatus: text("case_status"),
    natureOfSuit: text("nature_of_suit"),
    opinionStatus: text("opinion_status"),
    officialUrl: text("official_url"),
    sourceId: text("source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("court_cases_docket_idx").on(table.court, table.docketNumber),
  ],
);

export const caseChallenges = sqliteTable(
  "case_challenges",
  {
    id: text("id").primaryKey(),
    caseEntityId: text("case_entity_id")
      .notNull()
      .references(() => courtCases.entityId, { onDelete: "cascade" }),
    challengedEntityId: text("challenged_entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    challengeType: text("challenge_type").notNull(),
    legalQuestion: text("legal_question"),
    currentOutcome: text("current_outcome"),
    sourceId: text("source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("case_challenges_unique_idx").on(
      table.caseEntityId,
      table.challengedEntityId,
      table.challengeType,
    ),
  ],
);

export const moneyTransactions = sqliteTable(
  "money_transactions",
  {
    id: text("id").primaryKey(),
    transactionType: text("transaction_type").notNull(),
    amountCents: integer("amount_cents").notNull(),
    transactionDate: text("transaction_date").notNull(),
    contributorEntityId: text("contributor_entity_id").references(
      () => entities.id,
      { onDelete: "set null" },
    ),
    committeeEntityId: text("committee_entity_id").references(
      () => committees.entityId,
      { onDelete: "set null" },
    ),
    candidateEntityId: text("candidate_entity_id").references(
      () => entities.id,
      { onDelete: "set null" },
    ),
    memo: text("memo"),
    fecTransactionId: text("fec_transaction_id"),
    filingId: text("filing_id"),
    amendmentIndicator: text("amendment_indicator"),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "restrict" }),
  },
  (table) => [
    index("money_contributor_idx").on(table.contributorEntityId),
    index("money_committee_idx").on(table.committeeEntityId),
    index("money_candidate_idx").on(table.candidateEntityId),
    uniqueIndex("money_fec_transaction_idx").on(table.fecTransactionId),
  ],
);

export const relationships = sqliteTable(
  "relationships",
  {
    id: text("id").primaryKey(),
    fromEntityId: text("from_entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    toEntityId: text("to_entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    relationshipType: text("relationship_type").notNull(),
    description: text("description"),
    startDate: text("start_date"),
    endDate: text("end_date"),
    amountCents: integer("amount_cents"),
    currency: text("currency").notNull().default("USD"),
    confidence: real("confidence").notNull().default(1),
    evidenceClass: text("evidence_class").notNull().default("source_fact"),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "restrict" }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("relationships_from_idx").on(table.fromEntityId),
    index("relationships_to_idx").on(table.toEntityId),
    index("relationships_type_idx").on(table.relationshipType),
  ],
);

export const analyses = sqliteTable(
  "analyses",
  {
    id: text("id").primaryKey(),
    subjectEntityId: text("subject_entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    analysisType: text("analysis_type").notNull(),
    analysisVersion: integer("analysis_version").notNull(),
    status: text("status").notNull(),
    modelName: text("model_name"),
    generatedAt: text("generated_at"),
    sourceSnapshotAt: text("source_snapshot_at"),
    methodologyVersion: text("methodology_version").notNull(),
    summary: text("summary"),
    limitations: text("limitations"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("analyses_subject_version_idx").on(
      table.subjectEntityId,
      table.analysisType,
      table.analysisVersion,
    ),
  ],
);

export const analysisFindings = sqliteTable(
  "analysis_findings",
  {
    id: text("id").primaryKey(),
    analysisId: text("analysis_id")
      .notNull()
      .references(() => analyses.id, { onDelete: "cascade" }),
    promptKey: text("prompt_key").notNull(),
    findingClass: text("finding_class").notNull(),
    findingText: text("finding_text").notNull(),
    confidence: real("confidence"),
    sequence: integer("sequence").notNull().default(0),
    sourceId: text("source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
  },
  (table) => [index("analysis_findings_analysis_idx").on(table.analysisId)],
);

export const ingestRuns = sqliteTable("ingest_runs", {
  id: text("id").primaryKey(),
  sourceSystem: text("source_system").notNull(),
  startedAt: text("started_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  finishedAt: text("finished_at"),
  status: text("status").notNull(),
  recordsSeen: integer("records_seen").notNull().default(0),
  recordsWritten: integer("records_written").notNull().default(0),
  errorText: text("error_text"),
});

export const backfillJobs = sqliteTable(
  "backfill_jobs",
  {
    id: text("id").primaryKey(),
    dataset: text("dataset").notNull(),
    scope: text("scope").notNull().default("default"),
    status: text("status").notNull().default("pending"),
    cursor: text("cursor"),
    recordsSeen: integer("records_seen").notNull().default(0),
    recordsWritten: integer("records_written").notNull().default(0),
    batchesCompleted: integer("batches_completed").notNull().default(0),
    lastError: text("last_error"),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("backfill_jobs_dataset_scope_idx").on(table.dataset, table.scope),
    index("backfill_jobs_status_idx").on(table.status),
  ],
);

export const siteSettings = sqliteTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
