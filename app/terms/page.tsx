import Link from "next/link";

export const metadata = {
  title: "Terms of Service | 99Bricks",
  description: "Terms of Service for 99Bricks, Jaipur's map-based property listing platform.",
};

export default function TermsPage() {
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
          Terms of Service
        </h1>

        <p className="mt-2 text-sm text-zinc-500">
          Last updated: 20 September 2026
        </p>

        <p className="mt-6 text-zinc-700 leading-relaxed">
          Welcome to 99Bricks. These Terms of Service ("Terms") govern your
          access to and use of the 99Bricks website and services
          (the "Platform"). By creating an account, browsing listings, or
          otherwise using the Platform, you agree to these Terms. If you do
          not agree, please do not use the Platform.
        </p>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold text-zinc-900">
            1. What 99Bricks is
          </h2>
          <p className="text-zinc-700 leading-relaxed">
            99Bricks is an online listing platform that lets property owners,
            agents, and builders advertise properties in and around Jaipur,
            and lets buyers and tenants search, compare, and contact sellers
            about those properties.
          </p>
          <p className="text-zinc-700 leading-relaxed">
            <span className="font-semibold">99Bricks is not a real estate
            broker, agent, or dealer, and is not a party to any sale, purchase,
            or rental transaction.</span> We provide a platform for buyers and
            sellers to find and contact each other; we do not negotiate deals,
            handle payments, hold funds in escrow, verify property titles, or
            guarantee the outcome of any transaction. Every transaction is
            strictly between the buyer/tenant and the seller/landlord.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold text-zinc-900">
            2. Eligibility and accounts
          </h2>
          <p className="text-zinc-700 leading-relaxed">
            You must be at least 18 years old and legally capable of entering
            into contracts under Indian law to use 99Bricks. When you create
            an account, you agree to provide accurate, current information
            and to keep your login credentials confidential. You are
            responsible for all activity that happens under your account.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold text-zinc-900">
            3. Listings posted by users
          </h2>
          <p className="text-zinc-700 leading-relaxed">
            Anyone who posts a listing on 99Bricks (a "Seller") is solely
            responsible for the accuracy, legality, and completeness of that
            listing, including price, area, ownership status, and any
            photographs or descriptions provided. 99Bricks reviews listings
            before they go live and may reject, edit, or remove any listing
            at its discretion, but this review does not amount to a guarantee
            of accuracy or legal compliance.
          </p>
          <p className="text-zinc-700 leading-relaxed">
            If you are a builder or promoter advertising an under-construction
            project, you are responsible for ensuring the project carries a
            valid RERA registration where required under the Real Estate
            (Regulation and Development) Act, 2016, and for providing that
            RERA number accurately. 99Bricks does not verify RERA registration
            status on your behalf.
          </p>
          <p className="text-zinc-700 leading-relaxed">
            You may not post listings that are fake, duplicated across
            multiple unrelated addresses, misleading about price or
            condition, or for a property you do not have the right to sell,
            lease, or advertise.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold text-zinc-900">
            4. Prohibited conduct
          </h2>
          <p className="text-zinc-700 leading-relaxed">
            You agree not to: post false or fraudulent listings; impersonate
            another person or entity; scrape, copy, or republish Platform
            data at scale without permission; harass or spam other users;
            attempt to bypass the listing approval process; or use the
            Platform for any unlawful purpose.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold text-zinc-900">
            5. Do your own due diligence
          </h2>
          <p className="text-zinc-700 leading-relaxed">
            Before entering into any agreement to buy, sell, or rent a
            property found through 99Bricks, you should independently verify
            ownership, title, encumbrances, approvals, and any other legal or
            physical aspect of the property — ideally with the help of a
            qualified lawyer. Tools on the Platform such as the EMI
            calculator provide estimates only and are not financial advice;
            confirm actual loan terms with your bank or lender.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold text-zinc-900">
            6. Intermediary status
          </h2>
          <p className="text-zinc-700 leading-relaxed">
            99Bricks acts as an intermediary that hosts content posted by
            users, in line with the Information Technology Act, 2000 and the
            Information Technology (Intermediary Guidelines and Digital Media
            Ethics Code) Rules. We do not endorse or vouch for user-submitted
            listings. If you believe a listing is fraudulent, misleading, or
            infringes your rights, please report it using the "Report
            listing" option or contact us using the details below, and we
            will review and act on genuine complaints.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold text-zinc-900">
            7. Disclaimer of warranties and limitation of liability
          </h2>
          <p className="text-zinc-700 leading-relaxed">
            The Platform and all listings are provided "as is" without
            warranties of any kind, express or implied, including as to
            accuracy, completeness, or fitness for a particular purpose. To
            the fullest extent permitted by law, 99Bricks and its operators
            are not liable for any loss or damage arising from your use of
            the Platform, your reliance on any listing, or any transaction
            you enter into with another user.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold text-zinc-900">
            8. Suspension and termination
          </h2>
          <p className="text-zinc-700 leading-relaxed">
            We may suspend or terminate access to the Platform for any
            account that violates these Terms, posts fraudulent content, or
            otherwise misuses the service, with or without prior notice.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold text-zinc-900">
            9. Governing law
          </h2>
          <p className="text-zinc-700 leading-relaxed">
            These Terms are governed by the laws of India. Any disputes will
            be subject to the exclusive jurisdiction of the courts in
            Jaipur, Rajasthan.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold text-zinc-900">
            10. Changes to these Terms
          </h2>
          <p className="text-zinc-700 leading-relaxed">
            We may update these Terms from time to time. We will post the
            updated version on this page with a new "Last updated" date.
            Continued use of the Platform after changes are posted means you
            accept the revised Terms.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-bold text-zinc-900">
            11. Grievance officer and contact
          </h2>
          <p className="text-zinc-700 leading-relaxed">
            For any questions, complaints, or takedown requests regarding
            these Terms or content on the Platform, please contact our
            Grievance Officer:
          </p>
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
