// Sample schema evolution scenarios.
// Each scenario includes a diff and a downstream dependency map.
const SCENARIOS = [
  {
    id: "order_placed_v2",
    label: "OrderPlaced v1 → v2",
    description:
      "OrderPlaced event adds channel metadata, removes a legacy field, and tightens amount semantics.",
    riskLevel: "high",
    diff: {
      added: [
        "order_channel: string (optional) – source of the order (web, api, partner)",
        "discount_code: string (optional) – human-readable discount code applied"
      ],
      removed: [
        "legacy_coupon_id: string – deprecated coupon reference no longer emitted"
      ],
      changed: [
        {
          field: "total_amount",
          from: "number – integer in minor currency units",
          to: "number – decimal in major currency units, coupled to currency_code",
          impact: "breaking"
        },
        {
          field: "status",
          from: 'enum("PENDING", "PAID", "CANCELLED")',
          to: 'enum("PENDING", "AUTHORIZED", "CAPTURED", "CANCELLED")',
          impact: "medium"
        }
      ]
    },
    nodes: [
      {
        id: "order-service",
        name: "Order Service",
        role: "Producer · emits OrderPlaced",
        impactLevel: "low",
        impactSummary: "Backwards-compatible for itself; owns v2 rollout.",
        fieldsImpacted: ["total_amount", "status", "order_channel", "discount_code"],
        issues: [
          "Must emit both minor/major-compatible data during migration window if consumers lag."
        ]
      },
      {
        id: "event-bus",
        name: "Event Bus",
        role: "Pipeline · routes events",
        impactLevel: "low",
        impactSummary:
          "Pass-through routing; only impacted if filtering on removed fields.",
        fieldsImpacted: ["legacy_coupon_id"],
        issues: [
          "Verify no routing rules or filters depend on legacy_coupon_id."
        ]
      },
      {
        id: "billing-service",
        name: "Billing Service",
        role: "Consumer · invoices orders",
        impactLevel: "high",
        impactSummary:
          "Assumes integer minor units for total_amount; v2 decimal representation breaks calculations.",
        fieldsImpacted: ["total_amount", "status"],
        issues: [
          "Adjust amount handling to support decimal major units.",
          "Update billing status mapping for AUTHORIZED vs CAPTURED."
        ]
      },
      {
        id: "inventory-service",
        name: "Inventory Service",
        role: "Consumer · reserves stock",
        impactLevel: "medium",
        impactSummary:
          "Depends on status semantics when reserving vs releasing stock.",
        fieldsImpacted: ["status", "order_channel"],
        issues: [
          "Ensure new AUTHORIZED/CAPTURED states do not skip reservation flows.",
          "Confirm channel-specific inventory rules if they exist."
        ]
      },
      {
        id: "analytics-warehouse",
        name: "Analytics Warehouse",
        role: "Consumer · reporting & attribution",
        impactLevel: "high",
        impactSummary:
          "Relies on legacy_coupon_id and minor-unit amounts; both change in v2.",
        fieldsImpacted: ["total_amount", "legacy_coupon_id", "discount_code", "order_channel"],
        issues: [
          "Backfill logic required for legacy_coupon_id usage.",
          "Reconcile historical minor-unit amounts with new major-unit representation.",
          "Adopt new discount_code + channel dimensions."
        ]
      }
    ],
    // Dependency paths are simple flows from producers through pipelines to consumers.
    paths: [
      ["order-service", "event-bus", "billing-service", "analytics-warehouse"],
      ["order-service", "event-bus", "inventory-service"],
      ["order-service", "analytics-warehouse"]
    ]
  },
  {
    id: "user_profile_v2",
    label: "UserProfileUpdated v1 → v2",
    description:
      "UserProfileUpdated event introduces stricter PII handling and refactors location fields.",
    riskLevel: "medium",
    diff: {
      added: [
        "country_code: string (ISO-3166-1 alpha-2) – normalized country",
        "profile_version: integer – monotonic user profile schema version"
      ],
      removed: [
        "raw_location: string – free-form user-entered location field"
      ],
      changed: [
        {
          field: "email",
          from: "string – optional, may be null",
          to: "string – required for active accounts, PII-tagged",
          impact: "medium"
        }
      ]
    },
    nodes: [
      {
        id: "identity-service",
        name: "Identity Service",
        role: "Producer · user identities",
        impactLevel: "low",
        impactSummary:
          "Owns v2 schema; must emit PII tags and version increments consistently.",
        fieldsImpacted: ["email", "country_code", "profile_version", "raw_location"],
        issues: [
          "Ensure profile_version increments on structural changes.",
          "Stop emitting raw_location once all consumers migrate."
        ]
      },
      {
        id: "cdc-pipeline",
        name: "CDC Pipeline",
        role: "Pipeline · change data capture",
        impactLevel: "low",
        impactSummary:
          "Streams changes; impacted only if filtering on removed raw_location.",
        fieldsImpacted: ["raw_location"],
        issues: [
          "Verify filters and projections do not depend on raw_location."
        ]
      },
      {
        id: "marketing-platform",
        name: "Marketing Platform",
        role: "Consumer · campaigns & segmentation",
        impactLevel: "medium",
        impactSummary:
          "Uses email and raw_location for targeting; must migrate to country_code.",
        fieldsImpacted: ["email", "raw_location", "country_code"],
        issues: [
          "Update segmentation to use country_code instead of raw_location.",
          "Ensure email required-ness aligns with consent & compliance rules."
        ]
      },
      {
        id: "fraud-service",
        name: "Fraud Service",
        role: "Consumer · risk scoring",
        impactLevel: "medium",
        impactSummary:
          "Relies on profile_version to understand risk model compatibility.",
        fieldsImpacted: ["profile_version", "country_code"],
        issues: [
          "Use profile_version to gate features that depend on new fields.",
          "Handle missing country_code during rollout."
        ]
      },
      {
        id: "data-lake",
        name: "Data Lake",
        role: "Consumer · long-term storage",
        impactLevel: "low",
        impactSummary:
          "Stores both v1 and v2 events; schema-on-read tooling must handle evolution.",
        fieldsImpacted: ["email", "country_code", "profile_version", "raw_location"],
        issues: [
          "Update table schemas and readers for new country_code + profile_version.",
          "Maintain explicit mapping of legacy raw_location usage."
        ]
      }
    ],
    paths: [
      ["identity-service", "cdc-pipeline", "marketing-platform"],
      ["identity-service", "cdc-pipeline", "fraud-service"],
      ["identity-service", "cdc-pipeline", "data-lake"]
    ]
  },
  {
    id: "invoice_issued_v2",
    label: "InvoiceIssued v1 → v2",
    description:
      "InvoiceIssued event tightens enum values and introduces a new required due_date field.",
    riskLevel: "medium",
    diff: {
      added: [
        "due_date: string (ISO-8601, date) – invoice payment due date"
      ],
      removed: [],
      changed: [
        {
          field: "status",
          from: 'enum("DRAFT", "SENT", "PAID", "VOID")',
          to: 'enum("DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "VOID")',
          impact: "medium"
        }
      ]
    },
    nodes: [
      {
        id: "billing-core",
        name: "Billing Core",
        role: "Producer · issues invoices",
        impactLevel: "low",
        impactSummary:
          "Owns status semantics and due_date; compatible with both internal and external consumers.",
        fieldsImpacted: ["status", "due_date"],
        issues: [
          "Ensure all newly issued invoices include due_date."
        ]
      },
      {
        id: "notification-service",
        name: "Notification Service",
        role: "Consumer · sends invoice emails",
        impactLevel: "medium",
        impactSummary:
          "Uses status and due_date to drive reminder cadence.",
        fieldsImpacted: ["status", "due_date"],
        issues: [
          "Add logic for PARTIALLY_PAID status.",
          "Support new reminder rules based on due_date."
        ]
      },
      {
        id: "collections-system",
        name: "Collections System",
        role: "Consumer · handles overdue invoices",
        impactLevel: "medium",
        impactSummary:
          "Relies heavily on due_date semantics; breaking if missing.",
        fieldsImpacted: ["status", "due_date"],
        issues: [
          "Guard against missing due_date during rollout.",
          "Update workflows for PARTIALLY_PAID invoices."
        ]
      },
      {
        id: "finance-warehouse",
        name: "Finance Warehouse",
        role: "Consumer · financial reporting",
        impactLevel: "low",
        impactSummary:
          "Consumes all fields; strongly prefers explicit due_date but can compute fallback.",
        fieldsImpacted: ["status", "due_date"],
        issues: [
          "Backfill due_date for historical invoices where possible.",
          "Update reports to distinguish PARTIALLY_PAID from PAID."
        ]
      }
    ],
    paths: [
      ["billing-core", "notification-service"],
      ["billing-core", "collections-system", "finance-warehouse"]
    ]
  }
];

