import MasterDataImportForm from '@/components/MasterDataImportForm'

export default function MasterDataImportPage() {
  return (
    <div className="min-h-full px-8 py-8">
      <div className="max-w-4xl">
        <h1 className="text-xl font-semibold text-white">Master Data Import</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Upload CSV or XLSX files to validate and import master records.
        </p>

        <section className="mt-6 rounded-2xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <MasterDataImportForm />
        </section>
      </div>
    </div>
  )
}
