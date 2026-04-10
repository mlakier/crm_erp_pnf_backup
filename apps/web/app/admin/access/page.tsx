const sections = [
  {
    title: "Users API",
    endpoint: "/api/users",
    notes: [
      "List users with assigned roles",
      "Create users with role codes",
      "Update users and role assignments"
    ]
  },
  {
    title: "Roles API",
    endpoint: "/api/access/roles",
    notes: [
      "List roles and attached permissions",
      "Create business roles",
      "Replace role permission assignments"
    ]
  },
  {
    title: "Permissions API",
    endpoint: "/api/access/permissions",
    notes: [
      "Create permissions",
      "List permission catalog",
      "Use as seed/control plane data"
    ]
  }
];

export default function AdminAccessPage() {
  return (
    <main style={{ padding: 32, fontFamily: "Arial, sans-serif", background: "#f6f8fb", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <h1 style={{ fontSize: 32, marginBottom: 8 }}>Access Administration</h1>
        <p style={{ fontSize: 16, marginBottom: 24 }}>
          Initial admin console stub for users, roles, and permissions. This page documents the first
          API surface for platform access management.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {sections.map((section) => (
            <section
              key={section.title}
              style={{ background: "white", border: "1px solid #dde4ee", borderRadius: 12, padding: 20 }}
            >
              <h2 style={{ marginTop: 0 }}>{section.title}</h2>
              <p style={{ marginTop: 0, color: "#425466" }}>
                Planned endpoint: <code>{section.endpoint}</code>
              </p>
              <ul style={{ paddingLeft: 20, marginBottom: 0 }}>
                {section.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
