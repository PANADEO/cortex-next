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
import { daysAgo } from "./_shared"

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
    name: "Alokuj fracht po wadze netto",
    description: "Rozdziela całkowity koszt frachtu na pozycje faktury proporcjonalnie do wagi netto.",
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
      { name: "freight_share", description: "Przypisana część frachtu (w walucie transportu).", data_type: "number" },
    ],
  },
  {
    id: "rule-0002",
    name: "Agreguj wagę per kod CN",
    description: "Grupuje pozycje po kodzie CN i zwraca sumy (waga netto, brutto, wartość).",
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
      { name: "cn_code", description: "Kod nomenklatury celnej (CN).", data_type: "string" },
      { name: "net_weight_kg", description: "Suma wag netto per kod CN.", data_type: "number" },
      { name: "gross_weight_kg", description: "Suma wag brutto per kod CN.", data_type: "number" },
      { name: "invoice_value", description: "Suma wartości faktury per kod CN.", data_type: "number" },
    ],
  },
  {
    id: "rule-0003",
    name: "Przelicz walutę faktury na PLN",
    description: "Dodaje kolumnę z wartością w PLN używając kursu NBP z dnia faktury.",
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
      { name: "invoice_value_pln", description: "Wartość pozycji przeliczona na PLN.", data_type: "number" },
    ],
  },
  {
    id: "rule-0004",
    name: "Wylicz wagę brutto z netto + opakowanie",
    description: "Uzupełnia brakującą wagę brutto sumą wagi netto i wagi opakowania.",
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
      { name: "gross_weight_kg", description: "Wyliczona waga brutto.", data_type: "number" },
    ],
  },
  {
    id: "rule-0005",
    name: "Słownik CN → polska nazwa",
    description: "Wypełnia kolumnę polish_cn_name ze słownika kodów CN.",
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
      { name: "polish_cn_name", description: "Polska nazwa kodu CN.", data_type: "string" },
    ],
  },
  {
    id: "rule-0006",
    name: "Rozdziel pozycję po kodzie HS",
    description: "Rozbija zbiorczą pozycję na osobne wiersze per kod HS z proporcjonalnymi wartościami.",
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
      { name: "hs_code", description: "Konkretny kod HS per rozdzielony wiersz.", data_type: "string" },
    ],
  },
]

export const RULE_TEMPLATES: RuleTemplateReadModel[] = [
  {
    id: "tpl-transport-weight",
    name: "Alokuj fracht po wadze",
    description: "Rozdziela koszt frachtu proporcjonalnie do wagi netto.",
    category: "transport_allocation",
    example_nl: "Rozdziel koszt frachtu proporcjonalnie do wagi netto każdej pozycji.",
    default_tags: ["transport", "cost"],
  },
  {
    id: "tpl-transport-value",
    name: "Alokuj fracht po wartości",
    description: "Rozdziela koszt frachtu proporcjonalnie do wartości faktury.",
    category: "transport_allocation",
    example_nl: "Rozdziel koszt frachtu proporcjonalnie do wartości każdej pozycji.",
    default_tags: ["transport", "cost"],
  },
  {
    id: "tpl-aggregate-cn",
    name: "Agreguj per kod CN",
    description: "Sumuje wagi i wartości per kod CN.",
    category: "aggregation",
    example_nl: "Pogrupuj pozycje po cn_code i policz sumy.",
    default_tags: ["customs"],
  },
  {
    id: "tpl-currency-pln",
    name: "Przelicz na PLN",
    description: "Dodaje kolumnę z wartością w PLN po kursie NBP.",
    category: "currency",
    example_nl: "Dodaj kolumnę z wartością w PLN według kursu NBP z daty faktury.",
    default_tags: ["fx"],
  },
  {
    id: "tpl-vlookup-cn",
    name: "Słownik CN (lookup)",
    description: "Uzupełnia kolumnę z tabeli słownikowej kodów CN.",
    category: "lookup",
    example_nl: "Wypełnij polish_cn_name na bazie cn_code i słownika CN_PL.",
    default_tags: ["lookup"],
  },
  {
    id: "tpl-vat",
    name: "VAT per pozycja",
    description: "Liczy kwotę VAT per pozycja na podstawie stawki.",
    category: "tax",
    example_nl: "Policz VAT dla każdej pozycji jako invoice_value × stawka_vat.",
    default_tags: ["tax", "vat"],
  },
]

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
        rule_name: "Alokuj fracht po wadze netto",
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
        rule_name: "Przelicz walutę faktury na PLN",
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

