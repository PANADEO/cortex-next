import type {
  PackageRuleAttachment,
  RuleCategory,
  RuleDetailsResponse,
  RuleReadModel,
  RuleStatus,
  RuleTemplateReadModel,
  RuleTrigger,
  RuleVersionReadModel,
} from "@cortex/types"

interface RuleSeed {
  id: string
  name: string
  description: string
  category: RuleCategory
  status: RuleStatus
  tags: string[]
  customer_tag: string | null
  trigger: RuleTrigger
  nl_definition: string
  python_code: string
  output_columns: { name: string; description: string; data_type: "string" | "number" }[]
}

const RULES: RuleSeed[] = [
  {
    id: "rule-0001",
    name: "Allocate freight by net weight",
    description: "Distributes total freight cost across invoice lines proportionally to net weight.",
    category: "transport_allocation",
    status: "active",
    tags: ["transport", "cost", "weight"],
    customer_tag: "Acme Corp",
    trigger: "auto_on_extraction",
    nl_definition: "Rozdziel koszt frachtu z transport_info.cost proporcjonalnie do wagi netto każdej pozycji faktury.",
    python_code: [
      "def apply(lines, transport_info):",
      "    total_weight = sum(float(l.get('net_weight_kg') or 0) for l in lines)",
      "    freight = float(transport_info.get('cost') or 0)",
      "    for line in lines:",
      "        share = float(line.get('net_weight_kg') or 0) / total_weight if total_weight else 0",
      "        line['freight_share'] = round(freight * share, 2)",
      "    return lines",
    ].join("\n"),
    output_columns: [
      { name: "freight_share", description: "Allocated freight portion (currency of transport).", data_type: "number" },
    ],
  },
  {
    id: "rule-0002",
    name: "Aggregate weight per CN code",
    description: "Groups lines by CN code and emits totals (net weight, gross weight, value).",
    category: "aggregation",
    status: "active",
    tags: ["customs", "cn-code"],
    customer_tag: null,
    trigger: "manual",
    nl_definition: "Pogrupuj pozycje po cn_code i policz sumy net_weight_kg, gross_weight_kg, invoice_value.",
    python_code: [
      "def apply(lines):",
      "    groups = {}",
      "    for line in lines:",
      "        cn = line.get('cn_code') or 'UNKNOWN'",
      "        g = groups.setdefault(cn, {'cn_code': cn, 'net_weight_kg': 0, 'gross_weight_kg': 0, 'invoice_value': 0})",
      "        g['net_weight_kg'] += float(line.get('net_weight_kg') or 0)",
      "        g['gross_weight_kg'] += float(line.get('gross_weight_kg') or 0)",
      "        g['invoice_value'] += float(line.get('invoice_value') or 0)",
      "    return list(groups.values())",
    ].join("\n"),
    output_columns: [
      { name: "cn_code", description: "Customs nomenclature code.", data_type: "string" },
      { name: "net_weight_kg", description: "Sum of net weights per CN.", data_type: "number" },
      { name: "gross_weight_kg", description: "Sum of gross weights per CN.", data_type: "number" },
      { name: "invoice_value", description: "Sum of invoice value per CN.", data_type: "number" },
    ],
  },
  {
    id: "rule-0003",
    name: "Convert invoice currency to PLN",
    description: "Adds a PLN-equivalent column using NBP exchange rate from invoice date.",
    category: "currency",
    status: "active",
    tags: ["fx", "pln"],
    customer_tag: null,
    trigger: "auto_on_extraction",
    nl_definition: "Dodaj kolumnę invoice_value_pln używając kursu NBP z daty faktury.",
    python_code: [
      "def apply(lines, invoice, fx):",
      "    rate = fx.get_rate(invoice['currency'], 'PLN', invoice['invoice_date'])",
      "    for line in lines:",
      "        line['invoice_value_pln'] = round(float(line.get('invoice_value') or 0) * rate, 2)",
      "    return lines",
    ].join("\n"),
    output_columns: [
      { name: "invoice_value_pln", description: "Line value converted to PLN.", data_type: "number" },
    ],
  },
  {
    id: "rule-0004",
    name: "Derive gross from net + packaging",
    description: "Fills missing gross weight using net + packaging weight when available.",
    category: "weight_derivation",
    status: "draft",
    tags: ["weight"],
    customer_tag: null,
    trigger: "manual",
    nl_definition: "Jeśli gross_weight_kg jest pusty, policz go jako net_weight_kg + packaging.weight_kg.",
    python_code: [
      "def apply(lines):",
      "    for line in lines:",
      "        if not line.get('gross_weight_kg'):",
      "            net = float(line.get('net_weight_kg') or 0)",
      "            pkg = float((line.get('packaging') or {}).get('weight_kg') or 0)",
      "            line['gross_weight_kg'] = round(net + pkg, 3)",
      "    return lines",
    ].join("\n"),
    output_columns: [
      { name: "gross_weight_kg", description: "Derived gross weight.", data_type: "number" },
    ],
  },
  {
    id: "rule-0005",
    name: "VLOOKUP CN → Polish description",
    description: "Fills polish_cn_name from CN code dictionary.",
    category: "lookup",
    status: "active",
    tags: ["customs", "translation"],
    customer_tag: null,
    trigger: "manual",
    nl_definition: "Dla każdej pozycji weź cn_code i znajdź polską nazwę w słowniku CN_PL, wypełnij polish_cn_name.",
    python_code: [
      "def apply(lines, lookup):",
      "    table = lookup.table('cn_pl')",
      "    for line in lines:",
      "        line['polish_cn_name'] = table.get(line.get('cn_code'), '')",
      "    return lines",
    ].join("\n"),
    output_columns: [
      { name: "polish_cn_name", description: "Polish CN description.", data_type: "string" },
    ],
  },
  {
    id: "rule-0006",
    name: "Split bulk line by HS code",
    description: "Splits aggregated lines into one row per HS code with proportional values.",
    category: "split",
    status: "draft",
    tags: ["hs-code", "split"],
    customer_tag: "Müller GmbH",
    trigger: "manual",
    nl_definition: "Jeśli pozycja ma listę hs_codes z udziałami, rozdziel ją na osobne wiersze proporcjonalnie do udziałów.",
    python_code: [
      "def apply(lines):",
      "    out = []",
      "    for line in lines:",
      "        hs = line.get('hs_breakdown')",
      "        if not hs:",
      "            out.append(line)",
      "            continue",
      "        for entry in hs:",
      "            new_line = dict(line)",
      "            new_line['hs_code'] = entry['hs_code']",
      "            new_line['invoice_value'] = round(float(line.get('invoice_value') or 0) * entry['share'], 2)",
      "            new_line['net_weight_kg'] = round(float(line.get('net_weight_kg') or 0) * entry['share'], 3)",
      "            out.append(new_line)",
      "    return out",
    ].join("\n"),
    output_columns: [
      { name: "hs_code", description: "Specific HS code per split row.", data_type: "string" },
    ],
  },
]

