import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — FireVision IPTV',
  description: 'Privacy Policy for FireVision IPTV',
};

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-background overflow-y-auto flex flex-col">
      <div className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 lg:px-10 h-14 flex items-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </div>

      <div className="flex-1 max-w-3xl mx-auto px-6 lg:px-10 py-12 w-full">
        <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: March 18, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="text-lg font-display font-semibold mb-3">1. Introduction</h2>
            <p>
              FireVision IPTV (&quot;we&quot;, &quot;our&quot;, or &quot;the Service&quot;) is a
              self-hosted IPTV channel management platform. This Privacy Policy explains how we
              collect, use, and protect your information when you use our Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-3">2. Information We Collect</h2>
            <p className="mb-3">We collect the following types of information:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Account Information</strong> — Username, email address, and password hash
                when you register an account.
              </li>
              <li>
                <strong>Device Information</strong> — Device identifiers and pairing codes when you
                pair a TV device with your account.
              </li>
              <li>
                <strong>Usage Data</strong> — Session activity, login timestamps, and feature usage
                for service operation and improvement.
              </li>
              <li>
                <strong>Channel Data</strong> — Channel lists, import sources, and playback
                preferences you configure.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-3">
              3. How We Use Your Information
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                To provide and maintain the Service, including user authentication and device
                pairing.
              </li>
              <li>To manage your channel lists and deliver IPTV content to your paired devices.</li>
              <li>
                To send service-related communications such as account verification and password
                reset emails.
              </li>
              <li>To monitor service health and prevent abuse.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-3">4. Data Storage & Security</h2>
            <p>
              As a self-hosted application, your data is stored on the infrastructure managed by the
              instance operator. We recommend that operators follow security best practices
              including encryption at rest, regular backups, and access controls. Passwords are
              hashed and never stored in plain text.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-3">5. Third-Party Services</h2>
            <p>
              The Service may integrate with third-party authentication providers (Google, GitHub)
              if configured by the instance operator. When you use OAuth login, we receive only the
              profile information authorized by you through the provider&apos;s consent screen. We
              do not sell or share your data with third parties for advertising purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-3">6. Data Retention</h2>
            <p>
              Your account data is retained for as long as your account is active. Session data and
              activity logs are retained for operational purposes and may be periodically purged by
              the instance operator. You may request deletion of your account and associated data by
              contacting the instance administrator.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-3">7. Your Rights</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request deletion of your account and data.</li>
              <li>Export your channel lists and configuration data.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-3">8. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Changes will be posted on this
              page with an updated revision date. Continued use of the Service after changes
              constitutes acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-3">9. Contact</h2>
            <p>
              If you have questions about this Privacy Policy, please contact the instance
              administrator or open an issue on the{' '}
              <a
                href="https://github.com/akshaynikhare/FireVisionIPTV"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                GitHub repository
              </a>
              .
            </p>
          </section>
        </div>
      </div>

      <footer className="border-t border-border">
        <div className="max-w-3xl mx-auto px-6 lg:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">&copy; 2025 FireVision IPTV</span>
          <Link
            href="/terms"
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            Terms of Service
          </Link>
        </div>
      </footer>
    </main>
  );
}
