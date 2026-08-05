-- Krok odśmiecający PRZED założeniem ograniczenia. Dopisany ręcznie do
-- wygenerowanego pliku, bo drizzle-kit umie tylko ADD CONSTRAINT — a to
-- wywraca migrację na pierwszym duplikacie zamiast ją naprawić.
--
-- Ryzyko na dziś jest ZEROWE i to jest sprawdzone, nie założone: tabela
-- powstaje w migracji 0003 (commit b3c520d), który jest osiągalny WYŁĄCZNIE
-- z gałęzi `cortex-next` — nie ma go na `main`, w żadnym tagu (najnowszy
-- osiągalny z HEAD to v0.4.88) ani nawet na `origin/cortex-next`; lokalna baza
-- ma 0 wierszy. Czyli nie ma dziś instancji, na której ten DELETE miałby co
-- kasować. Zostaje mimo to, bo migracja ma być poprawna na KAŻDEJ bazie, która
-- kiedykolwiek zobaczy 0003 przed 0004 — a między jedną a drugą wersją da się
-- zmapować dwie role na tę samą grupę (dokładnie ta pomyłka, którą 0004
-- likwiduje).
--
-- Które mapowanie zostaje: to z NAJŚWIEŻSZĄ synchronizacją. Grupa w OpenWebUI
-- niesie dziś członkostwo wyliczone przez rolę, która pushowała jako ostatnia,
-- więc zachowanie właśnie jej sprawia, że najbliższe uzgodnienie jest no-opem.
-- Skasowanie tamtego wiersza nie odbiera nikomu dostępu, którego by już nie
-- stracił — te konta i tak nie są dziś w grupie. `updated_at`/`role_id`
-- domykają porządek, żeby wynik był deterministyczny także dla wierszy nigdy
-- niesynchronizowanych (`last_synced_at IS NULL`).
DELETE FROM "system_config"."openwebui_group_mappings" AS m
USING (
	SELECT
		"role_id",
		row_number() OVER (
			PARTITION BY "group_id"
			ORDER BY "last_synced_at" DESC NULLS LAST, "updated_at" DESC, "role_id"
		) AS rn
	FROM "system_config"."openwebui_group_mappings"
) AS ranked
WHERE m."role_id" = ranked."role_id" AND ranked.rn > 1;
--> statement-breakpoint
ALTER TABLE "system_config"."openwebui_group_mappings" ADD CONSTRAINT "openwebui_group_mappings_group_id_unique" UNIQUE("group_id");
