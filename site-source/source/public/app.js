/* Historical interface copy retained for reference. It is never mixed into official search results.
  {
    id: "politician-demo",
    type: "politician",
    kind: "Public official profile",
    title: "Federal officeholder profile",
    subtitle: "Office, committees, money, sponsored bills, executive actions, votes, disclosures, and election history in one view.",
    tags: ["public official", "president", "representative", "campaign finance", "congress", "votes", "election"],
    connection: "Connects power, money, action, and impact",
    fields: [
      ["Office", "Role, term, jurisdiction, district, and official contact"],
      ["Core identity", "Bioguide + FEC IDs"],
      ["Elections", "Current race, prior results, and opponents"],
      ["Money view", "Campaign committees, receipts, donors, debt, and outside spending"],
      ["Voting record", "Roll calls, attendance, motions, and vote context"],
      ["Bills & laws", "Sponsored and cosponsored measures, amendments, and outcomes"],
      ["Public disclosures", "Financial interests, trades, travel, gifts, and ethics records where available"],
      ["Legal links", "Enacted laws or executive actions connected to filed court challenges"]
    ]
  },
  {
    id: "election-demo",
    type: "election",
    kind: "Candidate & election profile",
    title: "Federal race and candidate comparison",
    subtitle: "Every filed candidate, ballot and incumbent status, fundraising, outside spending, election dates, results, and comparable public records.",
    tags: ["candidate", "election", "race", "ballot", "president", "representative", "challenger", "incumbent"],
    connection: "Compares candidates without endorsements or rankings",
    fields: [
      ["Race", "Office + state or district"],
      ["Candidate status", "Filed, ballot-qualified, withdrawn, or elected"],
      ["Money", "Receipts, spending, debt, and outside spending"],
      ["Public record", "Prior office, votes, bills, and disclosures"]
    ],
    analysis: [
      ["Equal treatment", "The same fields, date ranges, and questions for every candidate in a race."],
      ["No endorsement", "Facts and sources are presented without a preferred candidate, score, or ranking."],
      ["Coverage warning", "Filing and ballot status dates are shown because candidates can enter, withdraw, or qualify later."]
    ]
  },
  {
    id: "bill-demo",
    type: "bill",
    kind: "Bill profile",
    title: "Plain-English bill record",
    subtitle: "Official text, sourced AI explanation, sponsors, actions, votes, beneficiaries, costs, backing, opposition, and legal path.",
    tags: ["privacy", "legislation", "sponsors", "congress", "ai explanation", "who benefits", "cost", "lobbying", "lawsuit"],
    connection: "Explains what changes, who benefits, and who pays",
    fields: [
      ["Primary record", "Congress.gov"],
      ["Text standard", "Official version labeled"],
      ["Explanation", "Source-grounded AI + limitations"],
      ["History", "Actions, amendments, roll calls, and enacted-law status"]
    ],
    analysis: [
      ["What changes?", "Compare the proposal with current law and explain each material section and amendment."],
      ["Who benefits?", "Name direct and likely secondary beneficiaries as specifically as the evidence allows."],
      ["Who pays or carries risk?", "Identify budget effects, compliance burdens, affected communities, and implementation risk."],
      ["Who is backing or opposing it?", "Link sponsors, disclosed campaign money, lobbying filings, and public organizational positions."],
      ["What could be challenged?", "Flag potential legal questions as analysis; link actual lawsuits only after they are filed."],
      ["What is uncertain?", "Show missing evidence, disputed estimates, assumptions, and confidence labels."]
    ]
  },
  {
    id: "contribution-demo",
    type: "contribution",
    kind: "Contribution record",
    title: "Reported political contribution",
    subtitle: "Amount, date, donor, recipient, filing context, amendments, refunds, and the original disclosure.",
    tags: ["money", "contribution", "donor", "filing", "refund"],
    connection: "Links donors, committees, and candidates",
    fields: [
      ["Primary record", "FEC filing or schedule"],
      ["Transaction", "Amount + date + recipient"],
      ["Classification", "Direct, transfer, refund, or outside spending"],
      ["Audit trail", "Amendments preserved"]
    ]
  },
  {
    id: "committee-demo",
    type: "committee",
    kind: "PAC / Super PAC profile",
    title: "Political committee profile",
    subtitle: "Receipts, spending, affiliated organizations, filings, and supported or opposed candidates.",
    tags: ["money", "super pac", "committee", "spending"],
    connection: "Traces money in and money out",
    fields: [
      ["Primary record", "FEC committee ID"],
      ["Receipts", "Itemized + total"],
      ["Spending", "Operating + independent"],
      ["Disclosures", "Original filings linked"]
    ]
  },
  {
    id: "contributor-demo",
    type: "contributor",
    kind: "Contributor profile",
    title: "Disclosed contributor network",
    subtitle: "Reported contributions grouped carefully without erasing spelling, employer, or identity uncertainty.",
    tags: ["money", "donor", "contributor", "employer"],
    connection: "Entity matching with confidence labels",
    fields: [
      ["Evidence", "Itemized FEC records"],
      ["Identity", "Name + location + employer"],
      ["Matching", "Confidence score disclosed"],
      ["Network", "Recipients and committees"]
    ]
  },
  {
    id: "executive-order-demo",
    type: "executive-order",
    kind: "Executive order profile",
    title: "Executive order record",
    subtitle: "Official text, legal authority, affected agencies, deadlines, revocations, implementation, funding links, and court challenges.",
    tags: ["executive order", "president", "federal register", "agency", "court", "funding"],
    connection: "Links presidential action to agencies and courts",
    fields: [
      ["Primary record", "Federal Register"],
      ["Authority", "Cited statutes + Constitution"],
      ["Implementation", "Agencies, deadlines, and directives"],
      ["Status", "Active, amended, revoked, or challenged"]
    ]
  },
  {
    id: "presidential-funding-demo",
    type: "presidential-funding",
    kind: "Presidential funding profile",
    title: "Presidential money profile",
    subtitle: "Campaign receipts, outside spending, inaugural donations, transition resources, and presidential-library disclosure coverage.",
    tags: ["president", "campaign money", "outside spending", "inaugural", "transition", "library donors"],
    connection: "Separates five very different money channels",
    fields: [
      ["Campaign", "Candidate committees + joint fundraising"],
      ["Outside spending", "Independent expenditures"],
      ["Inauguration", "FEC Form 13 donations"],
      ["Other channels", "Transition funds + library disclosure gaps"]
    ]
  },
  {
    id: "case-demo",
    type: "case",
    kind: "Court case profile",
    title: "Federal court challenge record",
    subtitle: "Complaint, docket, challenged law or action, parties, injunctions, appeals, opinions, current status, and downstream impact.",
    tags: ["court", "lawsuit", "district court", "appeal", "supreme court", "opinion", "injunction", "privacy"],
    connection: "Links filed cases back to laws, orders, and officials",
    fields: [
      ["Primary record", "Official court docket or opinion"],
      ["Proceedings", "Complaint, filings, hearings, and argument"],
      ["Decision", "Orders, injunctions, opinions, and appeals"],
      ["Impact", "Affected law, executive action, and precedent"]
    ]
  },
  {
    id: "vote-demo",
    type: "vote",
    kind: "Roll-call vote",
    title: "Recorded vote profile",
    subtitle: "The question, result, chamber, member positions, linked bill, and official roll call.",
    tags: ["vote", "house", "senate", "bill"],
    connection: "Connects lawmakers to legislative action",
    fields: [
      ["Primary record", "House Clerk or U.S. Senate"],
      ["Question", "Motion and measure"],
      ["Result", "Totals + outcome"],
      ["Members", "Individual recorded positions"]
    ]
  }
*/

let officialRecords = [];
let records = [];
let recordsLoading = true;
let searchRequestId = 0;
let searchTimer;
let connectorStatuses = {};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeOfficialUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function rebuildRecords() {
  records = [...officialRecords];
}

function recordMatchesFilter(record, filter) {
  if (filter === "all") return true;
  if (filter === "election") return ["candidate", "election"].includes(record.type);
  if (filter === "money") return ["contribution", "independent-expenditure"].includes(record.type);
  return record.type === filter;
}