const IMPACT_LABELS = {
  low: "Low impact",
  medium: "Medium impact",
  high: "High impact"
};

let currentScenario = null;
let currentSelectedNodeId = null;

function init() {
  const select = document.getElementById("scenario-select");
  const descriptionEl = document.getElementById("scenario-description");
  const summaryBadge = document.getElementById("summary-badge");
  const diffCard = document.getElementById("diff-card");
  const mapContainer = document.getElementById("dependency-map");
  const detailsCard = document.getElementById("details-card");

  // Populate dropdown
  SCENARIOS.forEach((scenario, index) => {
    const option = document.createElement("option");
    option.value = scenario.id;
    option.textContent = scenario.label;
    if (index === 0) option.selected = true;
    select.appendChild(option);
  });

  // Render initial scenario if present
  if (SCENARIOS.length > 0) {
    currentScenario = SCENARIOS[0];
    renderScenario(
      currentScenario,
      descriptionEl,
      summaryBadge,
      diffCard,
      mapContainer,
      detailsCard
    );
  }

  select.addEventListener("change", () => {
    const selectedId = select.value;
    const scenario = SCENARIOS.find((s) => s.id === selectedId);
    if (!scenario) return;
    currentScenario = scenario;
    currentSelectedNodeId = null;
    renderScenario(
      scenario,
      descriptionEl,
      summaryBadge,
      diffCard,
      mapContainer,
      detailsCard
    );
  });
}

