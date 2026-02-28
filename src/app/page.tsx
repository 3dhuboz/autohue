'use client';

import Link from 'next/link';
import Image from 'next/image';
import PricingButton from '@/components/PricingButton';
import { useState } from 'react';
import AiDisclaimer from '@/components/AiDisclaimer';

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
    retention: '7 days',
    features: ['500 images/month', 'AI car detection', '13 color categories', 'ZIP download', 'Quick reassign', '7-day file storage'],
    popular: false,
    cta: 'Get Started',
  },
  {
    name: 'Pro',
    price: 79,
    images: '5,000',
    retention: '30 days',
    features: ['5,000 images/month', 'Everything in Starter', 'Watermark editor', 'Priority processing', 'Email support', '30-day file storage'],
    popular: true,
    cta: 'Go Pro',
  },
  {
    name: 'Enterprise',
    price: 199,
    images: 'Unlimited',
    retention: '90 days',
    features: ['Unlimited images', 'Everything in Pro', 'API access', 'Custom color categories', 'Dedicated support', 'SLA guarantee', '90-day file storage'],
    popular: false,
    cta: 'Contact Sales',
  },
];

const STEPS = [
  { num: '01', title: 'Upload', desc: 'Drag & drop your car photos or ZIP archives. We handle batches of 5,000+.', icon: 'fa-cloud-upload-alt' },
  { num: '02', title: 'AI Sorts', desc: 'Our dual AI engine detects each car and classifies its color in under a second.', icon: 'fa-microchip' },
  { num: '03', title: 'Download', desc: 'Get a perfectly organized ZIP with photos sorted into color folders.', icon: 'fa-folder-open' },
];

