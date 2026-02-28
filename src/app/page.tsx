import Link from 'next/link';
import Image from 'next/image';
import PricingButton from '@/components/PricingButton';

const FEATURES = [
  { icon: 'fa-bolt', title: 'Lightning Fast', desc: 'Process thousands of photos in minutes, not hours. AI sorts 5-10 images per second.' },
  { icon: 'fa-bullseye', title: '95%+ Accuracy', desc: 'Dual AI engine combines cloud classification with local color science for industry-leading precision.' },
  { icon: 'fa-layer-group', title: 'Batch Processing', desc: 'Upload up to 5,000+ images at once. Drag & drop folders, ZIPs, or individual files.' },
  { icon: 'fa-car', title: 'Car Detection', desc: 'AI finds the car in every photo — ignoring backgrounds, shadows, and reflections.' },
  { icon: 'fa-palette', title: '13 Color Categories', desc: 'Red, Blue, Green, Yellow, Orange, Purple, Pink, Brown, Black, White, Silver/Grey, and more.' },
  { icon: 'fa-exchange-alt', title: 'Quick Reassign', desc: 'Mis-sorted? One click to move any photo to the correct color folder.' },
  { icon: 'fa-stamp', title: 'Watermark Editor', desc: 'Add your studio watermark to sorted photos on export. Available on Pro & Enterprise.' },
  { icon: 'fa-shield-alt', title: 'Secure & Private', desc: 'Your photos are processed and deleted. We never store or share your images.' },
];

const TIERS = [
  {
    name: 'Starter',
    price: 29,
    images: '500',
    features: ['500 images/month', 'AI car detection', '13 color categories', 'ZIP download', 'Quick reassign'],
    popular: false,
    cta: 'Get Started',
  },
  {
    name: 'Pro',
    price: 79,
    images: '5,000',
    features: ['5,000 images/month', 'Everything in Starter', 'Watermark editor', 'Priority processing', 'Email support'],
    popular: true,
    cta: 'Go Pro',
  },
  {
    name: 'Enterprise',
    price: 199,
    images: 'Unlimited',
    features: ['Unlimited images', 'Everything in Pro', 'API access', 'Custom color categories', 'Dedicated support', 'SLA guarantee'],
    popular: false,
    cta: 'Contact Sales',
  },
];

const STEPS = [
  { num: '01', title: 'Upload', desc: 'Drag & drop your car photos or ZIP archives. We handle batches of 5,000+.', icon: 'fa-cloud-upload-alt' },
  { num: '02', title: 'AI Sorts', desc: 'Our dual AI engine detects each car and classifies its color in under a second.', icon: 'fa-microchip' },
  { num: '03', title: 'Download', desc: 'Get a perfectly organized ZIP with photos sorted into color folders.', icon: 'fa-folder-open' },
];

