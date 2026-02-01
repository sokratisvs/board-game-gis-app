import PageLayout from '../PageLayout/PageLayout'
import Section from '../ui/Section'

export default function Settings() {
  return (
    <PageLayout
      title="Settings"
      description="Manage your account and app preferences."
    >
      <Section id="settings-heading" title="Settings">
        <p className="text-sm text-slate-500 m-0">
          Settings content can be added here (e.g. profile, notifications).
        </p>
      </Section>
    </PageLayout>
  )
}
