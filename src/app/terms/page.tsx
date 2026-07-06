import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms of Service – Developer Knowledge Base" };

const EFFECTIVE_DATE = "July 4, 2026";
const CONTACT_EMAIL = "srbmaury@gmail.com";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-sm leading-relaxed text-foreground">
      <h1 className="mb-2 text-2xl font-semibold">Terms of Service</h1>
      <p className="mb-8 text-muted-foreground">Effective {EFFECTIVE_DATE}</p>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">1. Acceptance</h2>
        <p>
          By creating an account or using Developer Knowledge Base (&quot;the Service&quot;) you agree
          to these Terms. If you do not agree, do not use the Service.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">2. Your Account</h2>
        <p>
          You are responsible for keeping your credentials secure and for all activity that occurs
          under your account. You must be at least 13 years old to use the Service.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">3. Acceptable Use</h2>
        <p className="mb-2">You agree not to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Use the Service for any unlawful purpose.</li>
          <li>Upload content that infringes third-party intellectual property rights.</li>
          <li>Attempt to gain unauthorised access to other users&apos; data.</li>
          <li>Scrape, crawl, or systematically extract data from the Service.</li>
          <li>Circumvent usage limits or rate limits through automated means.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">4. Free and Premium Plans</h2>
        <p>
          Free accounts are limited to 50 questions and 10 categories. Premium accounts receive
          unlimited questions and categories, plus access to AI-powered features. Plans and pricing
          may change with reasonable notice.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">5. Your Content</h2>
        <p>
          You retain ownership of content you create. By using the Service you grant us a limited
          licence to store and serve that content to you. We do not sell or share your private notes
          with third parties.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">6. AI Features</h2>
        <p>
          AI-generated content is provided as-is and may contain errors. You are responsible for
          reviewing any AI output before relying on it. AI requests are subject to rate limits.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">7. Termination</h2>
        <p>
          You may delete your account at any time from the{" "}
          <Link href="/account" className="underline">Account settings</Link> page. We reserve the
          right to suspend accounts that violate these Terms.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">8. Disclaimer of Warranties</h2>
        <p>
          The Service is provided &quot;as is&quot; without warranties of any kind. We do not
          guarantee uptime, data retention, or fitness for a particular purpose.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">9. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, we are not liable for indirect, incidental, or
          consequential damages arising from your use of the Service.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">10. Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. Continued use after changes take effect
          constitutes acceptance of the revised Terms.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">11. Contact</h2>
        <p>
          Questions? Email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>

      <p className="mt-8 text-muted-foreground">
        <Link href="/privacy" className="underline">Privacy Policy</Link>
        {" · "}
        <Link href="/" className="underline">Back to app</Link>
      </p>
    </div>
  );
}
