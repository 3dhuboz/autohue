'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import NavBar from '@/components/NavBar';

export default function SupportPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    // Encode for mailto fallback — opens user's email client with prefilled fields
    const subject = encodeURIComponent(`AutoHue Support: ${name}`);
    const body = encodeURIComponent(`From: ${name} (${email})\n\n${message}`);
    window.location.href = `mailto:steve@pennywiseit.com.au?subject=${subject}&body=${body}`;
    setTimeout(() => {
      setSent(true);
      setSending(false);
    }, 500);
  };

  return (
    <div className="min-h-screen">
      <NavBar />

      <div className="container mx-auto px-6 max-w-3xl mt-10 mb-20">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-heading font-black mb-2">Support & Contact</h1>
          <p className="text-white/40 text-sm">
            AutoHue is proudly supported by <strong className="text-white/60">Penny Wise I.T</strong>
          </p>
        </div>

        {/* Support channels */}
        <div className="grid sm:grid-cols-2 gap-5 mb-10 stagger">
          <a
            href="https://www.facebook.com/pennywiseitoz"
            target="_blank"
            rel="noopener noreferrer"
            className="glass-card rounded-2xl p-6 text-center hover:border-blue-500/30 border border-white/5 transition-all group"
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-600/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-600/20 transition-colors">
              <i className="fab fa-facebook text-blue-400 text-2xl" />
            </div>
            <h3 className="font-heading font-bold text-sm mb-1">Facebook</h3>
            <p className="text-xs text-white/30">Message us on Facebook for quick support</p>
            <span className="inline-block mt-3 text-[10px] font-bold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full">
              @pennywiseitoz
            </span>
          </a>

          <div className="glass-card rounded-2xl p-6 text-center border border-white/5">
            <div className="w-14 h-14 rounded-2xl bg-racing-600/10 flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-envelope text-racing-400 text-2xl" />
            </div>
            <h3 className="font-heading font-bold text-sm mb-1">Email</h3>
            <p className="text-xs text-white/30">Send us a detailed support request</p>
            <span className="inline-block mt-3 text-[10px] font-bold text-racing-400 bg-racing-600/10 px-3 py-1 rounded-full">
              Use the form below
            </span>
          </div>
        </div>

        {/* Powered by banner */}
        <div className="glass-card rounded-2xl p-5 mb-10 flex items-center gap-4 border border-white/5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center shrink-0">
            <i className="fas fa-laptop-code text-green-400" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold text-white/60">Powered by Penny Wise I.T</div>
            <div className="text-[10px] text-white/30 mt-0.5">Australian IT support, web development & automation</div>
          </div>
          <a
            href="https://www.facebook.com/pennywiseitoz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-racing-400 hover:text-racing-300 transition-colors shrink-0"
          >
            Visit <i className="fas fa-external-link-alt ml-1 text-[10px]" />
          </a>
        </div>

        {/* Contact form */}
        {sent ? (
          <div className="glass-card rounded-3xl p-10 text-center animate-fade-up">
            <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-check text-green-400 text-2xl" />
            </div>
            <h2 className="text-xl font-heading font-bold mb-2">Message Ready</h2>
            <p className="text-white/40 text-sm mb-6">
              Your email client should have opened with the message. If not, you can reach us directly on{' '}
              <a href="https://www.facebook.com/pennywiseitoz" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                Facebook
              </a>.
            </p>
            <button onClick={() => { setSent(false); setName(''); setEmail(''); setMessage(''); }} className="btn-carbon px-6 py-2.5 rounded-xl text-sm">
              Send Another
            </button>
          </div>
        ) : (
          <div className="glass-card rounded-3xl p-8 red-accent-top">
            <h2 className="font-heading font-bold text-sm flex items-center gap-2 mb-6">
              <i className="fas fa-paper-plane text-racing-500" />
              Send a Message
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1.5">Your Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:border-racing-600/50 focus:outline-none transition-colors"
                    placeholder="John Smith"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1.5">Your Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:border-racing-600/50 focus:outline-none transition-colors"
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1.5">Message</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  required
                  rows={5}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:border-racing-600/50 focus:outline-none transition-colors resize-none"
                  placeholder="Describe your issue or question..."
                />
              </div>
              <button
                type="submit"
                disabled={sending}
                className="btn-racing px-8 py-3 rounded-xl text-sm w-full sm:w-auto disabled:opacity-50"
              >
                {sending ? <><i className="fas fa-spinner fa-spin mr-2" />Sending...</> : <><i className="fas fa-paper-plane mr-2" />Send Message</>}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