// Interactive color demo cars — ALL visually verified
const DEMO_CARS = [
  { src: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=600&h=400&fit=crop', alt: 'Red Ferrari', color: 'Red', hex: '#ef4444', fact: 'Red cars account for about 10% of all vehicles on the road' },
  { src: 'https://images.unsplash.com/photo-1562911791-c7a97b729ec5?w=600&h=400&fit=crop', alt: 'Yellow Camaro', color: 'Yellow', hex: '#eab308', fact: 'Yellow is the rarest car color — less than 2% of cars worldwide' },
  { src: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&h=400&fit=crop', alt: 'Black Porsche 911', color: 'Black', hex: '#334155', fact: 'Black is the 2nd most popular car color globally at ~19%' },
  { src: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600&h=400&fit=crop', alt: 'Blue Camaro', color: 'Blue', hex: '#3b82f6', fact: 'Blue cars tend to have higher resale value than average' },
  { src: 'https://images.unsplash.com/photo-1581650107963-3e8c1f48241b?w=600&h=400&fit=crop', alt: 'Orange Mustang', color: 'Orange', hex: '#f97316', fact: 'Orange is a signature color for McLaren and Lamborghini' },
  { src: 'https://images.unsplash.com/photo-1616455579100-2ceaa4eb2d37?w=600&h=400&fit=crop', alt: 'White BMW M5', color: 'White', hex: '#e2e8f0', fact: 'White has been the #1 most popular car color for over a decade' },
];

// Fun facts for the facts section
const FUN_FACTS = [
  { icon: 'fa-globe', stat: '39%', label: 'of all cars worldwide are white, grey, or silver', color: 'text-blue-400' },
  { icon: 'fa-palette', stat: '13+', label: 'distinct color categories detected by our AI', color: 'text-purple-400' },
  { icon: 'fa-eye', stat: '10M+', label: 'color pixels analyzed per image for accuracy', color: 'text-green-400' },
  { icon: 'fa-clock', stat: '<1s', label: 'average time to detect, analyze & sort one photo', color: 'text-amber-400' },
  { icon: 'fa-car', stat: '95%+', label: 'car detection rate even in cluttered backgrounds', color: 'text-red-400' },
  { icon: 'fa-brain', stat: 'Dual AI', label: 'ONNX neural net + CIE LAB color science combined', color: 'text-indigo-400' },
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
  { src: 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=500&h=350&fit=crop', alt: 'Red sports car on road', caption: 'Drifting' },
  { src: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=500&h=350&fit=crop', alt: 'Front view sports car', caption: 'Street Racing' },
  { src: 'https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=500&h=350&fit=crop', alt: 'Race track', caption: 'Track Day' },
  { src: 'https://images.unsplash.com/photo-1619405399517-d7fce0f13302?w=500&h=350&fit=crop', alt: 'Muscle car', caption: 'Muscle Cars' },
];

export default function LandingPage() {
  const [hoveredCar, setHoveredCar] = useState<number | null>(null);

  return (
    <div className="min-h-screen">
      {/* ═══ NAV ═══ */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-card-solid border-b border-white/5">
        <div className="container mx-auto px-6 max-w-6xl flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="AutoHue" width={48} height={48} className="w-12 h-12 object-contain" priority />
            <span className="font-heading text-2xl font-bold">
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
          <div className="absolute inset-0 bg-gradient-to-b from-[#111113] via-[#111113dd] to-[#111113]" />
          <div className="absolute inset-0 bg-gradient-to-r from-racing-900/30 via-transparent to-racing-900/15" />
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

            <p className="text-lg md:text-xl text-white/60 max-w-xl mx-auto mb-10 animate-fade-up anim-delay-1">
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

      {/* ═══ INTERACTIVE COLOR DEMO ═══ */}
      <section className="py-24 relative overflow-hidden">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold mb-4">
              <i className="fas fa-mouse-pointer" /> Interactive Demo
            </div>
            <h2 className="text-3xl md:text-4xl font-heading font-black mb-4">
              Hover to See Our <span className="text-racing-500">AI in Action</span>
            </h2>
            <p className="text-white/40 max-w-md mx-auto">Move your mouse over any car — our AI instantly identifies the color. This is exactly what happens during sorting.</p>
          </div>

          {/* Demo grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {DEMO_CARS.map((car, i) => (
              <div
                key={i}
                className="group relative rounded-2xl overflow-hidden aspect-[3/2] cursor-crosshair"
                onMouseEnter={() => setHoveredCar(i)}
                onMouseLeave={() => setHoveredCar(null)}
              >
                <Image
                  src={car.src}
                  alt={car.alt}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  unoptimized
                />
                {/* Dark overlay */}
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-all duration-300" />

                {/* Scanning effect on hover */}
                {hoveredCar === i && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 border-2 border-racing-500/50 rounded-2xl animate-pulse" />
                    <div className="absolute inset-0 bg-gradient-to-b from-racing-500/5 via-transparent to-racing-500/5 animate-scan-vertical" />
                    {/* Corner brackets */}
                    <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-racing-500/70 rounded-tl" />
                    <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-racing-500/70 rounded-tr" />
                    <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-racing-500/70 rounded-bl" />
                    <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-racing-500/70 rounded-br" />
                  </div>
                )}

                {/* Result badge */}
                <div className={`absolute bottom-0 inset-x-0 transition-all duration-300 ${hoveredCar === i ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
                  <div className="bg-black/80 backdrop-blur-xl p-3 border-t border-white/10">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-5 h-5 rounded-full border-2 border-white/30" style={{ backgroundColor: car.hex }} />
                      <span className="font-heading font-bold text-sm text-white">{car.color}</span>
                      <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold ml-auto">
                        <i className="fas fa-check mr-1" />DETECTED
                      </span>
                    </div>
                    <p className="text-[10px] text-white/40 leading-relaxed">
                      <i className="fas fa-lightbulb text-amber-400/60 mr-1" />{car.fact}
                    </p>
                  </div>
                </div>

                {/* Default label */}
                <div className={`absolute top-3 left-3 transition-all duration-300 ${hoveredCar === i ? 'opacity-0 scale-75' : 'opacity-100 scale-100'}`}>
                  <span className="text-[10px] bg-black/50 backdrop-blur-sm text-white/60 px-2 py-1 rounded-lg font-semibold">
                    <i className="fas fa-crosshairs mr-1 text-racing-500/60" />Hover me
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom prompt */}
          <div className="text-center">
            <p className="text-white/25 text-xs">
              <i className="fas fa-info-circle mr-1" />
              Our AI analyzes 10+ color regions per vehicle using CIE LAB color science for maximum accuracy
            </p>
          </div>
        </div>
      </section>

      {/* ═══ FUN FACTS ═══ */}
      <section className="py-20 relative">
        <div className="racing-stripe absolute inset-x-0 top-0 h-px" />
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-heading font-black mb-4">
              The Science Behind <span className="text-racing-500">the Sort</span>
            </h2>
            <p className="text-white/40 max-w-lg mx-auto">AutoHue combines cutting-edge computer vision with automotive color science. Here&apos;s what makes it special.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger">
            {FUN_FACTS.map((fact, i) => (
              <div key={i} className="glass-card rounded-2xl p-6 group hover:border-white/15 transition-all text-center">
                <div className={`w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform ${fact.color}`}>
                  <i className={`fas ${fact.icon} text-xl`} />
                </div>
                <div className="text-3xl font-heading font-black text-white mb-1">{fact.stat}</div>
                <p className="text-xs text-white/40 leading-relaxed">{fact.label}</p>
              </div>
            ))}
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
                  <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full bg-racing-600/10 border border-racing-600/20 text-[10px] text-racing-400 font-semibold">
                    <i className="fas fa-database text-[8px]" />
                    {tier.retention} storage
                  </div>
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
              <div className="absolute inset-0 bg-[#111113]/90" />
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
                <p className="text-white/50 max-w-lg mx-auto mb-8">
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
            <div className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="AutoHue" width={40} height={40} className="w-10 h-10 object-contain" />
              <span className="font-heading text-lg font-bold">
                <span className="text-white">Auto</span>
                <span className="text-racing-500">Hue</span>
              </span>
            </div>
            <div className="flex flex-col items-center md:items-end gap-3">
              <div className="flex items-center gap-6 text-xs text-white/30">
                <Link href="/privacy" className="hover:text-white/60 transition-colors">Privacy</Link>
                <Link href="/terms" className="hover:text-white/60 transition-colors">Terms</Link>
                <Link href="/support" className="hover:text-white/60 transition-colors">Support</Link>
                <a href="https://www.facebook.com/pennywiseitoz" target="_blank" rel="noopener noreferrer" className="hover:text-white/60 transition-colors">
                  <i className="fab fa-facebook mr-1" />Penny Wise I.T
                </a>
                <span>&copy; {new Date().getFullYear()} AutoHue. All rights reserved.</span>
              </div>
              <AiDisclaimer variant="compact" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