const traceSteps = [
  {
    kicker: "START WITH THE SOURCE",
    title: "A contributor reports a political expenditure.",
    copy: "The record should show the filer, amount, date, recipient, filing type, and a direct link back to the original disclosure.",
    evidence: "Original filing + normalized entity"
  },
  {
    kicker: "FOLLOW THE TRANSFER",
    title: "A committee receives or spends the money.",
    copy: "Committee type matters. A candidate committee, party committee, PAC, and independent-expenditure-only committee operate under different rules.",
    evidence: "FEC committee record + report schedule"
  },
  {
    kicker: "NAME THE MONEY CHANNEL",
    title: "Presidential money is not one bucket.",
    copy: "Campaign contributions, independent expenditures, inaugural donations, transition resources, and presidential-library support follow different rules and disclosure standards.",
    evidence: "FEC filing + GSA record + coverage label"
  },
  {
    kicker: "COMPARE THE RACE",
    title: "A candidate competes for public power.",
    copy: "Every candidate in the race receives the same record structure: filing and ballot status, money raised and spent, outside support or opposition, prior public record, election dates, and results.",
    evidence: "FEC candidate ID + official election record"
  },
  {
    kicker: "MAP PUBLIC POWER",
    title: "The winner becomes an officeholder with authority.",
    copy: "The profile joins the office, committees, appointments, disclosures, bills, votes, executive actions, and election history without collapsing distinct roles into one score.",
    evidence: "Official roster + Bioguide or executive record"
  },
  {
    kicker: "EXPLAIN THE LEGISLATIVE ACTION",
    title: "Congress advances a bill and records votes.",
    copy: "AI explains what the text changes, amendments, costs, implementation dates, sponsors, and roll calls. It cites every material claim and keeps fact, outside evidence, and analysis visibly separate.",
    evidence: "Official bill text + actions + roll calls + cost estimates"
  },
  {
    kicker: "ASK THE REQUIRED QUESTION",
    title: "Who benefits—and who pays or carries the risk?",
    copy: "The analysis names direct beneficiaries first, then likely secondary effects, costs, burdens, and uncertainties. Money and lobbying records provide context, never automatic proof of motive or influence.",
    evidence: "Bill text + budget evidence + filings + confidence labels"
  },
  {
    kicker: "CHECK EXECUTIVE POWER",
    title: "The president issues, amends, or revokes an executive order.",
    copy: "The record identifies cited authority, affected agencies, implementation deadlines, related appropriations, beneficiaries, costs, later amendments, revocations, and legal challenges.",
    evidence: "Federal Register text + agency records"
  },
  {
    kicker: "TRACE THE LEGAL RESULT",
    title: "A filed case challenges the enacted law or executive action.",
    copy: "Potential legal exposure is clearly labeled as analysis. Once a suit is filed, complaints, dockets, injunctions, appeals, and opinions reveal the real legal path and current status.",
    evidence: "Official docket + filed documents + court opinion"
  }
];

const grid = document.querySelector("#record-grid");
const search = document.querySelector("#record-search");
const count = document.querySelector("#result-count");
const empty = document.querySelector("#empty-state");
const recordsLoadingMessage = document.querySelector("#records-loading");
const dialog = document.querySelector("#record-dialog");
const dialogContent = document.querySelector("#dialog-content");
let activeFilter = "all";
let activeTrace = 0;

function renderRecords() {
  if (recordsLoading) {
    count.textContent = "0";
    recordsLoadingMessage.hidden = false;
    empty.hidden = true;
    grid.hidden = true;
    return;
  }

  const term = search.value.trim().toLowerCase();
  const visible = records.filter((record) => {
    const matchesType = recordMatchesFilter(record, activeFilter);
    const haystack = [record.kind, record.title, record.subtitle, ...(record.tags || [])].join(" ").toLowerCase();
    return matchesType && (!term || haystack.includes(term));
  });

  grid.innerHTML = visible.map((record) => {
    const badge = record.isDesign
      ? '<span class="demo-badge">DESIGN</span>'
      : record.isLive
        ? '<span class="demo-badge live-badge">OFFICIAL LIVE</span>'
        : '<span class="demo-badge database-badge">SOURCE-BACKED</span>';
    const action = record.isDesign ? "Open record design" : "View record";
    return `
    <button class="record-card" type="button" data-record="${escapeHtml(record.id)}">
      <span class="record-card-top">
        <span class="record-kind">${escapeHtml(record.kind)}</span>
        ${badge}
      </span>
      <h3>${escapeHtml(record.title)}</h3>
      <p>${escapeHtml(record.subtitle)}</p>
      <span class="record-card-footer"><b>${action}</b><span>${escapeHtml(record.connection)} →</span></span>
    </button>
  `;
  }).join("");

  count.textContent = visible.length;
  recordsLoadingMessage.hidden = true;
  empty.hidden = visible.length !== 0;
  grid.hidden = visible.length === 0;

  document.querySelectorAll("[data-filter]").forEach((button) => {
    const filter = button.dataset.filter;
    const filterCount = records.filter((record) => recordMatchesFilter(record, filter)).length;
    const value = button.querySelector("b");
    if (value) value.textContent = filterCount;
  });
}