// Showcase images — high-impact automotive photography from Unsplash
const HERO_IMAGES = [
  { src: 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=600&h=400&fit=crop', alt: 'Red sports car', color: 'Red' },
  { src: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=600&h=400&fit=crop', alt: 'Yellow Porsche', color: 'Yellow' },
  { src: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&h=400&fit=crop', alt: 'Black Porsche 911', color: 'Black' },
  { src: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600&h=400&fit=crop', alt: 'Blue Corvette', color: 'Blue' },
  { src: 'https://images.unsplash.com/photo-1542362567-b07e54358753?w=600&h=400&fit=crop', alt: 'Orange McLaren', color: 'Orange' },
  { src: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=600&h=400&fit=crop', alt: 'White classic car', color: 'White' },
];

const GALLERY_IMAGES = [
  { src: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=500&h=350&fit=crop', alt: 'Drift car smoke', caption: 'Drifting' },
  { src: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=500&h=350&fit=crop', alt: 'Front view sports car', caption: 'Street Racing' },
  { src: 'https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=500&h=350&fit=crop', alt: 'Race track', caption: 'Track Day' },
  { src: 'https://images.unsplash.com/photo-1619405399517-d7fce0f13302?w=500&h=350&fit=crop', alt: 'Muscle car', caption: 'Muscle Cars' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* ═══ NAV ═══ */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-card-solid border-b border-white/5">
        <div className="container mx-auto px-6 max-w-6xl flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="AutoHue" width={36} height={36} className="w-9 h-9 object-contain" priority />
            <span className="font-heading text-xl font-bold">
              <span className="text-white">Auto</span>
              <span className="text-racing-500">Hue</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-white/50">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-white/60 hover:text-white transition-colors px-4 py-2">
              Log In
            </Link>
            <Link href="/sort" className="btn-racing text-sm px-5 py-2.5 rounded-xl">
              Try Free
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden pt-28 pb-8">
        {/* Hero background image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1920&h=1080&fit=crop"
            alt="Luxury car on dark background"
            fill
            className="object-cover object-center"
            priority
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-[#0a0a0aee] to-[#0a0a0a]" />
          <div className="absolute inset-0 bg-gradient-to-r from-racing-900/40 via-transparent to-racing-900/20" />
        </div>

        <div className="container mx-auto px-6 max-w-6xl relative z-10">
          <div className="max-w-3xl mx-auto text-center pt-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-racing-600/10 border border-racing-600/20 text-racing-400 text-xs font-semibold mb-8 animate-fade-up">
              <span className="w-2 h-2 rounded-full bg-racing-500 animate-pulse" />
              AI-Powered Color Sorting
            </div>

            <h1 className="text-5xl md:text-7xl font-heading font-black tracking-tight leading-[1.1] mb-6 animate-fade-up">
              Sort Car Photos
              <br />
              <span className="text-racing-500 text-glow-red">By Color.</span>
              <br />
              <span className="text-white/40">Instantly.</span>
            </h1>

            <p className="text-lg md:text-xl text-white/50 max-w-xl mx-auto mb-10 animate-fade-up anim-delay-1">
              Upload thousands of car photos and let AI sort them into color folders
              in minutes. Built for automotive photographers who value their time.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up anim-delay-2">
              <Link href="/sort" className="btn-racing text-lg px-10 py-4 rounded-2xl shadow-xl glow-red flex items-center gap-3">
                <i className="fas fa-flag-checkered" />
                Start Sorting Free
              </Link>
              <a href="#how-it-works" className="btn-carbon text-lg px-8 py-4 rounded-2xl flex items-center gap-3">
                <i className="fas fa-play-circle" />
                See How It Works
              </a>
            </div>

            {/* Stats bar */}
            <div className="flex items-center justify-center gap-8 md:gap-12 mt-16 pt-8 border-t border-white/5 animate-fade-up anim-delay-3">
              {[
                { val: '10x', label: 'Faster than manual' },
                { val: '95%+', label: 'Accuracy rate' },
                { val: '5,000+', label: 'Images per batch' },
              ].map((s, i) => (
                <div key={i} className="text-center">
                  <div className="text-2xl md:text-3xl font-heading font-black text-racing-500">{s.val}</div>
                  <div className="text-xs text-white/30 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Floating car showcase cards ── */}
          <div className="mt-16 mb-8">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 stagger">
              {HERO_IMAGES.map((img, i) => (
                <div key={i} className="showcase-card group relative rounded-2xl overflow-hidden aspect-[3/2]">
                  <Image
                    src={img.src}
                    alt={img.alt}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute bottom-0 left-0 right-0 p-2 text-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-[10px] font-bold text-white bg-racing-600/80 px-2 py-0.5 rounded-full">{img.color}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ AUTOMOTIVE GALLERY STRIP ═══ */}
      <section className="py-16 overflow-hidden relative">
        <div className="racing-stripe absolute inset-x-0 top-0 h-px" />
        <div className="container mx-auto px-6 max-w-6xl mb-10">
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-heading font-black mb-3">
              Built for <span className="text-racing-500">Car Enthusiasts</span>
            </h2>
            <p className="text-white/40 text-sm max-w-md mx-auto">From drag strips to showrooms — we sort every type of automotive photography.</p>
          </div>
        </div>
        <div className="flex gap-4 px-6 gallery-scroll">
          {GALLERY_IMAGES.map((img, i) => (
            <div key={i} className="gallery-card group relative flex-shrink-0 w-72 md:w-80 rounded-2xl overflow-hidden aspect-[4/3]">
              <Image
                src={img.src}
                alt={img.alt}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <span className="text-xs font-bold text-racing-400 uppercase tracking-widest">{img.caption}</span>
              </div>
              <div className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <i className="fas fa-palette text-racing-500 text-xs" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section id="how-it-works" className="py-24">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-black mb-4">
              Three Steps. <span className="text-racing-500">Zero Effort.</span>
            </h2>
            <p className="text-white/40 max-w-md mx-auto">From upload to perfectly sorted folders in under a minute.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 stagger">
            {STEPS.map((step) => (
              <div key={step.num} className="glass-card rounded-2xl p-8 text-center red-accent-top">
                <div className="w-16 h-16 rounded-2xl bg-racing-600/10 border border-racing-600/20 flex items-center justify-center mx-auto mb-6">
                  <i className={`fas ${step.icon} text-racing-500 text-2xl`} />
                </div>
                <div className="text-[10px] font-mono font-bold text-racing-600 tracking-widest mb-2">STEP {step.num}</div>
                <h3 className="text-xl font-heading font-bold mb-3">{step.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section id="features" className="py-24 relative">
        <div className="racing-stripe absolute inset-x-0 top-0 h-px" />
        {/* Background car image */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <Image
            src="https://images.unsplash.com/photo-1514316454349-750a7fd3da3a?w=1920&h=800&fit=crop"
            alt="Sports car background"
            fill
            className="object-cover object-center opacity-[0.04]"
            unoptimized
          />
        </div>
        <div className="container mx-auto px-6 max-w-6xl relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-black mb-4">
              Built for <span className="text-racing-500">Speed & Precision</span>
            </h2>
            <p className="text-white/40 max-w-md mx-auto">Everything you need to sort car photos like a pro.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 stagger">
            {FEATURES.map((f, i) => (
              <div key={i} className="glass-card rounded-2xl p-6 group hover:border-racing-600/20 transition-all">
                <div className="w-10 h-10 rounded-xl bg-racing-600/10 flex items-center justify-center mb-4 group-hover:bg-racing-600/20 transition-colors">
                  <i className={`fas ${f.icon} text-racing-500`} />
                </div>
                <h3 className="font-heading font-bold text-sm mb-2">{f.title}</h3>
                <p className="text-xs text-white/35 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SHOWCASE — Color sorting demo ═══ */}
      <section className="py-24 relative overflow-hidden">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="glass-card rounded-3xl overflow-hidden red-accent-top">
            <div className="grid md:grid-cols-2 gap-0">
              {/* Left — image */}
              <div className="relative h-72 md:h-auto min-h-[320px]">
                <Image
                  src="https://images.unsplash.com/photo-1525609004556-c46c7d6cf023?w=800&h=600&fit=crop"
                  alt="Row of colorful cars"
                  fill
                  className="object-cover"
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0a0a0a] md:block hidden" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] to-transparent md:hidden" />
              </div>
              {/* Right — copy */}
              <div className="p-8 md:p-12 flex flex-col justify-center">
                <div className="text-[10px] font-bold text-racing-500 uppercase tracking-widest mb-3">
                  <i className="fas fa-magic mr-1" /> How It Works
                </div>
                <h3 className="text-2xl md:text-3xl font-heading font-black mb-4">
                  From Chaos to <span className="text-racing-500">Color-Sorted</span> Folders
                </h3>
                <p className="text-white/40 text-sm leading-relaxed mb-6">
                  Upload a mixed batch of car photos from any shoot — auctions, dealerships, car shows, drag meets.
                  Our AI detects each vehicle, analyzes the dominant body color, and sorts every image into the right folder.
                </p>
                <div className="flex flex-wrap gap-2">
                  {['Red', 'Blue', 'Black', 'White', 'Silver', 'Yellow', 'Green', 'Orange'].map(c => (
                    <span key={c} className="text-[10px] font-bold bg-white/5 border border-white/10 rounded-full px-3 py-1 text-white/50">{c}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section id="pricing" className="py-24">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-black mb-4">
              Simple, <span className="text-racing-500">Transparent</span> Pricing
            </h2>
            <p className="text-white/40 max-w-md mx-auto">Start free. Scale as you grow. No hidden fees.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 stagger">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`glass-card rounded-3xl p-8 relative ${tier.popular ? 'pricing-card-popular border-racing-600/30' : ''}`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-racing-600 text-white text-xs font-bold shadow-lg">
                    Most Popular
                  </div>
                )}
                <div className="text-center mb-6">
                  <h3 className="font-heading text-xl font-bold mb-2">{tier.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-heading font-black text-white">${tier.price}</span>
                    <span className="text-white/30 text-sm">/month</span>
                  </div>
                  <p className="text-xs text-white/30 mt-2">{tier.images} images/month</p>
                </div>
                <ul className="space-y-3 mb-8">
                  {tier.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-white/60">
                      <i className="fas fa-check text-racing-500 text-xs" />
                      {f}
                    </li>
                  ))}
                </ul>
                <PricingButton plan={tier.name} label={tier.cta} popular={tier.popular} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="py-24">
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="relative rounded-3xl overflow-hidden red-accent-top">
            {/* Background image for CTA */}
            <div className="absolute inset-0 z-0">
              <Image
                src="https://images.unsplash.com/photo-1504215680853-026ed2a45def?w=1200&h=600&fit=crop"
                alt="Racing background"
                fill
                className="object-cover opacity-20"
                unoptimized
              />
              <div className="absolute inset-0 bg-[#0a0a0a]/90" />
            </div>
            <div className="glass-card rounded-3xl p-12 text-center relative overflow-hidden">
              <div className="checkered-bg absolute inset-0 opacity-30" />
              <div className="relative z-10">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-racing-600/20 border border-racing-600/30 mb-6 glow-red">
                  <i className="fas fa-flag-checkered text-racing-500 text-2xl" />
                </div>
                <h2 className="text-3xl md:text-4xl font-heading font-black mb-4">
                  Ready to <span className="text-racing-500">Save Hours</span>?
                </h2>
                <p className="text-white/40 max-w-lg mx-auto mb-8">
                  Join hundreds of automotive photographers who sort their car photos 10x faster with AutoHue.
                </p>
                <Link href="/sort" className="btn-racing text-lg px-10 py-4 rounded-2xl shadow-xl glow-red inline-flex items-center gap-3">
                  <i className="fas fa-rocket" />
                  Start Sorting Free
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-white/5 py-12">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <Image src="/logo.png" alt="AutoHue" width={32} height={32} className="w-8 h-8 object-contain" />
              <span className="font-heading font-bold">
                <span className="text-white">Auto</span>
                <span className="text-racing-500">Hue</span>
              </span>
            </div>
            <div className="flex items-center gap-6 text-xs text-white/30">
              <a href="#" className="hover:text-white/60 transition-colors">Privacy</a>
              <a href="#" className="hover:text-white/60 transition-colors">Terms</a>
              <a href="#" className="hover:text-white/60 transition-colors">Support</a>
              <span>&copy; {new Date().getFullYear()} AutoHue. All rights reserved.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
