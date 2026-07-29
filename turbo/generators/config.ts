import type { PlopTypes } from "@turbo/gen"

// `pnpm turbo gen tile` — scaffolds a new tile under app/idp/app/(main)/<id>/.
// See .claude/skills/code-tile/SKILL.md for the conventions this encodes.
export default function generator(plop: PlopTypes.NodePlopAPI): void {
  plop.setGenerator("tile", {
    description: "Nowy kafelek (native) pod app/idp/app/(main)/<id>/",
    prompts: [
      {
        type: "input",
        name: "id",
        message: "id kafelka (kebab-case, np. faq-hr):",
      },
      {
        type: "input",
        name: "label",
        message: "etykieta PL (np. Bot FAQ HR):",
      },
      {
        type: "input",
        name: "entitlementCode",
        message: "entitlementCode (zwykle = id):",
      },
    ],
    actions: [
      {
        type: "add",
        path: "app/idp/app/(main)/{{id}}/page.tsx",
        templateFile: "templates/tile/page.tsx.hbs",
      },
      {
        type: "add",
        path: "app/idp/app/(main)/{{id}}/manifest.ts",
        templateFile: "templates/tile/manifest.ts.hbs",
      },
      {
        type: "add",
        path: "app/idp/app/api/{{id}}/generate/route.ts",
        templateFile: "templates/tile/route.ts.hbs",
      },
    ],
  })
}