function renderScenario(
  scenario,
  descriptionEl,
  summaryBadge,
  diffCard,
  mapContainer,
  detailsCard
) {
  descriptionEl.textContent = scenario.description;

  const analysis = analyzeScenario(scenario);

  // Summary badge
  summaryBadge.className = "summary-badge";
  summaryBadge.classList.add(`summary-badge-${scenario.riskLevel || "low"}`);
  summaryBadge.innerHTML = `
    <span class="count">${analysis.breakingCount} breaking consumer${
      analysis.breakingCount === 1 ? "" : "s"
    }</span>
    · ${IMPACT_LABELS[scenario.riskLevel || "low"]}
    · ${analysis.changedFieldsCount} field change${
      analysis.changedFieldsCount === 1 ? "" : "s"
    } across v1 → v2
  `;

  // Diff card
  renderDiffCard(scenario, diffCard);

  // Dependency map
  renderDependencyMap(scenario, mapContainer, detailsCard);

  // Default details
  renderDefaultDetails(scenario, detailsCard, analysis);
}

// Compute simple scenario metrics.
function analyzeScenario(scenario) {
  const nodes = scenario.nodes || [];
  const diff = scenario.diff || {};
  const changedFieldsCount =
    (diff.added ? diff.added.length : 0) +
    (diff.removed ? diff.removed.length : 0) +
    (diff.changed ? diff.changed.length : 0);

  let breakingCount = 0;
  nodes.forEach((node) => {
    if (node.impactLevel === "high") breakingCount++;
  });

  return {
    changedFieldsCount,
    breakingCount
  };
}

