import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — FireVision IPTV',
  description: 'Terms of Service for FireVision IPTV',
};

export default function TermsOfService() {
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
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: March 18, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="text-lg font-display font-semibold mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using FireVision IPTV (&quot;the Service&quot;), you agree to be bound
              by these Terms of Service. If you do not agree to these terms, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-3">2. Description of Service</h2>
            <p>
              FireVision IPTV is a self-hosted IPTV channel management platform that allows users to
              manage channel lists, pair TV devices, import content from external sources, and
              organize their IPTV infrastructure. The Service is provided as open-source software
              and is operated by the instance administrator.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-3">3. User Accounts</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>You must provide accurate information when creating an account.</li>
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You must not share your account with others or create multiple accounts.</li>
              <li>
                The instance administrator reserves the right to suspend or terminate accounts that
                violate these terms.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-3">4. Acceptable Use</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Use the Service for any unlawful purpose or in violation of any applicable laws.
              </li>
              <li>
                Upload, import, or distribute content that infringes on intellectual property
                rights.
              </li>
              <li>
                Attempt to gain unauthorized access to the Service or other users&apos; accounts.
              </li>
              <li>Interfere with or disrupt the Service or its infrastructure.</li>
              <li>Use automated means to access the Service beyond normal API usage.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-3">5. Content & Channels</h2>
            <p>
              The Service provides tools to manage and organize IPTV channel lists. Users are solely
              responsible for the content they import, stream, or distribute through the Service.
              The Service does not host, provide, or endorse any specific IPTV content. You must
              ensure that your use of any channel sources complies with applicable copyright and
              licensing laws.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-3">6. Device Pairing</h2>
            <p>
              The Service allows pairing of TV devices with user accounts. You are responsible for
              managing your paired devices and must unpair any devices you no longer control. The
              instance administrator may limit the number of devices that can be paired per account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-3">7. Service Availability</h2>
            <p>
              As a self-hosted service, availability depends on the instance operator&apos;s
              infrastructure. The Service is provided &quot;as is&quot; without warranties of any
              kind, express or implied, including but not limited to warranties of merchantability
              or fitness for a particular purpose. We do not guarantee uninterrupted or error-free
              operation.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-3">8. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, neither the Service developers nor the
              instance operator shall be liable for any indirect, incidental, special,
              consequential, or punitive damages arising from your use of the Service, including but
              not limited to loss of data, revenue, or business opportunities.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-3">9. Modifications</h2>
            <p>
              We reserve the right to modify these Terms at any time. Changes will be posted on this
              page with an updated revision date. Your continued use of the Service after
              modifications constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-3">10. Termination</h2>
            <p>
              The instance administrator may suspend or terminate your access to the Service at any
              time for violation of these Terms. Upon termination, your right to use the Service
              ceases immediately. You may request export of your data prior to account deletion.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-display font-semibold mb-3">11. Contact</h2>
            <p>
              For questions about these Terms, contact the instance administrator or open an issue
              on the{' '}
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
            href="/privacy"
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            Privacy Policy
          </Link>
        </div>
      </footer>
    </main>
  );
}
