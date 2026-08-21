// Barrel statycznie zbierający WSZYSTKIE manifesty kafelków natywnych —
// analogicznie do tego, jak tiles.ts dziś statycznie zbiera
// AI_TOOL_DEFINITIONS. Jedyny konsument tego pliku poza testami to
// scripts/generate-tile-manifests.mjs (etap `builder` Dockerfile), który
// generuje z niego packages/@cortex/db/scripts/tile-manifests.generated.json
// — patrz PROJECT/cortex-frontend-hub-db-driven-projekt.md D10-rewizja (c).
//
// Ten plik jest zwykłym TS bez zależności od Reacta/Next (manifesty importują
// wyłącznie defineTile z @cortex/tile-sdk) — jest więc wykonywalny poza
// kontekstem aplikacji Next.js, o ile ktoś go skompiluje/zbundluje.
//
// Nowy natywny moduł: dopisz manifest.ts obok jego strony (albo — dla
// narzędzi AI Tools bez własnego folderu — w app/idp/lib/ai-tools/manifests/)
// i dodaj import + wpis niżej. Import zapomniany tutaj = moduł nigdy nie
// zarejestruje się jako kandydat do aktywacji w żadnej instancji.

import { cortexCoworkTile } from "@/app/(cowork)/cortex-cowork/manifest"
import { aiToolsTile } from "@/app/(main)/ai-tools/manifest"
import { cortexConfigTile } from "@/app/(main)/cortex-config/manifest"
import { documentParserTile } from "@/app/(main)/document-parser/manifest"
import { geoScoreCalculatorTile } from "@/app/(main)/geo-score-calculator/manifest"
import { idpBasicTile } from "@/app/(main)/idp-basic/manifest"
import { idpTile } from "@/app/(main)/idp/manifest"
import { ilustromatTile } from "@/app/(main)/ilustromat/manifest"
import { intrastatTile } from "@/app/(main)/intrastat/manifest"
import { intrastatCnEditorTile } from "@/app/(main)/intrastat/resources/manifest"
import { intrastatConfigEditorTile } from "@/app/(main)/intrastat/settings/manifest"
import { invoiceSupervisorTile } from "@/app/(main)/invoice-supervisor/manifest"
import { oknaCzasoweTile } from "@/app/(main)/okna-czasowe/manifest"
import { spClientTile } from "@/app/(main)/store-pit/clients/manifest"
import { spConsoleTile } from "@/app/(main)/store-pit/dashboard/manifest"
import { systemConfigTile } from "@/app/(main)/system-config/manifest"
import { tokenUsageTile } from "@/app/(main)/token-usage/manifest"
import { visualGuruTile } from "@/app/(main)/visual-guru/manifest"
import type { TileManifest } from "@cortex/tile-sdk"
import { aiDailyAssistantTile } from "./ai-tools/manifests/ai-daily-assistant.manifest"
import { aiSummarizerTile } from "./ai-tools/manifests/ai-summarizer.manifest"
import { contentGuruTile } from "./ai-tools/manifests/content-guru.manifest"
import { fakturomatTile } from "./ai-tools/manifests/fakturomat.manifest"
import { linkedinGeneratorTile } from "./ai-tools/manifests/linkedin-generator.manifest"
import { presentationGeneratorTile } from "./ai-tools/manifests/presentation-generator.manifest"
import { textAnalyzerTile } from "./ai-tools/manifests/text-analyzer.manifest"
import { textHighlighterTile } from "./ai-tools/manifests/text-highlighter.manifest"
import { textTransformerTile } from "./ai-tools/manifests/text-transformer.manifest"

export const ALL_TILE_MANIFESTS: readonly TileManifest[] = [
  idpTile,
  idpBasicTile,
  spConsoleTile,
  spClientTile,
  oknaCzasoweTile,
  cortexConfigTile,
  cortexCoworkTile,
  intrastatTile,
  invoiceSupervisorTile,
  systemConfigTile,
  aiToolsTile,
  textHighlighterTile,
  textTransformerTile,
  textAnalyzerTile,
  aiSummarizerTile,
  contentGuruTile,
  linkedinGeneratorTile,
  presentationGeneratorTile,
  fakturomatTile,
  aiDailyAssistantTile,
  intrastatCnEditorTile,
  intrastatConfigEditorTile,
  ilustromatTile,
  tokenUsageTile,
  geoScoreCalculatorTile,
  documentParserTile,
  visualGuruTile,
]