function renderDiffCard(scenario, diffCard) {
  const diff = scenario.diff || {};
  diffCard.innerHTML = "";

  const header = document.createElement("div");
  header.className = "diff-header";

  const title = document.createElement("p");
  title.className = "diff-title";
  title.textContent = `Schema Change Summary: v1 → v2`;

  const meta = document.createElement("p");
  meta.className = "diff-meta";
  const addedCount = diff.added ? diff.added.length : 0;
  const removedCount = diff.removed ? diff.removed.length : 0;
  const changedCount = diff.changed ? diff.changed.length : 0;
  meta.textContent = `${addedCount} added · ${removedCount} removed · ${changedCount} changed`;

  header.appendChild(title);
  header.appendChild(meta);
  diffCard.appendChild(header);

  const versions = document.createElement("div");
  versions.className = "diff-versions";

  const v1Column = document.createElement("div");
  v1Column.className = "diff-column";
  v1Column.innerHTML = `
    <p class="diff-column-title">Version 1 (Current)</p>
    <div class="diff-field-group">
      <div class="diff-field-group-label">Removed in v2</div>
      <ul class="diff-field-list">
        ${
          diff.removed && diff.removed.length
            ? diff.removed
                .map(
                  (item) =>
                    `<li class="diff-field diff-field-breaking">${item}</li>`
                )
                .join("")
            : '<li class="diff-field">—</li>'
        }
      </ul>
    </div>
  `;

  const v2Column = document.createElement("div");
  v2Column.className = "diff-column";

  const changedItems =
    diff.changed && diff.changed.length
      ? diff.changed
      : [];

  v2Column.innerHTML = `
    <p class="diff-column-title">Version 2 (Proposed)</p>
    <div class="diff-field-group">
      <div class="diff-field-group-label">Added fields</div>
      <ul class="diff-field-list">
        ${
          diff.added && diff.added.length
            ? diff.added
                .map(
                  (item) =>
                    `<li class="diff-field diff-field-nonbreaking">${item}</li>`
                )
                .join("")
            : '<li class="diff-field">—</li>'
        }
      </ul>
    </div>
    <div class="diff-field-group">
      <div class="diff-field-group-label">Changed fields</div>
      <ul class="diff-field-list">
        ${
          changedItems.length
            ? changedItems
                .map((c) => {
                  const cls =
                    c.impact === "breaking"
                      ? "diff-field-breaking"
                      : "diff-field-nonbreaking";
                  return `<li class="diff-field ${cls}">${c.field}: ${c.from} → ${c.to}</li>`;
                })
                .join("")
            : '<li class="diff-field">—</li>'
        }
      </ul>
    </div>
  `;

  versions.appendChild(v1Column);
  versions.appendChild(v2Column);

  diffCard.appendChild(versions);
}

function renderDependencyMap(scenario, mapContainer, detailsCard) {
  mapContainer.innerHTML = "";

  const nodesById = {};
  (scenario.nodes || []).forEach((node) => {
    nodesById[node.id] = node;
  });

  const header = document.createElement("div");
  header.className = "dependency-map-header";

  const title = document.createElement("p");
  title.className = "dependency-map-title";
  title.textContent = "Downstream Dependency Paths";

  const note = document.createElement("p");
  note.className = "dependency-map-note";
  note.textContent =
    "Each row is a path from producer to consumers. Click a node to see its impact.";

  header.appendChild(title);
  header.appendChild(note);
  mapContainer.appendChild(header);

  const pathsContainer = document.createElement("div");
  pathsContainer.className = "dependency-paths";

  (scenario.paths || []).forEach((path) => {
    const pathEl = document.createElement("div");
    pathEl.className = "dependency-path";

    path.forEach((nodeId, index) => {
      const node = nodesById[nodeId];
      if (!node) return;

      const nodeEl = document.createElement("div");
      nodeEl.className = "service-node";

      const levelClass = `service-node-${node.impactLevel || "low"}`;
      nodeEl.classList.add(levelClass);
      nodeEl.dataset.nodeId = node.id;

      const nameEl = document.createElement("div");
      nameEl.className = "service-node-name";
      nameEl.textContent = node.name;

      const roleEl = document.createElement("div");
      roleEl.className = "service-node-role";
      roleEl.textContent = node.role;

      const pill = document.createElement("span");
      pill.className = "service-node-impact-pill";
      pill.classList.add(`service-node-impact-${node.impactLevel || "low"}`);
      pill.textContent = IMPACT_LABELS[node.impactLevel || "low"] || "Low impact";

      nodeEl.appendChild(nameEl);
      nodeEl.appendChild(roleEl);
      nodeEl.appendChild(pill);

      nodeEl.addEventListener("click", () => {
        currentSelectedNodeId = node.id;
        highlightSelectedNode(mapContainer, node.id);
        renderNodeDetails(node, scenario, detailsCard);
      });

      pathEl.appendChild(nodeEl);

      if (index < path.length - 1) {
        const arrow = document.createElement("span");
        arrow.className = "connector-arrow";
        arrow.textContent = "→";
        pathEl.appendChild(arrow);
      }
    });

    pathsContainer.appendChild(pathEl);
  });

  mapContainer.appendChild(pathsContainer);
}