function renderRecordDialog(record) {
  const hasRecordedAnalysis = Boolean(record.analysis?.length);
  const analysis = record.analysis || [
    ["Who benefits?", "Identify direct beneficiaries, likely secondary beneficiaries, and the evidence for each conclusion."],
    ["Who pays or carries risk?", "Show financial cost, legal exposure, administrative burden, and affected communities where the record supports it."],
    ["What is fact versus analysis?", "Keep source facts, outside evidence, and reasoned inference visibly separate."]
  ];
  const sourceUrl = safeOfficialUrl(record.sourceUrl);
  const recordLabel = record.isDesign ? "design demonstration" : "official source record";
  const fields = record.fields || [];
  const linkedSections = record.linkedSections || [];
  const analysisStatus = record.analysisStatus || (hasRecordedAnalysis ? "complete" : "questions");
  const analysisMeta = analysisStatus === "complete"
    ? {
        badge: "Source-grounded",
        title: "Who benefits—and who pays?",
        copy: "Clarity separates claims drawn from official text, outside evidence, and reasoned analysis. Review the cited evidence before drawing conclusions."
      }
    : analysisStatus === "pending"
      ? {
          badge: "Analysis pending",
          title: "Who benefits—and who pays?",
          copy: "The official record is available. These questions show what the source-grounded analysis still needs to establish."
        }
      : {
          badge: "Analysis checklist",
          title: "Questions this record should answer",
          copy: "These are the questions Clarity applies to this record type. They are not conclusions until supporting evidence is attached."
        };
  dialogContent.innerHTML = `
    <article class="dialog-body">
      <header class="dialog-hero">
        <div class="dialog-record-meta">
          <span class="dialog-source-badge">${escapeHtml(recordLabel)}</span>
          <span class="record-kind">${escapeHtml(record.kind)}</span>
        </div>
        <h2 id="dialog-title">${escapeHtml(record.title)}</h2>
        <p class="dialog-summary">${escapeHtml(record.subtitle)}</p>
        <div class="dialog-primary-actions">
          ${sourceUrl ? `<a class="button button-primary" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">Open official source <span>↗</span></a>` : ""}
          <button class="button dialog-jump-button" type="button" data-dialog-jump="dialog-analysis">Who benefits?</button>
          ${linkedSections.length ? `<button class="button dialog-jump-button" type="button" data-dialog-jump="dialog-connections">Connections <span>${linkedSections.length}</span></button>` : ""}
        </div>
      </header>

      <div class="dialog-content-stack">
        ${record.detailLoading ? `<div class="dialog-loading" role="status"><span></span><div><strong>Loading connected evidence…</strong><small>Votes, money, bills, elections, legal links, and source records are being joined.</small></div></div>` : ""}

        <section class="dialog-section" id="dialog-overview">
          <div class="dialog-section-heading">
            <div><span>OVERVIEW</span><h3>At a glance</h3></div>
            <p>Facts reported by the source or stored in the Clarity database.</p>
          </div>
          <div class="dialog-grid">
            ${fields.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}
          </div>
        </section>

        <section class="dialog-section dialog-analysis-section" id="dialog-analysis">
          <div class="dialog-section-heading">
            <div><span>CLARITY LENS</span><h3>${escapeHtml(analysisMeta.title)}</h3></div>
            <span class="analysis-status-badge ${escapeHtml(analysisStatus)}">${escapeHtml(analysisMeta.badge)}</span>
          </div>
          <p class="dialog-section-intro">${escapeHtml(analysisMeta.copy)}</p>
          <div class="dialog-analysis">
            ${analysis.map(([question, answer], index) => `<div class="dialog-analysis-row"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(question)}</strong><p>${escapeHtml(answer)}</p></div>`).join("")}
          </div>
          ${record.analysisAction ? `
            <div class="dialog-analysis-action">
              <button class="button button-primary" type="button" data-generate-analysis="${escapeHtml(record.analysisAction.recordId)}">${escapeHtml(record.analysisAction.label)}</button>
              <p data-analysis-status role="status" aria-live="polite">${escapeHtml(record.analysisAction.note)}</p>
            </div>
          ` : ""}
        </section>

        ${record.isDatabase && !record.detailLoading && !record.isDesign ? `
        <section class="dialog-section dialog-graph-section" id="dialog-graph">
          <div class="dialog-section-heading"><div><span>CLARITY GRAPH</span><h3>Trace documented connections</h3></div>
          <p>Explore up to two documented relationship hops, each linked to its original evidence.</p></div>
          <p class="dialog-section-intro">Only source-linked records appear. An edge does not establish motive, corruption or causality. The display is bounded and may omit other existing links.</p>
          <button class="button" type="button" data-graph-explore="${escapeHtml(record.id)}">Explore evidence paths →</button>
          <div class="graph-explorer-results" data-graph-results role="status" aria-live="polite"></div>
        </section>` : ""}

        ${record.isDatabase && !record.detailLoading && !record.isDesign && ["candidate", "politician"].includes(String(record.type || "").replaceAll("-", "_")) ? `
        <section class="dialog-section dialog-finance-section" id="dialog-campaign-finance">
          <div class="dialog-section-heading"><div><span>FOLLOW THE FUNDS</span><h3>Imported campaign activity</h3></div>
          <p>Two-year reporting window · individual donors are never identified here</p></div>
          <p class="dialog-section-intro">View transaction records imported by Clarity, not a candidate's total campaign fundraising. Itemized receipts and outside spending are separate categories.</p>
          <label for="campaign-cycle-selector">Reporting window</label>
          <select id="campaign-cycle-selector" data-campaign-cycle>
            ${[0, 2, 4, 6].map((offset) => {
              const year = new Date().getUTCFullYear();
              const currentCycle = year % 2 === 0 ? year : year + 1;
              return `<option value="${currentCycle - offset}">${currentCycle - offset - 1}–${currentCycle - offset}</option>`;
            }).join("")}
          </select>
          <button class="button" type="button" data-campaign-explore="${escapeHtml(record.id)}">View imported finance records →</button>
          <div class="campaign-finance-results" data-campaign-results role="status" aria-live="polite"></div>
        </section>` : ""}

        <section class="dialog-section" id="dialog-connections">
          <div class="dialog-section-heading">
            <div><span>CONNECTED EVIDENCE</span><h3>Follow the record</h3></div>
            <p>${linkedSections.length ? `${linkedSections.length} grouped connection${linkedSections.length === 1 ? "" : "s"}` : "No cross-links have been attached yet."}</p>
          </div>
          ${linkedSections.length ? `<div class="dialog-disclosures">
            ${linkedSections.map((section, sectionIndex) => `
              <details class="dialog-disclosure" ${sectionIndex === 0 ? "open" : ""}>
                <summary>
                  <span><small>${escapeHtml(section.eyebrow)}</small><strong>${escapeHtml(section.title)}</strong></span>
                  <span class="dialog-disclosure-count">${section.items.length} item${section.items.length === 1 ? "" : "s"}</span>
                </summary>
                <div class="dialog-linked-list">
                  ${section.items.map((item) => {
                    const itemUrl = safeOfficialUrl(item.url);
                    const title = item.recordId
                      ? `<button class="dialog-record-button" type="button" data-related-record="${escapeHtml(item.recordId)}" data-related-title="${escapeHtml(item.title)}" data-related-type="${escapeHtml(item.recordType || "record")}" data-related-kind="${escapeHtml(item.kind || "Linked record")}">${escapeHtml(item.title)} <span>→</span></button>`
                      : itemUrl
                        ? `<a href="${escapeHtml(itemUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)} <span>↗</span></a>`
                        : `<strong>${escapeHtml(item.title)}</strong>`;
                    const evidenceUrl = safeOfficialUrl(item.evidenceUrl);
                    return `<div class="dialog-linked-row"><span>${escapeHtml(item.label)}</span><div>${title}<small>${escapeHtml(item.meta)}</small>${evidenceUrl ? `<a class="evidence-action" href="${escapeHtml(evidenceUrl)}" target="_blank" rel="noopener noreferrer">Verify relationship evidence ↗</a>` : ""}</div></div>`;
                  }).join("")}
                </div>
                ${section.note ? `<p class="dialog-linked-note">${escapeHtml(section.note)}</p>` : ""}
              </details>
            `).join("")}
          </div>` : `<div class="dialog-no-connections"><strong>No connected records yet.</strong><p>The official record is still available above. Connections appear only after Clarity has supporting source evidence.</p></div>`}
        </section>

        <p class="dialog-disclaimer">${record.isDesign
          ? "<strong>Design note:</strong> This demonstrates the structure of a Clarity for US record. It is not a claim about a real person, committee, bill, vote, contributor, or court case."
          : "<strong>Evidence rule:</strong> A connection shows a documented relationship. It does not by itself prove motive, influence, wrongdoing, or a legal conclusion."}</p>
      </div>
    </article>
  `;
}

function positionCounts(positions) {
  return positions.reduce((counts, row) => {
    counts[row.position] = (counts[row.position] || 0) + 1;
    return counts;
  }, {});
}

function humanize(value) {
  return String(value || "record")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCurrency(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Not reported";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(amount);
}

function formatCurrencyCents(value) {
  const cents = Number(value);
  return Number.isFinite(cents) ? formatCurrency(cents / 100) : "Not reported";
}

const analysisQuestionLabels = {
  what_changes: "What actually changes?",
  who_benefits: "Who benefits?",
  who_pays: "Who pays or carries risk?",
  support_opposition: "Who is backing or opposing it?",
  legal_exposure: "What could be challenged?",
  uncertainty: "What remains uncertain?"
};

function enrichDatabaseRecord(record, payload) {
  const detail = payload.details || {};
  const entity = payload.record || {};
  const primaryIdentifier = (payload.identifiers || []).find((identifier) => identifier.isPrimary) || payload.identifiers?.[0];
  const fields = [
    ["Record status", entity.status || record.status || "available"],
    ["Jurisdiction", entity.jurisdictionLevel || record.jurisdictionLevel || "federal"],
    ["State", entity.stateCode || "National / not reported"],
    ["District", entity.district || "Not reported"],
    ["Source system", primaryIdentifier?.sourceSystem || record.sourceSystem || "Clarity database"],
    ["Source ID", primaryIdentifier?.externalId || record.externalId || "See linked evidence"],
    ["Last refreshed", entity.updatedAt ? new Date(entity.updatedAt).toLocaleString() : "Not reported"]
  ];
  const linkedSections = [];

  const officeRelationship = (payload.relationships || []).find((relationship) => relationship.relationshipType === "holds_office");
  if (officeRelationship?.relatedEntity) {
    fields.splice(2, 0, ["Current office", officeRelationship.relatedEntity.canonicalName]);
  }

  if (detail.bill) {
    const bill = detail.bill;
    fields.push(
      ["Congress", String(bill.congress)],
      ["Bill number", `${String(bill.billType || "").toUpperCase()} ${bill.billNumber}`],
      ["Policy area", bill.policyArea || "Not assigned"],
      ["Introduced", bill.introducedDate || "Not reported"],
      ["Current status", bill.currentStatus || "Not reported"],
      ["Latest action", [bill.latestActionDate, bill.latestAction].filter(Boolean).join(" · ") || "Not reported"]
    );
  }

  if (detail.billEvidence?.latestSummary?.text) {
    linkedSections.push({
      eyebrow: "OFFICIAL SUMMARY",
      title: "Congressional Research Service bill summary",
      items: [{
        label: detail.billEvidence.latestSummary.versionCode || "Summary",
        title: "Latest available official summary",
        meta: [detail.billEvidence.latestSummary.date, detail.billEvidence.latestSummary.text].filter(Boolean).join(" · "),
        url: detail.bill?.officialUrl
      }],
      note: "This is an official Congress.gov summary, not Clarity's AI analysis. The bill text remains the controlling source."
    });
  }

  if (detail.billEvidence?.actions?.length) {
    linkedSections.push({
      eyebrow: "LEGISLATIVE HISTORY",
      title: `Official actions (${detail.billEvidence.actions.length})`,
      items: detail.billEvidence.actions.map((action) => ({
        label: action.type || "Action",
        title: action.text || "Congressional action",
        meta: action.date || "Date not reported",
        url: detail.bill?.officialUrl
      }))
    });
  }

  const officialVersions = detail.billEvidence?.textVersions || [];
  const officialTexts = officialVersions.flatMap((version) =>
    (version.formats || []).map((format) => ({
      label: format.type || "Text",
      title: version.type || "Official bill text",
      meta: [version.date || "Date not reported", format.preferred ? "Preferred readable source" : null].filter(Boolean).join(" · "),
      url: format.url
    }))
  );
  if (officialVersions.length || detail.billEvidence?.textCoverage?.partial) {
    const coverage = detail.billEvidence?.textCoverage || {};
    linkedSections.push({
      eyebrow: "PRIMARY TEXT",
      title: `Official bill text versions (${officialVersions.length})`,
      items: officialTexts.length ? officialTexts : [{ label: "Missing text", title: "No verified official bill-text format is available", meta: "The government source may not yet provide text for this measure.", url: null }],
      note: [
        `${officialTexts.length} file formats across ${officialVersions.length} published versions. Version and publication date matter: introduced, engrossed, and enrolled texts can differ.`,
        ...(coverage.warnings || []),
        "These are official links; Clarity may not have archived the full text bytes."
      ].join(" ")
    });
  }
  if (entity.entityType === "bill" && detail.aiTextVersionStatus && detail.aiTextVersionStatus !== "not_generated") {
    const freshness = detail.aiTextVersionStatus === "newer_version_available"
      ? "A newer official text version is available. Regenerate the AI explanation before relying on it."
      : detail.aiTextVersionStatus === "same_version_reference"
        ? "Analysis references the latest indexed version link; the text contents have not been independently reverified."
        : "Clarity cannot confirm whether the saved AI explanation uses the latest official version.";
    linkedSections.push({ eyebrow: "AI FRESHNESS", title: "Bill text version check", items: [
      { label: detail.aiTextVersionStatus === "newer_version_available" ? "Review needed" : "Version status", title: freshness, meta: "Compare linked official texts", url: detail.bill?.officialUrl || null }
    ], note: "A matching version link is not proof that the source text has remained unchanged." });
  }

  if (detail.financeSummary) {
    const finance = detail.financeSummary;
    fields.push(
      ["Election cycle", finance.cycle || "Not reported"],
      ["Office sought", finance.office || "Not reported"],
      ["Party", finance.party || "Not reported"],
      ["Candidate status", finance.incumbentStatus || "Not reported"],
      ["Reported receipts", formatCurrency(finance.receipts)],
      ["Reported spending", formatCurrency(finance.disbursements)],
      ["Cash on hand", formatCurrency(finance.cashOnHand)],
      ["Committee debt", formatCurrency(finance.debt)],
      ["Itemized individual contributions", formatCurrency(finance.itemizedIndividualContributions)],
      ["Coverage period", [finance.coverageStart, finance.coverageEnd].filter(Boolean).join(" — ") || "Not reported"]
    );
  }

  if (detail.committeeEvidence) {
    const committee = detail.committeeEvidence;
    fields.push(
      ["Committee category", committee.category || "Political committee"],
      ["Committee type", committee.type || detail.committee?.committeeType || "Not reported"],
      ["Designation", committee.designation || detail.committee?.designation || "Not reported"],
      ["Party", committee.party || detail.committee?.party || "Not reported"],
      ["Treasurer", committee.treasurer || detail.committee?.treasurer || "Not reported"],
      ["Filing frequency", committee.filingFrequency || "Not reported"],
      ["Filing history", [committee.firstFiled, committee.lastFiled].filter(Boolean).join(" — ") || "Not reported"]
    );
  }

  if (detail.receiptEvidence) {
    const receipt = detail.receiptEvidence;
    fields.push(
      ["Reported amount", formatCurrency(receipt.amount)],
      ["Contribution date", receipt.date?.slice(0, 10) || "Not reported"],
      ["Contributor employer", receipt.employer || "Not reported"],
      ["Contributor occupation", receipt.occupation || "Not reported"],
      ["Reported location", [receipt.city, receipt.state].filter(Boolean).join(", ") || "Not reported"],
      ["Filing amendment", receipt.amendmentIndicator || "Not reported"]
    );
  }

  if (detail.independentExpenditureEvidence) {
    const spending = detail.independentExpenditureEvidence;
    fields.push(
      ["Money channel", "Independent expenditure — not a candidate contribution"],
      ["Support / oppose", spending.position || "Not reported"],
      ["Reported amount", formatCurrency(spending.amount)],
      ["Expenditure date", spending.date?.slice(0, 10) || "Not reported"],
      ["Spending committee", spending.committeeName || "Not reported"],
      ["Candidate named", spending.candidateName || "Not reported"],
      ["Payee", spending.payee || "Not reported"],
      ["Purpose", spending.purpose || "Not reported"],
      ["Filing amendment", spending.amendmentIndicator || "Not reported"]
    );
  }

  if (detail.courtCase) {
    const courtCase = detail.courtCase;
    fields.push(
      ["Court", courtCase.court || "Not reported"],
      ["Docket number", courtCase.docketNumber || "Not reported"],
      ["Filed", courtCase.filedDate || "Not reported"],
      ["Terminated", courtCase.terminatedDate || "Open or not reported"],
      ["Case status", courtCase.caseStatus || "Not reported"],
      ["Nature of suit", courtCase.natureOfSuit || "Not reported"],
      ["Opinion status", courtCase.opinionStatus || "Not reported"]
    );
  }

  if (detail.legalLinks?.length) {
    linkedSections.push({
      eyebrow: "LEGAL DISCOVERY",
      title: `Possible court links (${detail.legalLinks.length})`,
      items: detail.legalLinks.map((link) => {
        const related = entity.entityType === "court_case" ? link.challengedRecord : link.case;
        return {
          label: humanize(link.challengeType),
          title: related?.canonicalName || "CourtListener docket match",
          meta: [
            link.legalQuestion,
            link.currentOutcome ? `Outcome: ${link.currentOutcome}` : "Outcome not established"
          ].filter(Boolean).join(" · "),
          recordId: related?.id,
          recordType: related?.entityType,
          kind: related ? humanize(related.entityType) : "Possible legal link"
        };
      }),
      note: "These are exact-query discovery matches from CourtListener. A complaint, order, opinion, or other docket filing must be reviewed before Clarity labels a match as a confirmed challenge."
    });
  }

  if (detail.candidacies?.length) {
    linkedSections.push({
      eyebrow: "ELECTION LINK",
      title: `Federal candidacies (${detail.candidacies.length})`,
      items: detail.candidacies.map((candidacy) => {
        const related = entity.entityType === "election" ? candidacy.candidate : candidacy.election;
        return {
          label: candidacy.status || "Reported",
          title: related?.canonicalName || candidacy.fecCandidateId || "Federal candidacy",
          meta: [candidacy.party, candidacy.incumbent ? "Incumbent" : null, candidacy.ballotStatus ? `Ballot: ${candidacy.ballotStatus}` : "FEC record; ballot status not established"].filter(Boolean).join(" · "),
          recordId: related?.id,
          recordType: related?.entityType,
          kind: related ? humanize(related.entityType) : "Election record"
        };
      }),
      note: "An FEC candidate filing does not by itself establish ballot qualification."
    });
  }

  const directReceipts = (detail.money || []).filter((transaction) => transaction.transactionType !== "independent_expenditure");
  const outsideSpending = (detail.money || []).filter((transaction) => transaction.transactionType === "independent_expenditure");

  if (directReceipts.length) {
    linkedSections.push({
      eyebrow: "MONEY TRAIL",
      title: `Itemized FEC receipts (${directReceipts.length})`,
      items: directReceipts.map((transaction) => ({
        label: formatCurrencyCents(transaction.amountCents),
        title: transaction.contribution?.canonicalName || `${transaction.contributor?.canonicalName || "Reported contributor"} → ${transaction.committee?.canonicalName || "recipient committee"}`,
        meta: [transaction.transactionDate, transaction.contributor?.description, transaction.memo].filter(Boolean).join(" · "),
        recordId: transaction.contribution?.id,
        recordType: "contribution",
        kind: "Contribution record",
        url: transaction.officialUrl
      })),
      note: "These are bounded, itemized Schedule A records. Committee linkage provides context; it does not prove donor intent, access, or influence."
    });
  }

  if (outsideSpending.length) {
    linkedSections.push({
      eyebrow: "OUTSIDE SPENDING",
      title: `Independent expenditures (${outsideSpending.length})`,
      items: outsideSpending.map((transaction) => ({
        label: formatCurrencyCents(transaction.amountCents),
        title: `${transaction.committee?.canonicalName || "Outside spender"} → ${transaction.candidate?.canonicalName || "named candidate"}`,
        meta: [transaction.transactionDate, transaction.contribution?.description, transaction.memo].filter(Boolean).join(" · "),
        recordId: transaction.contribution?.id,
        recordType: "independent_expenditure",
        kind: "Independent expenditure",
        url: transaction.officialUrl
      })),
      note: "Schedule E outside spending is not money given to a candidate. Support or opposition is shown exactly as reported; the filing does not prove coordination or influence."
    });
  }

  if (detail.recentVotes?.length) {
    linkedSections.push({
      eyebrow: "CROSS-LINKED RECORD",
      title: `Recent House votes (${detail.recentVotes.length})`,
      items: detail.recentVotes.map((vote) => ({
        label: vote.position,
        title: `Roll Call ${vote.rollNumber}: ${vote.question || "Recorded vote"}`,
        meta: [vote.voteDate, vote.description, vote.result ? `Outcome: ${vote.result}` : null].filter(Boolean).join(" · "),
        url: vote.officialUrl
      })),
      note: "These are recorded positions from the House Clerk, not a score or an inference about motive."
    });
  }

  if (detail.votePositions?.length) {
    const counts = positionCounts(detail.votePositions);
    Object.entries(counts).forEach(([position, total]) => fields.push([`${position} votes`, String(total)]));
    linkedSections.push({
      eyebrow: "INDIVIDUAL POSITIONS",
      title: `Recorded member votes (${detail.votePositions.length})`,
      items: detail.votePositions.slice(0, 24).map((position) => ({
        label: position.position,
        title: position.name,
        meta: [position.stateCode, position.district ? `District ${position.district}` : null].filter(Boolean).join(" · "),
        url: null
      })),
      note: detail.votePositions.length > 24
        ? `Showing 24 of ${detail.votePositions.length} positions here; the official roll-call link contains the complete list.`
        : "Complete recorded position list."
    });
  }

  if (detail.relatedVotes?.length) {
    linkedSections.push({
      eyebrow: "CROSS-LINKED RECORD",
      title: `House roll calls on this measure (${detail.relatedVotes.length})`,
      items: detail.relatedVotes.map((vote) => ({
        label: vote.result || "Recorded",
        title: `Roll Call ${vote.rollNumber}: ${vote.question || "Recorded vote"}`,
        meta: [vote.voteDate, vote.description].filter(Boolean).join(" · "),
        url: vote.officialUrl
      }))
    });
  }

  const linkedRelationships = (payload.relationships || [])
    .filter((relationship) => relationship.relatedEntity)
    .slice(0, 50);
  if (linkedRelationships.length) {
    linkedSections.push({
      eyebrow: "CLARITY GRAPH",
      title: `Connected records (${linkedRelationships.length})`,
      items: linkedRelationships.map((relationship) => ({
        label: humanize(relationship.relationshipType),
        title: relationship.relatedEntity.canonicalName,
        meta: [
          relationship.direction,
          relationship.description,
          relationship.amountCents != null ? formatCurrencyCents(relationship.amountCents) : null,
          relationship.evidenceClass ? `Evidence: ${humanize(relationship.evidenceClass)}` : null,
          relationship.sourceId ? `Source ID: ${relationship.sourceId}` : null
        ].filter(Boolean).join(" · "),
        evidenceUrl: (payload.evidence || []).find((source) => source.id === relationship.sourceId)?.url || null,
        recordId: relationship.relatedEntity.id,
        recordType: relationship.relatedEntity.entityType,
        kind: humanize(relationship.relatedEntity.entityType)
      })),
      note: "Every edge is stored with its direction, evidence class, confidence, and source record."
    });
  }

  if (payload.evidence?.length) {
    linkedSections.push({
      eyebrow: "SOURCE LEDGER",
      title: `Evidence records (${payload.evidence.length})`,
      items: payload.evidence.map((source) => ({
        label: humanize(source.sourceSystem),
        title: source.title,
        meta: [`Source ID: ${source.id}`, source.publisher, source.documentDate, source.retrievedAt ? `Retrieved ${new Date(source.retrievedAt).toLocaleString()}` : null].filter(Boolean).join(" · "),
        url: source.url
      })),
      note: "Open the publisher record to inspect the underlying evidence and dates."
    });
  }

  const identityItems = [
    ...(payload.identifiers || []).map((identifier) => ({
      label: humanize(identifier.sourceSystem),
      title: identifier.externalId,
      meta: `${identifier.isPrimary ? "Primary identifier" : "Linked identifier"}${identifier.verifiedAt ? ` · verified ${new Date(identifier.verifiedAt).toLocaleString()}` : ""}`,
      url: identifier.officialUrl
    })),
    ...(payload.aliases || []).map((alias) => ({
      label: humanize(alias.aliasType),
      title: alias.alias,
      meta: "Searchable name alias",
      url: null
    }))
  ];
  if (identityItems.length) {
    linkedSections.unshift({
      eyebrow: "IDENTITY",
      title: `Verified identifiers and aliases (${identityItems.length})`,
      items: identityItems,
      note: "Clarity uses source-specific identifiers before connecting records with similar names."
    });
  }

  if (payload.quality) {
    const quality = payload.quality;
    const evidenceSummary = Object.entries(quality.evidenceClasses || {})
      .map(([label, total]) => `${humanize(label)}: ${total}`)
      .join(" · ") || "No relationship evidence yet";
    linkedSections.push({
      eyebrow: "DATA QUALITY",
      title: "Coverage and evidence limits",
      items: [
        {
          label: "Coverage",
          title: `${quality.sourceCount || 0} sources · ${quality.relationshipCount || 0} relationships · ${quality.identifierCount || 0} identifiers`,
          meta: quality.latestSourceAt ? `Latest source snapshot: ${new Date(quality.latestSourceAt).toLocaleString()}` : "No source snapshot date is available.",
          url: null
        },
        {
          label: "Evidence classes",
          title: evidenceSummary,
          meta: "Source facts, contextual links, and analysis must remain distinguishable.",
          url: null
        },
        ...(quality.coverageNotes || []).slice(0, 4).map((note) => ({
          label: "Limitation",
          title: note,
          meta: "Publisher or ingestion coverage note",
          url: null
        }))
      ],
      note: "Missing data is shown as a limitation rather than silently treated as zero."
    });
  }

  const latestForCitations = (payload.analyses || [])
    .slice()
    .sort((a, b) => (b.analysisVersion || 0) - (a.analysisVersion || 0))[0];
  const citedFindings = (latestForCitations?.findings || []).map((finding) => {
      const citedSource = (payload.evidence || []).find((source) => source.id === finding.sourceId);
      return {
        label: analyticsLabel(finding.findingClass),
        title: `${analysisQuestionLabels[finding.promptKey] || humanize(finding.promptKey)} — ${citedSource?.title || "Evidence source not found"}`,
        meta: `AI generated · Source ID ${finding.sourceId || "missing"} · review the original record`,
        url: citedSource?.url || null
      };
    });
  if (citedFindings.length) {
    linkedSections.push({
      eyebrow: "AI CITATIONS",
      title: "Sources cited in the six-part explanation",
      items: citedFindings,
      note: "An AI citation identifies a source used in generation; it does not independently verify each claim. Re-check the cited text."
    });
  }

  const latestAnalysis = (payload.analyses || [])
    .slice()
    .sort((a, b) => (b.analysisVersion || 0) - (a.analysisVersion || 0))[0];
  const storedAnalysis = (latestAnalysis?.findings || []).map((finding) => [
      analysisQuestionLabels[finding.promptKey] || humanize(finding.promptKey),
      `${finding.findingText} Evidence: ${humanize(finding.findingClass)} · ${finding.sourceId || "source not recorded"}${finding.confidence != null ? ` · confidence ${Math.round(finding.confidence * 100)}%` : ""}.`
    ]);
  const analysis = storedAnalysis.length
    ? storedAnalysis
    : entity.entityType === "bill"
      ? [
          ["What changes?", "Pending source-grounded AI analysis of the official bill text and amendments."],
          ["Who benefits?", "Pending evidence-backed identification of direct and likely secondary beneficiaries."],
          ["Who pays or carries risk?", "Pending review of fiscal effects, compliance burdens, implementation duties, and affected communities."],
          ["Who backs or opposes it?", "Sponsors and cosponsors are shown as source facts. Funding, lobbying, and public positions still require separate evidence."],
          ["What could be challenged?", "Potential legal issues have not been analyzed. Filed lawsuits will be linked only when a reliable court source confirms them."],
          ["What remains uncertain?", "Official text and legislative history are available; interpretive analysis has not yet been generated or reviewed."]
        ]
      : undefined;

  if (latestAnalysis?.summary) {
    linkedSections.unshift({
      eyebrow: "AI EXPLANATION",
      title: `Source-grounded analysis · version ${latestAnalysis.analysisVersion}`,
      items: [
        {
          label: "Summary",
          title: latestAnalysis.summary,
          meta: [latestAnalysis.generatedAt ? `Generated ${new Date(latestAnalysis.generatedAt).toLocaleString()}` : null, latestAnalysis.modelName].filter(Boolean).join(" · "),
          url: null
        },
        {
          label: "Limits",
          title: latestAnalysis.limitations || "No limitation statement was stored.",
          meta: "AI analysis is explanatory and must be checked against the cited official sources.",
          url: null
        }
      ]
    });
  }

  return {
    ...record,
    title: entity.canonicalName || record.title,
    subtitle: entity.description || record.subtitle,
    sourceUrl: primaryIdentifier?.officialUrl || record.sourceUrl,
    fields,
    linkedSections,
    ...(analysis ? { analysis } : {}),
    analysisStatus: storedAnalysis.length ? "complete" : analysis ? "pending" : "questions",
    detailLoading: false,
    ...(entity.entityType === "bill" && detail.aiConfigured
      ? {
          analysisAction: {
            recordId: entity.id,
            label: storedAnalysis.length ? "Regenerate sourced AI analysis" : "Generate sourced AI analysis",
            note: "Owner-only. This reads the latest official bill text, answers all six Clarity questions, and saves the cited result."
          }
        }
      : {})
  };
}

async function openRecord(record) {
  dialog.dataset.recordId = record.id;
  renderRecordDialog({ ...record, detailLoading: Boolean(record.isDatabase) });
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  if (!record.isDatabase) return;

  try {
    const response = await fetch(`/api/records/${encodeURIComponent(record.id)}`, {
      headers: { accept: "application/json" }
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Record details are unavailable");
    if (dialog.dataset.recordId === record.id) renderRecordDialog(enrichDatabaseRecord(record, payload));
  } catch (error) {
    if (dialog.dataset.recordId === record.id) {
      renderRecordDialog({
        ...record,
        detailLoading: false,
        linkedSections: [{
          eyebrow: "DETAIL STATUS",
          title: "Cross-linked details could not be loaded",
          items: [{ label: "Notice", title: error.message, meta: "The search record remains available.", url: null }]
        }]
      });
    }
  }
}

function displayType(type) {
  if (type === "court-case") return "case";
  return type;
}

function mapDatabaseRecord(record) {
  const type = displayType(record.type);
  return {
    id: record.id,
    type,
    kind: record.kind,
    title: record.title,
    subtitle: record.subtitle || "Source-backed civic record.",
    tags: [record.type, record.sourceSystem, record.externalId, record.stateCode].filter(Boolean),
    connection: "Open evidence and connected records",
    sourceUrl: record.officialUrl,
    isDatabase: true,
    fields: [
      ["Record status", record.status || "available"],
      ["Jurisdiction", record.jurisdictionLevel || "federal"],
      ["Source system", record.sourceSystem || "Clarity database"],
      ["Source ID", record.externalId || "See linked evidence"],
      ["Last refreshed", record.updatedAt ? new Date(record.updatedAt).toLocaleString() : "Not reported"]
    ]
  };
}

function mapFederalOrder(document, retrievedAt) {
  const displayNumber = document.executiveOrderNumber
    ? `Executive Order ${document.executiveOrderNumber}`
    : "Executive order";
  return {
    id: `executive-order:${document.documentNumber}`,
    type: "executive-order",
    kind: "Executive order · Federal Register",
    title: `${displayNumber}: ${document.title}`,
    subtitle: document.abstract || "Official presidential document metadata from the Federal Register.",
    tags: ["executive order", document.title, document.executiveOrderNumber, document.documentNumber, document.president].filter(Boolean),
    connection: "Official Federal Register record",
    sourceUrl: document.htmlUrl,
    isLive: true,
    fields: [
      ["Document number", document.documentNumber],
      ["Executive order", document.executiveOrderNumber || "Not supplied"],
      ["Signed", document.signingDate || "Not supplied"],
      ["Published", document.publicationDate],
      ["President", document.president || "Not supplied in this result"],
      ["Retrieved", retrievedAt ? new Date(retrievedAt).toLocaleString() : "Just now"]
    ]
  };
}

function setConnectorDetail(id, status, readyText, pendingText) {
  const detail = document.querySelector(id);
  if (!detail) return;
  const ready = ["ready", "configured"].includes(status);
  detail.textContent = ready ? readyText : pendingText;
  detail.closest("article")?.classList.toggle("ready", ready);
  detail.closest("article")?.classList.toggle("pending", !ready);
}

async function loadStatus() {
  const health = document.querySelector("#data-health");
  const databaseDetail = document.querySelector("#database-detail");
  const searchCoverage = document.querySelector("#search-coverage");
  try {
    const response = await fetch("/api/status", { headers: { accept: "application/json" } });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || payload.database?.error || "Status check failed");

    const totals = payload.database.counts;
    connectorStatuses = payload.connectors || {};
    const recordCount = totals.entities;
    databaseDetail.textContent = `${recordCount.toLocaleString()} entities · ${(totals.politicians || 0).toLocaleString()} officials · ${(totals.candidates || 0).toLocaleString()} candidates · ${(totals.bills || 0).toLocaleString()} bills · ${(totals.moneyTransactions || 0).toLocaleString()} money records · ${(totals.independentExpenditures || 0).toLocaleString()} outside-spending records · ${(totals.courtCases || 0).toLocaleString()} court cases`;
    searchCoverage.textContent = `${recordCount.toLocaleString()} connected records · ${(totals.politicians || 0).toLocaleString()} officials · ${(totals.bills || 0).toLocaleString()} bills · ${(totals.executiveOrders || 0).toLocaleString()} executive orders`;
    databaseDetail.closest("article")?.classList.add("ready");
    health.textContent = "Database ready";
    health.className = "status-pill status-ready";

    setConnectorDetail("#federal-register-detail", payload.connectors.federalRegister.status, "Live API available", "Connection unavailable");
    setConnectorDetail("#house-clerk-detail", payload.connectors.houseClerk.status, "Member and vote feeds available", "Connection unavailable");
    setConnectorDetail("#congress-detail", payload.connectors.congress.status, "Protected key configured", "Waiting for a replacement key");
    setConnectorDetail("#fec-detail", payload.connectors.fec.status, "Protected key configured", "Waiting for a replacement key");
    setConnectorDetail("#ai-detail", payload.connectors.aiAnalysis.status, "Analysis provider configured", "AI generation not enabled yet");
    setConnectorDetail("#courtlistener-detail", payload.connectors.courtListener.status, "Docket search token configured", "CourtListener API token still needed");
  } catch (error) {
    health.textContent = "Database unavailable";
    health.className = "status-pill status-warning";
    databaseDetail.textContent = error.message;
    searchCoverage.textContent = "Official record coverage is temporarily unavailable.";
    databaseDetail.closest("article")?.classList.add("pending");
  }
}

function formatDashboardTime(value) {
  if (!value) return "Not yet";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function readableDataset(value) {
  return String(value || "unknown")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderCoverageDashboard(payload) {
  const alerts = document.querySelector("#coverage-alerts");
  const backfills = document.querySelector("#backfill-dashboard");
  const freshness = document.querySelector("#freshness-dashboard");
  const identitySummary = document.querySelector("#identity-review-summary");
  const identityList = document.querySelector("#identity-review-list");
  const recentRuns = document.querySelector("#recent-runs-dashboard");
  if (!alerts || !backfills || !freshness || !identitySummary || !identityList || !recentRuns) return;

  const warnings = [
    payload.alerts?.stalledJobs ? `${payload.alerts.stalledJobs} stalled job` : null,
    payload.alerts?.blockedJobs ? `${payload.alerts.blockedJobs} blocked job` : null,
    payload.alerts?.failedRecentRuns ? `${payload.alerts.failedRecentRuns} recent failed run` : null
  ].filter(Boolean);
  alerts.textContent = warnings.length
    ? `${warnings.join(" · ")}. Review the affected row before relying on its coverage.`
    : `No stalled or failed jobs. Checked ${formatDashboardTime(payload.checkedAt)}.`;
  alerts.classList.toggle("warning", warnings.length > 0);

  backfills.innerHTML = (payload.jobs || []).map((job) => {
    const state = job.stalled ? "stalled" : job.status;
    const cursor = job.cursor ? `Cursor ${job.cursor}` : "No cursor yet";
    const error = job.lastError ? ` · ${job.lastError}` : "";
    return `<div class="coverage-row">
      <strong>${escapeHtml(readableDataset(job.dataset))} · ${escapeHtml(job.scope || "default")}</strong>
      <span class="coverage-state ${escapeHtml(state)}">${escapeHtml(state)}</span>
      <small>${Number(job.batchesCompleted || 0).toLocaleString()} batches · ${Number(job.recordsSeen || 0).toLocaleString()} seen · ${Number(job.recordsWritten || 0).toLocaleString()} written · ${escapeHtml(cursor)} · updated ${escapeHtml(formatDashboardTime(job.updatedAt))}${escapeHtml(error)}</small>
    </div>`;
  }).join("") || '<div class="coverage-row"><strong>No backfill jobs yet</strong><small>The next scheduled run will create progress records.</small></div>';

  freshness.innerHTML = (payload.sourceFreshness || []).map((source) => `<div class="coverage-row">
    <strong>${escapeHtml(readableDataset(source.sourceSystem))}</strong>
    <span class="coverage-state">${Number(source.records || 0).toLocaleString()} records</span>
    <small>Latest retrieved ${escapeHtml(formatDashboardTime(source.latestRetrievedAt))}</small>
  </div>`).join("") || '<div class="coverage-row"><strong>No source records</strong><small>Run an official-record refresh.</small></div>';

  const reviewItems = payload.identityReview?.items || [];
  identitySummary.textContent = reviewItems.length
    ? `${reviewItems.length} possible duplicate identity group${reviewItems.length === 1 ? "" : "s"} need review. Ambiguous FEC candidates now remain separate instead of merging automatically.`
    : "No duplicate candidate/officeholder identity groups detected. Ambiguous matches remain separate automatically.";
  identityList.innerHTML = reviewItems.map((item) => `<span class="identity-review-item">${escapeHtml(item.normalizedName || "Unnamed")} · ${escapeHtml(item.stateCode || "no state")} · ${Number(item.matches || 0)} records</span>`).join("");

  recentRuns.innerHTML = (payload.recentRuns || []).slice(0, 8).map((run) => `<div class="coverage-row">
    <strong>${escapeHtml(readableDataset(run.sourceSystem))}</strong>
    <span class="coverage-state ${escapeHtml(run.status)}">${escapeHtml(run.status)}</span>
    <small>${Number(run.recordsSeen || 0).toLocaleString()} seen · ${Number(run.recordsWritten || 0).toLocaleString()} written · started ${escapeHtml(formatDashboardTime(run.startedAt))}${run.errorText ? ` · ${escapeHtml(run.errorText)}` : ""}</small>
  </div>`).join("") || '<div class="coverage-row"><strong>No recent runs</strong><small>Run an official-record refresh.</small></div>';
}

async function loadCoverageDashboard() {
  const button = document.querySelector("#coverage-refresh");
  const alerts = document.querySelector("#coverage-alerts");
  if (button) button.disabled = true;
  try {
    const response = await fetch("/api/admin/coverage", {
      headers: { accept: "application/json" },
      credentials: "same-origin",
      cache: "no-store"
    });
    const payload = await readJsonResponse(response, "Coverage dashboard");
    if (!response.ok) throw new Error(payload.error || "Coverage dashboard failed");
    renderCoverageDashboard(payload);
  } catch (error) {
    if (alerts) {
      alerts.textContent = error.message;
      alerts.classList.add("warning");
    }
  } finally {
    if (button) button.disabled = false;
  }
}

async function fetchLiveExecutiveOrders() {
  const response = await fetch("/api/executive-orders?per_page=12", {
    headers: { accept: "application/json" }
  });
  const payload = await readJsonResponse(response, "Federal Register request");
  if (!response.ok) throw new Error(payload.error || "Federal Register request failed");
  return payload.documents.map((document) => mapFederalOrder(document, payload.source?.retrievedAt));
}

async function readJsonResponse(response, label) {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  if (!contentType.toLowerCase().includes("application/json")) {
    const sessionHint = response.status === 401 || response.status === 403 || /sign[ -]?in|log[ -]?in/i.test(text);
    throw new Error(sessionHint
      ? `${label} needs a fresh sign-in. Reload the site, then try again.`
      : `${label} could not reach its data endpoint (HTTP ${response.status}).`);
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label} returned an unreadable response (HTTP ${response.status}).`);
  }
}

