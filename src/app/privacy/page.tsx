import Link from 'next/link';
import Image from 'next/image';

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-heading font-black mb-8">Privacy Policy</h1>

        <div className="prose-dark space-y-6 text-sm text-white/50 leading-relaxed">
          <p><strong className="text-white/70">Last updated:</strong> February 2026</p>

          <section>
            <h2 className="text-lg font-heading font-bold text-white mb-2">1. Information We Collect</h2>
            <p>When you create an account, we collect your name, email address, and hashed password. We do not store passwords in plain text. When you use our sorting service, your car photos are temporarily uploaded for processing.</p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold text-white mb-2">2. How We Use Your Data</h2>
            <p>Your account information is used solely to provide the AutoHue service — authenticating you, tracking your usage credits, and managing your subscription. Uploaded photos are processed for color classification only.</p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold text-white mb-2">3. Photo Storage & Retention</h2>
            <p>Uploaded photos and sorted output files are stored temporarily based on your subscription tier:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong className="text-white/70">Free:</strong> 24 hours</li>
              <li><strong className="text-white/70">Starter:</strong> 7 days</li>
              <li><strong className="text-white/70">Pro:</strong> 30 days</li>
              <li><strong className="text-white/70">Enterprise:</strong> 90 days</li>
            </ul>
            <p className="mt-2">After the retention period, files are automatically deleted. You may also manually delete your files at any time from the dashboard.</p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold text-white mb-2">4. Third-Party Services</h2>
            <p>We use the following third-party services:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong className="text-white/70">Stripe</strong> for payment processing</li>
              <li><strong className="text-white/70">Nyckel</strong> for AI color classification</li>
              <li><strong className="text-white/70">Vercel</strong> for hosting</li>
              <li><strong className="text-white/70">Neon</strong> for database hosting</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold text-white mb-2">5. Data Security</h2>
            <p>We use industry-standard encryption (HTTPS/TLS) for all data in transit. Passwords are hashed using bcrypt. We do not sell, rent, or share your personal information with third parties for marketing purposes.</p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold text-white mb-2">6. Your Rights</h2>
            <p>You may request deletion of your account and all associated data at any time by contacting us. Upon deletion, all personal information and uploaded files will be permanently removed.</p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold text-white mb-2">7. Contact</h2>
            <p>For privacy-related inquiries, contact us via our <Link href="/support" className="text-racing-400 hover:underline">support page</Link> or through <a href="https://www.facebook.com/pennywiseitoz" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Penny Wise I.T on Facebook</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
