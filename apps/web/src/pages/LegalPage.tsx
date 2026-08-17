import {
  ArrowLeft,
  CheckCircle2,
  LifeBuoy,
  Scale,
  ShieldCheck,
} from "lucide-react";

import PublicFooter from "../components/PublicFooter";
import "./LegalPage.css";

type LegalPageKind = "privacy" | "terms" | "support";
type LegalPageProps = { page: LegalPageKind };

const SUPPORT_EMAIL = "treenjohnm@gmail.com";
const EFFECTIVE_DATE = "August 16, 2026";

function PrivacyPolicy() {
  return (
    <>
      <div className="legal-heading">
        <div className="legal-heading-icon"><ShieldCheck size={28} /></div>
        <span className="eyebrow">Privacy</span>
        <h1>Chorevera Privacy Policy</h1>
        <p>Effective {EFFECTIVE_DATE}</p>
      </div>

      <section>
        <h2>1. Overview</h2>
        <p>Chorevera is a household chore management service. This policy explains the information Chorevera collects, why it is used, and the choices available to you.</p>
      </section>

      <section>
        <h2>2. Information we collect</h2>
        <p>We collect information you provide when you create and use an account, including your name, email address, account credentials in protected form, chores, reminder settings, household memberships, invitations, completion history, and other household-management information.</p>
        <p>We also maintain subscription and billing metadata needed to provide paid features, such as your plan, subscription status, Stripe customer identifier, and Stripe subscription identifier.</p>
        <p>Chorevera and its hosting providers may process technical and security information such as IP address, browser or device information, request information, timestamps, and security events to operate and protect the service.</p>
        <p>When you use AI-assisted household planning, Chorevera may send the planning request together with limited household context needed to generate the plan, such as household member display names, current chore titles and assignments, workload counts, reminder times, and recent completion statistics. Chorevera does not intentionally send household member email addresses, account passwords, payment-card data, or API credentials to the AI provider.</p>
      </section>

      <section>
        <h2>3. Payments</h2>
        <p>Payments are processed by Stripe. Chorevera does not store your full payment-card number or card security code. Stripe may collect and process payment and identity information under its own privacy terms.</p>
      </section>

      <section>
        <h2>4. Email delivery</h2>
        <p>Chorevera uses an email service provider to deliver account verification, password-reset, and service-related messages. Information needed to send those messages may be processed by that provider.</p>
      </section>

      <section>
        <h2>5. How we use information</h2>
        <ul>
          <li>Create, authenticate, and protect Chorevera accounts.</li>
          <li>Store and synchronize chores, households, progress, and notifications.</li>
          <li>Provide Free, Pro, and Family features.</li>
          <li>Process subscriptions and respond to billing events.</li>
          <li>Send account and service messages.</li>
          <li>Diagnose problems, prevent abuse, and improve reliability and security.</li>
          <li>Comply with legal obligations and enforce applicable terms.</li>
        </ul>
      </section>

      <section>
        <h2>6. Service providers</h2>
        <p>Chorevera relies on service providers to run the service, including Render for application and database hosting, Stripe for billing and payments, Resend for transactional email, and OpenAI for optional AI-assisted household planning. These providers process information as needed to provide their services.</p>
        <p>Chorevera does not sell your personal information.</p>
      </section>

      <section>
        <h2>7. Browser storage and notifications</h2>
        <p>Chorevera may use browser storage to maintain your authenticated session, preserve interface state, and cache limited application information. Browser notifications are used only after you grant notification permission.</p>
      </section>

      <section>
        <h2>8. Data retention</h2>
        <p>We retain information for as long as reasonably needed to operate the service, maintain security, resolve disputes, meet legal obligations, and maintain legitimate business records. Some records may remain in backups for a limited period after deletion from active systems.</p>
      </section>

      <section>
        <h2>9. Security</h2>
        <p>Chorevera uses technical and organizational safeguards intended to protect account information, including protected password storage, authenticated API access, transport encryption, access controls, security logging, and managed infrastructure. No online service can guarantee absolute security.</p>
      </section>

      <section>
        <h2>10. Children</h2>
        <p>Chorevera is not directed to children under 13, and children under 13 should not create Chorevera accounts. A parent or guardian may manage household chores for family members without creating an account for a child under 13.</p>
      </section>

      <section>
        <h2>11. Your choices and requests</h2>
        <p>You may request access, correction, or deletion of your account information, subject to applicable law and records Chorevera must retain. You can also manage subscription status through Chorevera billing tools.</p>
      </section>

      <section>
        <h2>12. Changes to this policy</h2>
        <p>We may update this policy as Chorevera changes. The effective date at the top of this page identifies the current version.</p>
      </section>

      <section>
        <h2>13. Contact</h2>
        <p>Privacy questions and requests can be sent to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
      </section>
    </>
  );
}