export const RULE_TEMPLATES: RuleTemplateReadModel[] = [
  {
    id: "tpl-transport-weight",
    name: "Allocate freight by weight",
    description: "Distributes freight cost proportionally by net weight.",
    category: "transport_allocation",
    example_nl: "Rozdziel koszt frachtu proporcjonalnie do wagi netto każdej pozycji.",
    default_tags: ["transport", "cost"],
  },
  {
    id: "tpl-transport-value",
    name: "Allocate freight by value",
    description: "Distributes freight cost proportionally by invoice value.",
    category: "transport_allocation",
    example_nl: "Rozdziel koszt frachtu proporcjonalnie do wartości każdej pozycji.",
    default_tags: ["transport", "cost"],
  },
  {
    id: "tpl-aggregate-cn",
    name: "Aggregate per CN code",
    description: "Sum weight and value per CN code.",
    category: "aggregation",
    example_nl: "Pogrupuj pozycje po cn_code i policz sumy.",
    default_tags: ["customs"],
  },
  {
    id: "tpl-currency-pln",
    name: "Convert to PLN",
    description: "Add PLN-equivalent column using NBP rate.",
    category: "currency",
    example_nl: "Dodaj kolumnę z wartością w PLN według kursu NBP z daty faktury.",
    default_tags: ["fx"],
  },
  {
    id: "tpl-vlookup-cn",
    name: "VLOOKUP CN dictionary",
    description: "Fill column from CN code lookup table.",
    category: "lookup",
    example_nl: "Wypełnij polish_cn_name na bazie cn_code i słownika CN_PL.",
    default_tags: ["lookup"],
  },
  {
    id: "tpl-vat",
    name: "VAT per line",
    description: "Compute VAT amount per line based on rate.",
    category: "tax",
    example_nl: "Policz VAT dla każdej pozycji jako invoice_value × stawka_vat.",
    default_tags: ["tax", "vat"],
  },
]

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

export function buildRules(): RuleReadModel[] {
  return RULES.map((seed, idx) => ({
    id: seed.id,
    name: seed.name,
    description: seed.description,
    category: seed.category,
    status: seed.status,
    current_version: idx % 3 === 0 ? 3 : idx % 2 === 0 ? 2 : 1,
    tags: seed.tags,
    customer_tag: seed.customer_tag,
    trigger: seed.trigger,
    created_at: daysAgo(30 + idx * 3),
    updated_at: daysAgo(idx * 2),
    last_run_at: seed.status === "active" ? daysAgo(idx) : null,
    attached_package_count: seed.status === "active" ? 3 + idx : 0,
  }))
}

