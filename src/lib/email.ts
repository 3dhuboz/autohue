import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');

const FROM_EMAIL = process.env.EMAIL_FROM || 'AutoHue <noreply@autohue.com>';

export interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

// ── Welcome email ──
export async function sendWelcomeEmail(to: string, name: string): Promise<EmailResult> {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Welcome to AutoHue! 🏎️',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #111; font-size: 28px; margin: 0;">Welcome to <span style="color: #dc2626;">AutoHue</span></h1>
          </div>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">Hey ${name || 'there'},</p>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">Thanks for signing up! You're all set to start sorting your car photos by color with AI.</p>
          <div style="background: #f8f8f8; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="color: #555; font-size: 14px; margin: 0 0 8px 0;"><strong>Your free account includes:</strong></p>
            <ul style="color: #555; font-size: 14px; padding-left: 20px; margin: 0;">
              <li>10 images/month</li>
              <li>AI car detection & color sorting</li>
              <li>ZIP download</li>
            </ul>
          </div>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${process.env.NEXTAUTH_URL}/sort" style="background: #dc2626; color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">Start Sorting Now</a>
          </div>
          <p style="color: #999; font-size: 12px; text-align: center; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
            AutoHue by Penny Wise I.T &middot; AI-powered car photo sorting
          </p>
        </div>
      `,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, id: data?.id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ── Subscription confirmation email ──
export async function sendSubscriptionEmail(
  to: string,
  name: string,
  plan: string,
  price: number,
  nextBillingDate: Date
): Promise<EmailResult> {
  try {
    const formattedDate = nextBillingDate.toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' });
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `AutoHue ${plan} Plan Activated! ✅`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #111; font-size: 28px; margin: 0;">Subscription <span style="color: #dc2626;">Confirmed</span></h1>
          </div>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">Hey ${name || 'there'},</p>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">Your <strong>${plan}</strong> plan is now active. Here's your billing summary:</p>
          <div style="background: #f8f8f8; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <table style="width: 100%; font-size: 14px; color: #555;">
              <tr><td style="padding: 6px 0;"><strong>Plan</strong></td><td style="text-align: right;">${plan}</td></tr>
              <tr><td style="padding: 6px 0;"><strong>Amount</strong></td><td style="text-align: right;">$${price}/month</td></tr>
              <tr><td style="padding: 6px 0;"><strong>Next billing date</strong></td><td style="text-align: right;">${formattedDate}</td></tr>
              <tr><td style="padding: 6px 0;"><strong>Payment method</strong></td><td style="text-align: right;">Card on file</td></tr>
            </table>
          </div>
          <p style="color: #555; font-size: 14px; line-height: 1.6;">You'll be charged <strong>$${price}</strong> automatically each month. You can manage or cancel your subscription anytime from your <a href="${process.env.NEXTAUTH_URL}/account" style="color: #dc2626;">account settings</a>.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${process.env.NEXTAUTH_URL}/sort" style="background: #dc2626; color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">Start Sorting</a>
          </div>
          <p style="color: #999; font-size: 12px; text-align: center; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
            AutoHue by Penny Wise I.T &middot; AI-powered car photo sorting
          </p>
        </div>
      `,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, id: data?.id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ── Sort complete notification ──
export async function sendSortCompleteEmail(
  to: string,
  name: string,
  imageCount: number,
  colorCount: number,
  sessionId: string
): Promise<EmailResult> {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Your ${imageCount} photos are sorted! 📸`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #111; font-size: 28px; margin: 0;">Sorting <span style="color: #dc2626;">Complete!</span></h1>
          </div>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">Hey ${name || 'there'},</p>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">Your batch of <strong>${imageCount} car photos</strong> has been sorted into <strong>${colorCount} color folders</strong>.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${process.env.NEXTAUTH_URL}/sort/session/${sessionId}" style="background: #dc2626; color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">View Results & Download</a>
          </div>
          <p style="color: #999; font-size: 13px; line-height: 1.5;">⏰ Remember to download your files before they expire based on your plan's retention period.</p>
          <p style="color: #999; font-size: 12px; text-align: center; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
            AutoHue by Penny Wise I.T &middot; AI-powered car photo sorting
          </p>
        </div>
      `,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, id: data?.id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ── Payment failed notification ──
export async function sendPaymentFailedEmail(to: string, name: string, plan: string): Promise<EmailResult> {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'AutoHue — Payment Failed ⚠️',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #111; font-size: 28px; margin: 0;">Payment <span style="color: #dc2626;">Issue</span></h1>
          </div>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">Hey ${name || 'there'},</p>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">We were unable to process your payment for the <strong>${plan}</strong> plan. Please update your payment method to avoid service interruption.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${process.env.NEXTAUTH_URL}/account" style="background: #dc2626; color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">Update Payment Method</a>
          </div>
          <p style="color: #999; font-size: 13px; line-height: 1.5;">If your payment continues to fail, your plan will be downgraded to Free after the current billing period ends.</p>
          <p style="color: #999; font-size: 12px; text-align: center; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
            AutoHue by Penny Wise I.T &middot; AI-powered car photo sorting
          </p>
        </div>
      `,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, id: data?.id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ── Generic test email (for dev tools) ──
export async function sendTestEmail(to: string): Promise<EmailResult> {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'AutoHue — Test Email ✅',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; text-align: center;">
          <h1 style="color: #111; font-size: 28px;">Email is <span style="color: #22c55e;">Working!</span></h1>
          <p style="color: #555; font-size: 16px;">If you received this, your Resend API key is configured correctly.</p>
          <p style="color: #999; font-size: 12px; margin-top: 40px;">Sent from AutoHue dev tools at ${new Date().toISOString()}</p>
        </div>
      `,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, id: data?.id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