function highlightSelectedNode(mapContainer, selectedId) {
  const allNodes = mapContainer.querySelectorAll(".service-node");
  allNodes.forEach((el) => {
    if (el.dataset.nodeId === selectedId) {
      el.classList.add("service-node-selected");
    } else {
      el.classList.remove("service-node-selected");
    }
  });
}

function renderDefaultDetails(scenario, detailsCard, analysis) {
  detailsCard.innerHTML = "";

  const title = document.createElement("h3");
  title.textContent = "Impact Details";
  detailsCard.appendChild(title);

  const meta = document.createElement("p");
  meta.className = "details-meta";
  meta.textContent = `${scenario.nodes.length} downstream services and pipelines observed.`;
  detailsCard.appendChild(meta);

  const section = document.createElement("div");
  section.className = "details-section";

  const h4 = document.createElement("h4");
  h4.textContent = "How to interpret this map";
  section.appendChild(h4);

  const p = document.createElement("p");
  p.textContent =
    "Use the schema change summmary to understand what changed between v1 and v2, then click nodes in the dependency map to see which fields break each consumer and where coordination is required.";
  section.appendChild(p);

  detailsCard.appendChild(section);
}

function renderNodeDetails(node, scenario, detailsCard) {
  detailsCard.innerHTML = "";

  const title = document.createElement("h3");
  title.textContent = node.name;
  detailsCard.appendChild(title);

  const meta = document.createElement("p");
  meta.className = "details-meta";
  meta.textContent = `${node.role} · ${IMPACT_LABELS[node.impactLevel || "low"]}`;
  detailsCard.appendChild(meta);

  const summarySection = document.createElement("div");
  summarySection.className = "details-section";
  const summaryTitle = document.createElement("h4");
  summaryTitle.textContent = "Impact Summary";
  const summaryBody = document.createElement("p");
  summaryBody.textContent = node.impactSummary || "No specific impact noted.";
  summarySection.appendChild(summaryTitle);
  summarySection.appendChild(summaryBody);
  detailsCard.appendChild(summarySection);

  const fieldsSection = document.createElement("div");
  fieldsSection.className = "details-section";
  const fieldsTitle = document.createElement("h4");
  fieldsTitle.textContent = "Fields affected by v2";
  fieldsSection.appendChild(fieldsTitle);

  const fieldsList = document.createElement("ul");
  if (node.fieldsImpacted && node.fieldsImpacted.length) {
    node.fieldsImpacted.forEach((field) => {
      const li = document.createElement("li");
      li.textContent = field;
      fieldsList.appendChild(li);
    });
  } else {
    const li = document.createElement("li");
    li.textContent = "None identified in sample.";
    fieldsList.appendChild(li);
  }
  fieldsSection.appendChild(fieldsList);
  detailsCard.appendChild(fieldsSection);

  const issuesSection = document.createElement("div");
  issuesSection.className = "details-section";
  const issuesTitle = document.createElement("h4");
  issuesTitle.textContent = "Upgrade & Coordination Notes";
  issuesSection.appendChild(issuesTitle);

  const issuesList = document.createElement("ul");
  if (node.issues && node.issues.length) {
    node.issues.forEach((issue) => {
      const li = document.createElement("li");
      li.textContent = issue;
      issuesList.appendChild(li);
    });
  } else {
    const li = document.createElement("li");
    li.textContent = "No specific coordination requirements captured.";
    issuesList.appendChild(li);
  }
  issuesSection.appendChild(issuesList);
  detailsCard.appendChild(issuesSection);
}

document.addEventListener("DOMContentLoaded", init);