async function refreshOfficialRecords() {
  const resultSource = document.querySelector("#result-source");
  const query = search.value.trim();
  const requestId = ++searchRequestId;
  recordsLoading = true;
  renderRecords();
  resultSource.textContent = query ? `Searching official records for “${query}”…` : "Loading source-backed records…";

  let databaseRecords = [];
  let liveRecords = [];
  try {
    const requestedTypes = activeFilter === "election"
      ? ["candidate", "election"]
      : activeFilter === "money"
        ? ["contribution", "independent-expenditure"]
      : activeFilter === "all"
        ? [null]
        : [activeFilter === "case" ? "court-case" : activeFilter];
    const payloads = await Promise.all(requestedTypes.map(async (type) => {
      const params = new URLSearchParams({ limit: "24" });
      if (query) params.set("q", query);
      if (type) params.set("type", type);
      const response = await fetch(`/api/search?${params}`, { headers: { accept: "application/json" } });
      const payload = await readJsonResponse(response, "Search");
      if (!response.ok) throw new Error(payload.error || "Search failed");
      return payload.records;
    }));
    databaseRecords = payloads.flat().map(mapDatabaseRecord);
  } catch {
    databaseRecords = [];
  }

  if (!query && !databaseRecords.length && ["all", "executive-order"].includes(activeFilter)) {
    try {
      liveRecords = await fetchLiveExecutiveOrders();
    } catch {
      liveRecords = [];
    }
  }

  if (requestId !== searchRequestId) return;

  const byId = new Map();
  [...databaseRecords, ...liveRecords].forEach((record) => byId.set(record.id, record));
  officialRecords = [...byId.values()];
  rebuildRecords();
  recordsLoading = false;
  renderRecords();
  resultSource.textContent = databaseRecords.length
    ? "Official source-backed database records"
    : liveRecords.length
      ? "Official Federal Register records"
      : query
        ? `No official matches for “${query}”`
        : "No source-backed records are available in this view";
}

