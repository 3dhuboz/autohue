import Link from 'next/link';
import Image from 'next/image';

export default function TermsPage() {
  return (
    <div className="min-h-screen">
      <nav className="border-b border-white/5 glass-card-solid sticky top-0 z-50">
        <div className="container mx-auto px-6 max-w-6xl flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="AutoHue" width={36} height={36} className="w-9 h-9 object-contain" />
            <span className="font-heading text-lg font-bold">
              <span className="text-white">Auto</span>
              <span className="text-racing-500">Hue</span>
            </span>
          </Link>
          <Link href="/" className="text-sm text-white/40 hover:text-white transition-colors">
            <i className="fas fa-arrow-left mr-1" />Back
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-6 max-w-3xl mt-10 mb-20">
        <h1 className="text-3xl font-heading font-black mb-8">Terms of Service</h1>

        <div className="prose-dark space-y-6 text-sm text-white/50 leading-relaxed">
          <p><strong className="text-white/70">Last updated:</strong> February 2026</p>

          <section>
            <h2 className="text-lg font-heading font-bold text-white mb-2">1. Acceptance of Terms</h2>
            <p>By accessing or using AutoHue (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. AutoHue is operated by Penny Wise I.T.</p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold text-white mb-2">2. Service Description</h2>
            <p>AutoHue is an AI-powered car photo color sorting tool. You upload car photographs, our system classifies them by color, and you download the organized results. The Service is provided &quot;as is&quot; without warranty of any kind.</p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold text-white mb-2">3. User Accounts</h2>
            <p>You are responsible for maintaining the confidentiality of your account credentials. You must provide accurate information when registering. We reserve the right to suspend or terminate accounts that violate these terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold text-white mb-2">4. Subscriptions & Payments</h2>
            <p>Paid plans are billed monthly via Stripe. You may cancel at any time. Refunds are handled on a case-by-case basis. Credits do not roll over between billing periods unless otherwise stated.</p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold text-white mb-2">5. File Storage & Retention</h2>
            <p>Uploaded and sorted files are retained based on your subscription tier (Free: 24h, Starter: 7 days, Pro: 30 days, Enterprise: 90 days). After expiry, files are permanently deleted. You are responsible for downloading your files before they expire.</p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold text-white mb-2">6. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Upload illegal, harmful, or inappropriate content</li>
              <li>Attempt to reverse-engineer or exploit the Service</li>
              <li>Use the Service to infringe on intellectual property rights</li>
              <li>Exceed your plan&apos;s credit limits through automated means</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold text-white mb-2">7. AI Accuracy & Classification</h2>
            <p>AutoHue uses artificial intelligence and computer vision technologies to classify vehicle colors. While we strive for the highest accuracy (95%+), AI-powered classifications are inherently probabilistic and may occasionally be incorrect due to factors including but not limited to: lighting conditions, camera settings, reflections, multi-tone or custom paint, vehicle wraps, and image quality.</p>
            <p className="mt-2">All classification results are logged and continuously reviewed to improve accuracy. Users are provided with a one-click reassign feature to correct any misclassifications. By using the Service, you acknowledge that AI results are provided as a best-effort classification and should be reviewed before use in any critical application. AutoHue does not guarantee 100% accuracy of any individual classification.</p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold text-white mb-2">8. Limitation of Liability</h2>
            <p>AutoHue and Penny Wise I.T shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service, including but not limited to losses arising from AI misclassifications. Our total liability is limited to the amount you paid for the Service in the preceding 12 months.</p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold text-white mb-2">9. Changes to Terms</h2>
            <p>We may update these terms at any time. Continued use of the Service after changes constitutes acceptance. We will notify users of material changes via email or in-app notice.</p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold text-white mb-2">10. Contact</h2>
            <p>For questions about these terms, contact us via our <Link href="/support" className="text-racing-400 hover:underline">support page</Link> or through <a href="https://www.facebook.com/pennywiseitoz" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Penny Wise I.T on Facebook</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