function TermsOfService() {
  return (
    <>
      <div className="legal-heading">
        <div className="legal-heading-icon"><Scale size={28} /></div>
        <span className="eyebrow">Terms</span>
        <h1>Chorevera Terms of Service</h1>
        <p>Effective {EFFECTIVE_DATE}</p>
      </div>

      <section><h2>1. Agreement</h2><p>By creating an account or using Chorevera, you agree to these Terms of Service. If you do not agree, do not use the service.</p></section>
      <section><h2>2. Eligibility</h2><p>You must be at least 13 years old to create a Chorevera account. If you are under the age of majority where you live, you should use Chorevera only with permission from a parent or legal guardian.</p></section>
      <section><h2>3. Accounts</h2><p>You are responsible for providing accurate account information, maintaining the confidentiality of your credentials, and activities performed through your account. Notify Chorevera promptly if you believe your account has been compromised.</p></section>
      <section><h2>4. Households and invitations</h2><p>Chorevera lets users create households, invite members, assign chores, and share household activity. Only invite people you are authorized to include. Household owners may have additional management permissions.</p></section>
      <section><h2>5. Subscriptions and billing</h2><p>Some Chorevera features require a paid subscription. Current pricing and plan features are shown before checkout. Paid subscriptions are processed by Stripe and may renew automatically until canceled.</p><p>You can manage or cancel an active subscription through Chorevera's billing tools. Unless applicable law requires otherwise, charges already incurred are not automatically refundable. Chorevera may choose to issue refunds in appropriate cases.</p></section>
      <section><h2>6. Acceptable use</h2><p>You may not use Chorevera to violate law, interfere with the service, gain unauthorized access to systems or accounts, distribute malicious code, abuse other users, or misuse Chorevera in a way that could harm the service or others.</p></section>
      <section><h2>7. AI-assisted planning</h2><p>Chorevera may provide AI-generated household planning suggestions. AI output can be incomplete or inaccurate and is provided as a proposed plan for review, not as a guarantee of the best assignment or schedule. Review proposed actions before applying them. Household owners remain responsible for approving changes and deciding whether an AI-generated recommendation is appropriate for their household.</p></section>
      <section><h2>8. Your content</h2><p>You retain ownership of information you enter into Chorevera. You grant Chorevera the limited rights needed to host, process, transmit, back up, and display that information solely to operate and improve the service, including processing limited household context through service providers when you request an AI-assisted plan.</p></section>
      <section><h2>9. Service availability</h2><p>Chorevera may change, suspend, or discontinue features and may perform maintenance. We work to keep the service reliable but do not promise uninterrupted or error-free availability.</p></section>
      <section><h2>10. Disclaimer</h2><p>To the fullest extent permitted by applicable law, Chorevera is provided on an "as is" and "as available" basis without warranties that are not expressly stated in these Terms.</p></section>
      <section><h2>11. Limitation of liability</h2><p>To the fullest extent permitted by applicable law, Chorevera and its operator will not be liable for indirect, incidental, special, consequential, or punitive damages, or for loss of data, profits, or business opportunities resulting from use of the service.</p><p>Nothing in these Terms excludes liability that cannot legally be excluded or limited.</p></section>
      <section><h2>12. Suspension and termination</h2><p>Chorevera may suspend or terminate access when reasonably necessary to protect the service, other users, comply with law, address nonpayment, or respond to material violations of these Terms.</p></section>
      <section><h2>13. Changes</h2><p>These Terms may be updated as the service changes. Material changes may be communicated through the service or other reasonable means. Continued use after updated Terms become effective constitutes acceptance where permitted by law.</p></section>
      <section><h2>14. Governing law</h2><p>These Terms are governed by the laws of the State of Texas and applicable United States federal law, without regard to conflict-of-law principles, except where mandatory consumer law provides otherwise.</p></section>
      <section><h2>15. Contact</h2><p>Questions about these Terms can be sent to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p></section>
    </>
  );
}

function SupportPage() {
  return (
    <>
      <div className="legal-heading">
        <div className="legal-heading-icon"><LifeBuoy size={28} /></div>
        <span className="eyebrow">Support</span>
        <h1>Chorevera Support</h1>
        <p>Help with accounts, billing, households, and app issues.</p>
      </div>

      <section><h2>Contact support</h2><p>Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with a short description of the problem. Do not email passwords, full payment-card numbers, API keys, or other secrets.</p></section>
      <section><h2>Password and login help</h2><p>Use the <strong>Forgot password</strong> option on the Chorevera sign-in page to request a secure password-reset link. New accounts must verify their email before signing in.</p></section>
      <section><h2>Billing help</h2><p>Signed-in users can use Chorevera's billing controls to open the Stripe customer portal, manage payment details, and cancel an active subscription.</p></section>
      <section><h2>Security concerns</h2><p>If you believe your account or Chorevera may have a security problem, contact support promptly and include the affected account email, approximate time of the issue, and a description of what you observed. Do not include passwords or secret keys.</p></section>
      <section><h2>Service status</h2><p>During the public beta, maintenance or hosting-provider incidents may temporarily affect Chorevera. If the app appears unavailable, try again after a short interval and contact support if the problem continues.</p></section>
    </>
  );
}

export default function LegalPage({ page }: LegalPageProps) {
  return (
    <div className="legal-site-shell">
      <header className="legal-topbar">
        <a aria-label="Return to Chorevera" className="legal-brand" href="/">
          <span className="legal-brand-icon"><CheckCircle2 size={22} /></span>
          <strong>Chorevera</strong>
        </a>

        <a className="legal-back-link" href="/"><ArrowLeft size={17} />Back to app</a>
      </header>

      <main className="legal-page">
        <article className="legal-card">
          {page === "privacy" && <PrivacyPolicy />}
          {page === "terms" && <TermsOfService />}
          {page === "support" && <SupportPage />}
        </article>
      </main>

      <PublicFooter />
    </div>
  );
}