async function syncOfficialRecords() {
  const button = document.querySelector("#sync-records");
  const message = document.querySelector("#sync-message");
  button.disabled = true;
  const steps = [
    { label: "House members", url: "/api/ingest/house-members" },
    { label: "recent House votes", url: "/api/ingest/house-votes?limit=10" },
    { label: "executive orders", url: "/api/ingest/federal-register" },
    { label: "recent Congress.gov bills", url: "/api/ingest/congress?limit=5" },
    { label: "FEC candidates and itemized receipts", url: "/api/ingest/fec?limit=6" },
    { label: "FEC Super PAC and outside spending", url: "/api/ingest/fec-outside-spending?limit=24" }
  ];
  if (connectorStatuses.courtListener?.status === "configured") {
    steps.push({
      label: "CourtListener possible legal links",
      url: "/api/ingest/courtlistener?target_limit=4&case_limit=3"
    });
  }
  const completed = [];
  const failed = [];
  try {
    for (const [index, step] of steps.entries()) {
      message.textContent = `Refreshing ${step.label} (${index + 1} of ${steps.length})…`;
      try {
        const response = await fetch(step.url, {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json"
          },
          body: "{}",
          cache: "no-store",
          credentials: "same-origin"
        });
        const payload = await readJsonResponse(response, step.label);
        if (!response.ok) throw new Error(payload.error || "Import failed");
        completed.push(step.label);
      } catch (error) {
        failed.push(`${step.label}: ${error.message}`);
      }
    }
    await Promise.all([loadStatus(), loadCoverageDashboard(), refreshOfficialRecords()]);
    message.textContent = failed.length
      ? `Updated ${completed.length} of ${steps.length} sources. ${failed.join(" ")}`
      : `Updated ${completed.join(", ")}. Official source evidence and raw records were preserved.`;
  } finally {
    button.disabled = false;
  }
}