export function explainRuleStub(nl: string): {
  is_valid: boolean
  summary: string
  worked_example: string
  affected_columns: string[]
  concerns: string[]
  clarifying_questions: string[]
} {
  const trimmed = nl.trim()
  if (trimmed.length < 12) {
    return {
      is_valid: false,
      summary: "Definicja jest zbyt krótka.",
      worked_example: "",
      affected_columns: [],
      concerns: ["Reguła musi mieć przynajmniej kilkanaście znaków."],
      clarifying_questions: [
        "Co konkretnie ma zostać policzone albo dodane do faktury?",
        "Z których kolumn źródłowych korzystać?",
      ],
    }
  }

  const lower = trimmed.toLowerCase()
  const mentionsWeight = /(wag|net_weight|weight)/.test(lower)
  const mentionsValue = /(wartoś|value|invoice_value|cena)/.test(lower)
  const mentionsFreight = /(fracht|transport|freight|cost)/.test(lower)
  const mentionsCn = /(cn[\s_-]?code|cn|kod taryfowy)/.test(lower)
  const mentionsPln = /(pln|nbp|kurs|exchange)/.test(lower)
  const mentionsAggregate = /(agreguj|sum|pogrupuj|group)/.test(lower)
  const mentionsSplit = /(rozdziel|podziel|split)/.test(lower)

  const affected: string[] = []
  if (mentionsFreight) affected.push("freight_share")
  if (mentionsPln) affected.push("invoice_value_pln")
  if (mentionsAggregate && mentionsCn) affected.push("cn_total_weight", "cn_total_value")
  if (mentionsSplit) affected.push("hs_code", "invoice_value")
  if (affected.length === 0) affected.push("computed_value")

  const concerns: string[] = []
  if (mentionsFreight && !mentionsWeight && !mentionsValue) {
    concerns.push(
      "Nie wskazano podstawy alokacji frachtu (waga vs wartość). Domyślnie użyję wagi.",
    )
  }
  if (mentionsPln && !/(invoice_date|data faktury)/.test(lower)) {
    concerns.push("Nie podałeś źródła kursu — założę kurs NBP z dnia faktury.")
  }
  if (mentionsAggregate && affected.length === 1) {
    concerns.push(
      "Nie wskazano kolumn do zsumowania — zaproponuję net_weight_kg + invoice_value.",
    )
  }

  const questions: string[] = []
  if (mentionsFreight) {
    questions.push("Czy fracht alokować po wadze netto czy po wartości faktury?")
  }
  if (mentionsSplit && !/(udział|propor|share|ratio)/.test(lower)) {
    questions.push("Po jakim kluczu rozdzielić linie (waga, wartość, ilość)?")
  }

  let summary = "Rozumiem regułę i mogę ją zastosować."
  let worked = "Dla faktury z 3 pozycjami: A, B, C — reguła zostanie wywołana per pozycja."

  if (mentionsFreight && mentionsWeight) {
    summary =
      "Alokuje koszt frachtu z `transport_info.cost` proporcjonalnie do wagi netto każdej pozycji faktury."
    worked =
      "Faktura: 100 PLN frachtu, 3 pozycje (waga 10/20/20 kg). Wynik: pozycja 1 → 20 PLN, pozycja 2 → 40 PLN, pozycja 3 → 40 PLN."
  } else if (mentionsFreight && mentionsValue) {
    summary =
      "Alokuje koszt frachtu z `transport_info.cost` proporcjonalnie do wartości każdej pozycji."
    worked =
      "Faktura: 100 PLN frachtu, pozycje o wartości 50/150 PLN. Wynik: 25 PLN i 75 PLN."
  } else if (mentionsAggregate && mentionsCn) {
    summary = "Grupuje pozycje po `cn_code` i sumuje wagi netto, brutto oraz wartości."
    worked =
      "Pozycje: CN 8471... (waga 5+10), CN 8528... (waga 8). Wynik: dwie linie sumaryczne."
  } else if (mentionsPln) {
    summary =
      "Dodaje kolumnę `invoice_value_pln` przeliczając `invoice_value` po kursie NBP z daty faktury."
    worked =
      "Faktura w EUR: 100 EUR, kurs 4.30. Wynik: invoice_value_pln = 430.00."
  } else if (mentionsSplit) {
    summary =
      "Rozdziela pozycje na osobne wiersze proporcjonalnie do udziałów (np. po HS code)."
    worked =
      "Pozycja 100 PLN z udziałami HS 8471 (60%) i 8528 (40%). Wynik: dwie linie 60/40 PLN."
  }

  return {
    is_valid: true,
    summary,
    worked_example: worked,
    affected_columns: affected,
    concerns,
    clarifying_questions: questions,
  }
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
      { name: guessed, description: "Wyliczone przez regułę.", data_type: "number" },
    ],
    warnings: lower.length < 20 ? ["Definicja jest krótka — dodaj przykłady."] : [],
  }
}
