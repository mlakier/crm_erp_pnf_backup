import Link from 'next/link'

export default function CreatePageLinkButton({
  href,
  label,
}: {
  href: string
  label: string
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-base font-semibold transition"
      style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#ffffff' }}
    >
      <span className="mr-1.5 text-lg leading-none">+</span>
      {label}
    </Link>
  )
}