function setFilter(next) {
  activeFilter = next;
  document.querySelectorAll(".filter-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === activeFilter);
  });
  renderRecords();
  void refreshOfficialRecords();
}

function renderTrace() {
  const step = traceSteps[activeTrace];
  document.querySelectorAll(".trace-node").forEach((node, index) => node.classList.toggle("active", index === activeTrace));
  document.querySelector("#trace-number").textContent = `${String(activeTrace + 1).padStart(2, "0")} / ${String(traceSteps.length).padStart(2, "0")}`;
  document.querySelector("#trace-kicker").textContent = step.kicker;
  document.querySelector("#trace-title").textContent = step.title;
  document.querySelector("#trace-copy").textContent = step.copy;
  document.querySelector("#trace-evidence").textContent = step.evidence;
}

document.querySelector("#record-filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (button) setFilter(button.dataset.filter);
});

document.querySelector("#clear-filters").addEventListener("click", () => {
  search.value = "";
  setFilter("all");
  search.focus();
});

document.querySelector("#search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  clearTimeout(searchTimer);
  void refreshOfficialRecords();
  document.querySelector("#explore").scrollIntoView({ behavior: "smooth", block: "start" });
});

document.querySelectorAll("[data-example-search]").forEach((button) => {
  button.addEventListener("click", () => {
    search.value = button.dataset.exampleSearch;
    setFilter(button.dataset.exampleFilter || "all");
    document.querySelector("#explore").scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

search.addEventListener("input", () => {
  renderRecords();
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => void refreshOfficialRecords(), 250);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement !== search) {
    event.preventDefault();
    search.focus();
  }
  if (event.key === "Escape" && dialog.open) dialog.close();
});

grid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-record]");
  if (!card) return;
  const record = records.find((item) => item.id === card.dataset.record);
  if (record) void openRecord(record);
});

