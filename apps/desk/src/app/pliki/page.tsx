import { Powloka } from '@/components/powloka'
import { Eksplorator } from '@/components/eksplorator'

export default async function Strona() {
  return (
    <Powloka>
      <div className="h-full overflow-y-auto"><Eksplorator /></div>
    </Powloka>
  )
}
