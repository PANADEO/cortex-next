import { Suspense } from 'react'
import { Powloka } from '@/components/powloka'
import { Eksplorator } from '@/components/eksplorator'

export default async function Strona() {
  return (
    <Powloka>
      <div className="h-full overflow-y-auto">
        <Suspense><Eksplorator /></Suspense>
      </div>
    </Powloka>
  )
}