document.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
function renderGraphPaths(payload) {
  const paths = (payload.paths || []).slice(0, 36);
  const parts = paths.map((path, index) => {
    const hops = (path.hops || []).slice(0, 2);
    const trail = hops.map((hop) => {
      const url = safeOfficialUrl(hop.source?.url);
      const label = humanize(hop.type);
      const monetaryLabel = hop.amountCents != null
        ? hop.currency === "USD" ? `${formatCurrencyCents(hop.amountCents)} disclosed`
          : `${new Intl.NumberFormat("en-US", {maximumFractionDigits: 2}).format(hop.amountCents / 100)} ${hop.currency || "currency not reported"}`
        : null;
      const context = [hop.startDate, monetaryLabel].filter(Boolean).join(" · ");
      const contextual = hop.evidenceClass !== "source_fact" || String(hop.type).startsWith("potential_");
      const caveat = contextual ? " · contextual/potential connection" : "";
      const description = hop.description ? `<small>${escapeHtml(String(hop.description).slice(0, 250))}</small>` : "";
      return `<li><span>${escapeHtml(hop.direction === "incoming" ? "← " : "→ ")}${escapeHtml(label)} · ${escapeHtml(humanize(hop.evidenceClass))}${escapeHtml(caveat)}</span><small>${escapeHtml(context)}</small>${description}${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Evidence: ${escapeHtml(hop.source.publisher || hop.source.title)} ↗</a>` : ""}</li>`;
    }).join("");
    return `<li class="graph-result"><div class="graph-result-top"><span>${index + 1}. ${escapeHtml(humanize(path.node.entityType))}</span><button type="button" class="dialog-record-button" data-related-record="${escapeHtml(path.node.id)}" data-related-type="${escapeHtml(path.node.entityType)}" data-related-title="${escapeHtml(path.node.canonicalName)}" data-related-kind="${escapeHtml(humanize(path.node.entityType))}">${escapeHtml(path.node.canonicalName)} →</button></div><ol>${trail}</ol></li>`;
  }).join("");
  const clipped = payload.truncated ? `<p class="graph-warning">Partial network: additional relationships were not included in this bounded view.</p>` : "";
  return `${clipped}<p class="graph-count">${paths.length} distinct records reached. Paths are sourced and do not imply influence or wrongdoing.</p>${parts ? `<ol class="graph-path-list">${parts}</ol>` : `<p>No source-backed paths found in this bounded view.</p>`}<p class="graph-legal-note">${escapeHtml(payload.disclaimer || "These are documented links, not proof of causation.")}</p>`;
}

function renderCandidateFinance(payload) {
  const labels = {
    itemized_receipt: "Itemized committee receipts (imported sample)",
    outside_support: "Independent spending reported as support",
    outside_oppose: "Independent spending reported as opposition",
    outside_unreported: "Independent spending — position not reported",
    outside_conflicting: "Independent spending — inconsistent recorded positions",
  };
  const groups = (payload.groups || []).map((row) => `<li><span>${escapeHtml(labels[row.category] || "Other imported transaction")}</span><strong>${Number(row.records).toLocaleString()} records · ${escapeHtml(formatCurrencyCents(row.netCents))} net</strong></li>`).join("");
  const sourceLinks = (payload.sourceLinks || []).map((source) => {
    const url = safeOfficialUrl(source.url);
    return url ? `<li><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.sourceTitle || "FEC source")} ↗</a></li>` : "";
  }).join("");
  const statement = (payload.groups || []).length ? `<ul class="finance-category-list">${groups}</ul>` : "<p>No corresponding imported transactions for this date window. This does not mean the candidate received or spent no money.</p>";
  const dates = payload.period ? `${escapeHtml(payload.period.from)} through ${escapeHtml(payload.period.through)}` : "Selected period";
  return `<p class="dialog-section-intro">${dates} · Imported FEC transaction records only; not official totals.</p>${statement}${sourceLinks ? `<p>Original FEC filing sources:</p><ul class="finance-evidence-list">${sourceLinks}</ul>` : ""}<p class="dialog-legal-note">${escapeHtml((payload.limitations || []).join(" "))}</p>`;
}

dialog.addEventListener("click", (event) => {
  const jumpButton = event.target.closest("[data-dialog-jump]");
  if (jumpButton) {
    dialog.querySelector(`#${jumpButton.dataset.dialogJump}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const analysisButton = event.target.closest("[data-generate-analysis]");
  if (analysisButton) {
    const recordId = analysisButton.dataset.generateAnalysis;
    const status = dialog.querySelector("[data-analysis-status]");
    analysisButton.disabled = true;
    if (status) status.textContent = "Retrieving official bill text and generating the six-part analysis…";
    void (async () => {
      try {
        const response = await fetch(`/api/bills/${encodeURIComponent(recordId)}/analysis`, {
          method: "POST",
          headers: { accept: "application/json" },
          credentials: "same-origin"
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Analysis generation failed");
        if (status) status.textContent = "Analysis saved. Reloading the cited result…";
        const knownRecord = records.find((item) => item.id === recordId) || {
          id: recordId,
          type: "bill",
          kind: "Bill or law",
          title: "Bill analysis",
          subtitle: "Loading the saved source-grounded analysis…",
          tags: ["bill", "analysis"],
          connection: "Official text and cited AI explanation",
          isDatabase: true
        };
        await openRecord(knownRecord);
      } catch (error) {
        analysisButton.disabled = false;
        if (status) status.textContent = error.message;
      }
    })();
    return;
  }
  const financeButton = event.target.closest("[data-campaign-explore]");
  if (financeButton) {
    const results = dialog.querySelector("[data-campaign-results]");
    const selector = dialog.querySelector("[data-campaign-cycle]");
    const cycle = selector?.value || String(new Date().getUTCFullYear());
    financeButton.disabled = true;
    if (results) results.textContent = "Loading imported FEC finance records…";
    void (async () => {
      try {
        const url = `/api/analytics/campaign?candidate=${encodeURIComponent(financeButton.dataset.campaignExplore)}&cycle=${encodeURIComponent(cycle)}`;
        const response = await fetch(url, {headers:{accept:"application/json"},credentials:"same-origin"});
        const payload = await readJsonResponse(response, "Campaign finance");
        if (!response.ok) throw new Error(payload.error || "Finance summary unavailable");
        if (results && dialog.contains(results)) results.innerHTML = renderCandidateFinance(payload);
      } catch (error) {
        if (results && dialog.contains(results)) results.textContent = `Could not load campaign finance: ${error.message}`;
      } finally { financeButton.disabled = false; }
    })();
    return;
  }
  const graphButton = event.target.closest("[data-graph-explore]");
  if (graphButton) {
    const results = dialog.querySelector("[data-graph-results]");
    graphButton.disabled = true;
    if (results) results.textContent = "Loading documented paths and original evidence…";
    void (async () => {
      try {
        const url = `/api/graph/neighborhood?center=${encodeURIComponent(graphButton.dataset.graphExplore)}&depth=2`;
        const response = await fetch(url, { headers: { accept: "application/json" }, credentials: "same-origin" });
        const payload = await readJsonResponse(response, "Graph explorer");
        if (!response.ok) throw new Error(payload.error || "Graph unavailable");
        if (results && dialog.contains(results)) results.innerHTML = renderGraphPaths(payload);
      } catch (error) {
        if (results && dialog.contains(results)) results.textContent = `Could not load graph: ${error.message}`;
        graphButton.disabled = false;
      }
    })();
    return;
  }
  const relatedButton = event.target.closest("[data-related-record]");
  if (relatedButton) {
    const recordId = relatedButton.dataset.relatedRecord;
    const knownRecord = records.find((item) => item.id === recordId);
    const linkedRecord = knownRecord || {
      id: recordId,
      type: String(relatedButton.dataset.relatedType || "record").replaceAll("_", "-"),
      kind: relatedButton.dataset.relatedKind || "Linked record",
      title: relatedButton.dataset.relatedTitle || "Linked civic record",
      subtitle: "Loading source-backed details and connected evidence…",
      tags: [],
      connection: "Connected in the Clarity graph",
      isDatabase: true
    };
    void openRecord(linkedRecord);
    return;
  }
  const rect = dialog.getBoundingClientRect();
  const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  if (outside) dialog.close();
});

document.querySelector("#trace-path").addEventListener("click", (event) => {
  const node = event.target.closest("[data-step]");
  if (!node) return;
  activeTrace = Number(node.dataset.step);
  renderTrace();
});

document.querySelector("#next-trace").addEventListener("click", () => {
  activeTrace = (activeTrace + 1) % traceSteps.length;
  renderTrace();
});

const menuButton = document.querySelector(".menu-button");
const nav = document.querySelector("#site-nav");
menuButton.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", String(open));
});
nav.addEventListener("click", () => {
  nav.classList.remove("open");
  menuButton.setAttribute("aria-expanded", "false");
});

