import MapComponent from '../MapComponent/MapComponent'
import PageLayout from '../PageLayout/PageLayout'

export default function Map() {
  return (
    <PageLayout>
      <section
        className="rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm"
        aria-label="Map"
      >
        <MapComponent />
      </section>
    </PageLayout>
  )
}
