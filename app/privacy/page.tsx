import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | 99Bricks",
  description: "Privacy Policy for 99Bricks, Jaipur's map-based property listing platform.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="border-b border-black/10 bg-header-bg">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="99Bricks"
              className="h-9 w-9 rounded-full object-cover shadow-sm"
            />
            <span className="text-sm font-black text-header-fg">
              99Bricks
            </span>
          </Link>

          <Link
            href="/"
            className="text-sm font-semibold text-header-fg/70 hover:text-white"
          >
            Back to listings
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-black text-zinc-900">
          Privacy Policy
        </h1>

        <p className="mt-2 text-sm text-zinc-500">
          Last updated: 20 September 2026
        </p>

        <p className="mt-6 text-zinc-700 leading-relaxed">
          This Privacy Policy explains how 99Bricks ("we", "us") collects,
          uses, shares, and protects your personal data when you use our
          website, in accordance with India's Digital Personal Data
          Protection Act, 2023 ("DPDP Act").
        </p>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold text-zinc-900">
            1. Who we are
          </h2>
          <p className="text-zinc-700 leading-relaxed">
            99Bricks is a property listing platform for Jaipur. For the
            purposes of the DPDP Act, 99Bricks is the Data Fiduciary
            responsible for your personal data. You can reach us at{" "}
            <a
              href="mailto:summit17092002@gmail.com"
              className="text-accent font-semibold"
            >
              summit17092002@gmail.com
            </a>{" "}
            for any privacy-related query. (A dedicated business address and
            email will be added here once 99Bricks completes formal business
            registration.)
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold text-zinc-900">
            2. What data we collect
          </h2>
          <ul className="list-disc space-y-2 pl-5 text-zinc-700 leading-relaxed">
            <li>
              <span className="font-semibold">Account data:</span> your email
              address and password (stored securely, encrypted, by our
              authentication provider) when you sign up.
            </li>
            <li>
              <span className="font-semibold">Listing data:</span> if you
              post a property, the details you submit — title, price,
              location, photos, and description.
            </li>
            <li>
              <span className="font-semibold">Inquiry data:</span> the
              messages you send to a seller through the "Send Inquiry"
              feature.
            </li>
            <li>
              <span className="font-semibold">Location data:</span> only if
              you tap "Near Me," your device's current coordinates, used
              solely to show you nearby properties. This is not stored
              beyond your session.
            </li>
            <li>
              <span className="font-semibold">Usage data:</span> pages you
              view and properties you favorite or compare, so those features
              work correctly.
            </li>
          </ul>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold text-zinc-900">
            3. Why we collect it
          </h2>
          <p className="text-zinc-700 leading-relaxed">
            We use your data only for clear, specific purposes: to create and
            secure your account; to let you post and manage listings; to
            deliver your inquiries to the relevant seller; to show you
            properties near a location you search or your current location;
            and to show you your saved favorites and comparisons. We do not
            use your personal data for purposes beyond these without asking
            you first.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold text-zinc-900">
            4. Who we share it with
          </h2>
          <p className="text-zinc-700 leading-relaxed">
            We share data only where necessary to run the Platform:
          </p>
          <ul className="list-disc space-y-2 pl-5 text-zinc-700 leading-relaxed">
            <li>
              <span className="font-semibold">Supabase</span> (our database,
              authentication, and hosting provider) stores your account and
              listing data on our behalf, under its own security and privacy
              practices.
            </li>
            <li>
              <span className="font-semibold">Mapbox</span> processes
              location searches to power the map and location-search
              features.
            </li>
            <li>
              <span className="font-semibold">Sellers</span> you send an
              inquiry to receive your message and the contact details needed
              to respond to you.
            </li>
            <li>
              <span className="font-semibold">WhatsApp</span> — only if you
              choose to tap "Share on WhatsApp," which opens WhatsApp with a
              pre-filled message; we do not send anything to WhatsApp on our
              own.
            </li>
          </ul>
          <p className="text-zinc-700 leading-relaxed">
            We do not sell your personal data to advertisers or third
            parties.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold text-zinc-900">
            5. How long we keep your data
          </h2>
          <p className="text-zinc-700 leading-relaxed">
            We retain your account and listing data for as long as your
            account is active. If you delete your account or ask us to erase
            your data, we will remove it within a reasonable time, except
            where we're required to keep limited records for legal reasons.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold text-zinc-900">
            6. Your rights
          </h2>
          <p className="text-zinc-700 leading-relaxed">
            Under the DPDP Act, you have the right to:
          </p>
          <ul className="list-disc space-y-2 pl-5 text-zinc-700 leading-relaxed">
            <li>
              <span className="font-semibold">Access</span> the personal data
              we hold about you.
            </li>
            <li>
              <span className="font-semibold">Correct</span> inaccurate or
              incomplete data.
            </li>
            <li>
              <span className="font-semibold">Erase</span> your data once it
              is no longer needed for the purpose it was collected for.
            </li>
            <li>
              <span className="font-semibold">Grievance redressal</span> —
              raise a complaint about how your data is handled.
            </li>
            <li>
              <span className="font-semibold">Nominate</span> another person
              to exercise these rights on your behalf in the event of death
              or incapacity.
            </li>
          </ul>
          <p className="text-zinc-700 leading-relaxed">
            To exercise any of these rights, email us at{" "}
            <a
              href="mailto:summit17092002@gmail.com"
              className="text-accent font-semibold"
            >
              summit17092002@gmail.com
            </a>
            . We will respond within a reasonable time.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold text-zinc-900">
            7. Withdrawing consent
          </h2>
          <p className="text-zinc-700 leading-relaxed">
            Where we rely on your consent (for example, at signup), you can
            withdraw it at any time by deleting your account or by emailing
            us to request deletion. Withdrawing consent is as easy as giving
            it, and it does not affect the legality of anything we did with
            your data before withdrawal.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold text-zinc-900">
            8. Security
          </h2>
          <p className="text-zinc-700 leading-relaxed">
            We rely on Supabase's managed infrastructure, which includes
            encryption in transit and at rest and industry-standard access
            controls, to help protect your data. No system is perfectly
            secure, and if we ever become aware of a breach affecting your
            personal data, we will notify affected users and the relevant
            authorities as required by law.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold text-zinc-900">
            9. Children's privacy
          </h2>
          <p className="text-zinc-700 leading-relaxed">
            99Bricks is not directed at, and should not be used by, anyone
            under the age of 18.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold text-zinc-900">
            10. Changes to this policy
          </h2>
          <p className="text-zinc-700 leading-relaxed">
            We may update this Privacy Policy from time to time. Material
            changes will be reflected by an updated "Last updated" date on
            this page.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold text-zinc-900">
            11. Grievance Officer
          </h2>
          <p className="text-zinc-700 leading-relaxed">
            Sumit, 99Bricks
            <br />
            Email:{" "}
            <a
              href="mailto:summit17092002@gmail.com"
              className="text-accent font-semibold"
            >
              summit17092002@gmail.com
            </a>
          </p>
        </section>

        <p className="mt-10 text-xs text-zinc-400">
          This is a general-purpose draft and has not been reviewed by a
          lawyer. It is intended as a starting point and should be reviewed
          by a qualified legal professional before you rely on it, especially
          as the Platform grows.
        </p>
      </div>
    </main>
  );
}