function openContainingDetails(hash) {
  if (!hash || hash === "#") return;
  const target = document.querySelector(hash);
  const details = target?.closest("details");
  if (details) details.open = true;
}

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", () => openContainingDetails(link.hash));
});
window.addEventListener("hashchange", () => openContainingDetails(window.location.hash));
openContainingDetails(window.location.hash);

function analyticsLabel(value) {
  return String(value || "unclassified").replaceAll("_", " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

async function loadPublicAnalytics() {
  const panel = document.querySelector("#analytics-grid");
  const limitations = document.querySelector("#analytics-limitations");
  if (!panel) return;
  panel.textContent = "Loading recorded data coverage…";
  try {
    const response = await fetch("/api/analytics/overview", { headers: { accept: "application/json" } });
    const payload = await readJsonResponse(response, "Public analytics");
    if (!response.ok) throw new Error(payload.error || "Analytics unavailable");

    const sections = [
      ["Records by type", payload.recordTypes, false],
      ["Relationship evidence", payload.relationshipEvidence, false],
      ["Recorded roll calls by chamber", payload.rollCallsByChamber, false],
      ["Recorded vote positions", payload.recordedVotePositions, false],
      ["Financial disclosures by type", payload.moneyByTransactionType, true],
      ["Source snapshots", payload.sourceSnapshots, false],
    ];
    panel.innerHTML = sections.map(([heading, rows, money]) => {
      const items = (rows || []).slice(0, 12).map((entry) => {
        const total = Number(entry.records || 0).toLocaleString();
        const net = money ? ` · ${(Number(entry.netCents) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} net recorded` : "";
        const date = entry.lastFetchedAt ? ` · latest retrieved ${formatDashboardTime(entry.lastFetchedAt)}` : "";
        return `<li><span>${escapeHtml(analyticsLabel(entry.key))}</span><strong>${escapeHtml(total)}${escapeHtml(net)}</strong>${date ? `<small>${escapeHtml(date)}</small>` : ""}</li>`;
      }).join("");
      return `<section class="analytics-card"><h4>${escapeHtml(heading)}</h4><ul>${items || "<li>No records ingested in this category.</li>"}</ul></section>`;
    }).join("");
    limitations.textContent = (payload.limitations || []).join(" ");
  } catch (error) {
    panel.textContent = `Coverage analytics could not be loaded: ${error.message}`;
  }
}

document.querySelector("#sync-records").addEventListener("click", () => void syncOfficialRecords());
document.querySelector("#coverage-refresh")?.addEventListener("click", () => void loadCoverageDashboard());
document.querySelector("#public-analytics")?.addEventListener("toggle", (event) => {
  if (event.currentTarget.open) void loadPublicAnalytics();
});
document.querySelector("#data-status")?.addEventListener("toggle", (event) => {
  if (event.currentTarget.open) void loadCoverageDashboard();
});

document.querySelector("#year").textContent = new Date().getFullYear();
renderRecords();
renderTrace();
void Promise.allSettled([loadStatus(), refreshOfficialRecords()]);
