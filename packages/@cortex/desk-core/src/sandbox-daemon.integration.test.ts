// Piaskownica PRAWDZIWA — na żywym demonie `cortex-sandbox`, nie na zaślepce.
//
// DLACZEGO NA ŻYWYM. Wszystko, co ten klient robi, to zamiana wywołania funkcji na żądanie
// po gnieździe uniksowym. Zaślepka sprawdziłaby wyłącznie, czy napisałem ten napis tak,
// jak go napisałem. Pytania, na które ten test ma odpowiedzieć — czy plik z biurka faktycznie
// dojeżdża do katalogu roboczego, czy `stopped` wraca z demona zamiast być zgadywane,
// czy sprawa naprawdę umiera po `dispose` — są pytaniami do demona i do Dockera.
//
// Domyślnie POMIJANY — bez DESK_SANDBOX_SOCKET `npm run gate:desk` zostaje zielony.
//
//   1. zbuduj i uruchom demona:
//        cd ~/REPO/cortex-sandbox && go build -o /tmp/cortex-sandbox .
//        /tmp/cortex-sandbox serve -socket /tmp/cx-sbx.sock -root /tmp/cx-root -pool 0
//   2. puść test:
//        DESK_SANDBOX_SOCKET=/tmp/cx-sbx.sock DESK_DATA_DIR=/tmp/cx-desk \
//          npx vitest run packages/@cortex/desk-core/src/sandbox-daemon.integration.test.ts

import { promises as fs } from "node:fs"
import path from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const SOCKET = process.env.DESK_SANDBOX_SOCKET

describe.skipIf(!SOCKET)("piaskownica na żywym demonie", () => {
  let sandbox: typeof import("./sandbox")
  let daemon: typeof import("./sandbox-daemon")
  const user = "anna"

  beforeAll(async () => {
    sandbox = await import("./sandbox")
    daemon = await import("./sandbox-daemon")
    const storage = await import("./desk-storage")
    await storage.prepareDesk(user)
    await storage.write(
      user,
      "Moje pliki/faktury-test.csv",
      "kontrahent,netto,vat\nOrlen,100.00,23\nOrlen,200.00,46\nLotos,50.00,11.5\n",
    )
  })

  it("demon żyje i mówi, jakimi środowiskami dysponuje", async () => {
    const h = await daemon.health()
    expect(h.ok).toBe(true)
    // Środowisko domyślne MUSI być pythonowe — na tym stoi D6 i cały preset `python-dane`.
    const p = await daemon.presets()
    expect(p.default).toContain("python")
    expect(p.presets.length).toBeGreaterThan(0)
  })

  it("liczy na PLIKU Z BIURKA, a nie na tekście wklejonym do kodu", async () => {
    // To jest ta własność, dla której piaskownica w ogóle istnieje: dane wchodzą z biurka,
    // kod ich nie zna z góry, a wynik daje się sprawdzić.
    const box = await sandbox.create({
      user,
      caseId: "it-1",
      mounts: [{ fromDesk: "Moje pliki/faktury-test.csv", as: "faktury.csv", write: false }],
    })
    try {
      const r = await box.exec(
        "import pandas as pd\n" +
          "d = pd.read_csv('faktury.csv')\n" +
          "print(d.groupby('kontrahent')['netto'].sum().to_json())",
      )
      expect(r.ok, r.output).toBe(true)
      expect(r.output).toContain("Orlen")
      expect(r.output).toContain("300")
    } finally {
      await box.dispose()
    }
  })

  it("plik wytworzony w piaskownicy wraca jako `produced`, a nie przez zgadywanie", async () => {
    const box = await sandbox.create({ user, caseId: "it-2", mounts: [] })
    try {
      const r = await box.exec("open('zestawienie.csv','w').write('a,b\\n1,2\\n')\nprint('ok')")
      expect(r.ok, r.output).toBe(true)
      expect(r.produced).toContain("zestawienie.csv")
      // I naprawdę leży na dysku, a nie tylko w odpowiedzi.
      const on = await fs.readFile(path.join(box.folder, "zestawienie.csv"), "utf8")
      expect(on).toContain("1,2")
    } finally {
      await box.dispose()
    }
  })

  it("odróżnia „za długo” od „nie udało się”", async () => {
    const box = await sandbox.create({
      user,
      caseId: "it-3",
      mounts: [],
      limits: { seconds: 2, memoryMb: 256 },
    })
    try {
      const r = await box.exec("while True: pass")
      expect(r.ok).toBe(false)
      // TO JEST TA ASERCJA: powód przychodzi Z DEMONA. Bez niej interfejs musiałby zgadywać,
      // a pani Basia dostałaby „błąd wykonania" na kodzie, który po prostu liczył za długo.
      expect(r.stopped).toBe("timeout")
    } finally {
      await box.dispose()
    }
  })

  it("nie widzi biurka spoza tego, co jej podano", async () => {
    const box = await sandbox.create({ user, caseId: "it-4", mounts: [] })
    try {
      // Pytamy o TREŚĆ, nie o istnienie. `/etc/shadow` i `/root` istnieją także WEWNĄTRZ
      // obrazu — znaczenie ma to, CZYJE są i czy da się je odczytać. Pierwsza wersja tego
      // testu pytała o `os.path.exists` i była zielona z niewłaściwego powodu; demon ma
      // tę samą pułapkę opisaną przy swoim dowodzie 2.
      const r = await box.exec(
        "import os\n" +
          "host = ['/var/lib/cortex-sandbox', '/Users', '/private/tmp']\n" +
          "print('hosta=' + str([p for p in host if os.path.exists(p)]))\n" +
          "try:\n" +
          "    open('/etc/shadow').read()\n" +
          "    print('shadow=ODCZYTANE')\n" +
          "except Exception as e:\n" +
          "    print('shadow=' + type(e).__name__)\n" +
          "try:\n" +
          "    open('/zapis-poza-sprawa','w').write('x')\n" +
          "    print('rootfs=ZAPISYWALNY')\n" +
          "except Exception as e:\n" +
          "    print('rootfs=' + type(e).__name__)",
      )
      // Żadna ścieżka istniejąca WYŁĄCZNIE na tym hoście nie jest widoczna…
      expect(r.output).toContain("hosta=[]")
      // …cudzych sekretów nie da się odczytać…
      expect(r.output).toContain("shadow=PermissionError")
      // …a system plików poza katalogiem sprawy jest tylko do odczytu.
      expect(r.output).toContain("rootfs=OSError")
    } finally {
      await box.dispose()
    }
  })

  it("po `dispose` katalog sprawy naprawdę znika", async () => {
    const box = await sandbox.create({ user, caseId: "it-5", mounts: [] })
    await box.exec("open('slad.txt','w').write('x')")
    await box.dispose()
    await expect(fs.stat(box.folder)).rejects.toThrow()
  })
})
