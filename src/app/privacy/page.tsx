import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy Policy – Developer Knowledge Base" };

const EFFECTIVE_DATE = "July 4, 2026";
const CONTACT_EMAIL = "srbmaury@gmail.com";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-sm leading-relaxed text-foreground">
      <h1 className="mb-2 text-2xl font-semibold">Privacy Policy</h1>
      <p className="mb-8 text-muted-foreground">Effective {EFFECTIVE_DATE}</p>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">1. What We Collect</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Account data:</strong> email address and encrypted password (managed by Supabase Auth).</li>
          <li><strong>Content:</strong> categories, questions, and solutions you create.</li>
          <li><strong>Usage data:</strong> basic server logs (timestamps, HTTP status codes) for reliability monitoring.</li>
          <li><strong>Error reports:</strong> stack traces captured by Sentry when the app encounters an unhandled error.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">2. How We Use Your Data</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>To authenticate you and serve your workspace.</li>
          <li>To provide AI-powered features (your content is sent to OpenAI for processing).</li>
          <li>To diagnose and fix bugs via error monitoring.</li>
          <li>We do not sell your data or use it for advertising.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">3. Third-Party Services</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Supabase</strong> — authentication and session management. <a href="https://supabase.com/privacy" className="underline" target="_blank" rel="noopener noreferrer">Privacy policy</a></li>
          <li><strong>Neon</strong> — PostgreSQL database hosting. <a href="https://neon.tech/privacy-policy" className="underline" target="_blank" rel="noopener noreferrer">Privacy policy</a></li>
          <li><strong>OpenAI</strong> — AI answer generation and review (Premium only). Content sent to OpenAI is subject to their <a href="https://openai.com/policies/privacy-policy" className="underline" target="_blank" rel="noopener noreferrer">Privacy policy</a>.</li>
          <li><strong>Sentry</strong> — error tracking. Stack traces may include request metadata but never solution content.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">4. Data Retention</h2>
        <p>
          Your data is retained for as long as your account is active. You can permanently delete
          your account and all associated data at any time from the{" "}
          <Link href="/account" className="underline">Account settings</Link> page.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">5. Cookies</h2>
        <p>
          We use a single session cookie managed by Supabase Auth to keep you signed in. No
          third-party tracking or advertising cookies are used.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">6. Your Rights</h2>
        <p>
          Depending on your jurisdiction you may have rights to access, correct, or delete your
          personal data. To exercise these rights, email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a> or use the
          account deletion option in settings.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">7. Security</h2>
        <p>
          We use HTTPS for all traffic, store passwords hashed via Supabase Auth, and restrict
          database access to server-side code only. No system is completely secure; use a strong,
          unique password.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">8. Changes to This Policy</h2>
        <p>
          We may update this policy. Material changes will be communicated via the email address
          associated with your account.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">9. Contact</h2>
        <p>
          Privacy questions:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>
        </p>
      </section>

      <p className="mt-8 text-muted-foreground">
        <Link href="/terms" className="underline">Terms of Service</Link>
        {" · "}
        <Link href="/" className="underline">Back to app</Link>
      </p>
    </div>
  );
}