export function buildRuleDetails(rule: RuleReadModel): RuleDetailsResponse {
  const seed = RULES.find((r) => r.id === rule.id) ?? RULES[0]!
  const versions: RuleVersionReadModel[] = []
  for (let v = rule.current_version; v >= 1; v--) {
    versions.push({
      version: v,
      nl_definition:
        v === rule.current_version
          ? seed.nl_definition
          : `${seed.nl_definition}\n\n[v${v} draft note]`,
      python_code: seed.python_code,
      output_columns: seed.output_columns,
      created_at: daysAgo((rule.current_version - v) * 4 + 1),
      created_by: v % 2 === 0 ? "demo@cortex.local" : "pat@cortex.local",
      notes: v === rule.current_version ? null : `Iteration v${v}`,
    })
  }
  return {
    id: rule.id,
    name: rule.name,
    description: rule.description,
    category: rule.category,
    status: rule.status,
    tags: rule.tags,
    customer_tag: rule.customer_tag,
    trigger: rule.trigger,
    current_version: rule.current_version,
    versions,
  }
}

const ATTACHMENTS_BY_PACKAGE = new Map<string, PackageRuleAttachment[]>()

export function packageRuleAttachments(packageId: string): PackageRuleAttachment[] {
  if (!ATTACHMENTS_BY_PACKAGE.has(packageId)) {
    const seedNum = Number(packageId.replace(/\D/g, "")) || 0
    const list: PackageRuleAttachment[] = []
    if (seedNum % 2 === 0) {
      list.push({
        id: `${packageId}-att-1`,
        rule_id: "rule-0001",
        rule_name: "Allocate freight by net weight",
        rule_version: 3,
        trigger: "auto_on_extraction",
        attached_at: daysAgo(7),
        last_executed_at: daysAgo(0),
        last_status: "success",
      })
    }
    if (seedNum % 3 === 0) {
      list.push({
        id: `${packageId}-att-2`,
        rule_id: "rule-0003",
        rule_name: "Convert invoice currency to PLN",
        rule_version: 2,
        trigger: "auto_on_extraction",
        attached_at: daysAgo(5),
        last_executed_at: daysAgo(0),
        last_status: "success",
      })
    }
    ATTACHMENTS_BY_PACKAGE.set(packageId, list)
  }
  return ATTACHMENTS_BY_PACKAGE.get(packageId)!
}

export function attachRuleToPackage(
  packageId: string,
  rule: RuleReadModel,
  trigger: RuleTrigger,
): PackageRuleAttachment {
  const list = packageRuleAttachments(packageId)
  const attachment: PackageRuleAttachment = {
    id: `${packageId}-att-${list.length + 1}`,
    rule_id: rule.id,
    rule_name: rule.name,
    rule_version: rule.current_version,
    trigger,
    attached_at: new Date().toISOString(),
    last_executed_at: null,
    last_status: "pending",
  }
  list.push(attachment)
  return attachment
}

export function detachRuleFromPackage(packageId: string, attachmentId: string): boolean {
  const list = ATTACHMENTS_BY_PACKAGE.get(packageId)
  if (!list) return false
  const idx = list.findIndex((a) => a.id === attachmentId)
  if (idx === -1) return false
  list.splice(idx, 1)
  return true
}

export function compileRuleStub(nl: string): {
  python_code: string
  output_columns: { name: string; description: string; data_type: "string" | "number" }[]
  warnings: string[]
} {
  const lower = nl.toLowerCase()
  const guessed = lower.includes("waga")
    ? "freight_share"
    : lower.includes("cn")
      ? "cn_total"
      : lower.includes("pln") || lower.includes("kurs")
        ? "value_pln"
        : "computed_column"

  const code = [
    `# Auto-generated from natural language`,
    `# Source: ${nl.replace(/\n/g, " ").slice(0, 80)}...`,
    `def apply(lines, context):`,
    `    for line in lines:`,
    `        # TODO: replace with real transformation`,
    `        line['${guessed}'] = compute(line, context)`,
    `    return lines`,
    ``,
    `def compute(line, context):`,
    `    return 0`,
  ].join("\n")

  return {
    python_code: code,
    output_columns: [
      { name: guessed, description: "Computed by rule.", data_type: "number" },
    ],
    warnings: lower.length < 20 ? ["Definition is short — consider adding examples."] : [],
  }
}
