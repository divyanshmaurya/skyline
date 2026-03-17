import nodemailer from 'nodemailer';

interface EmailPayload {
  subject: string;
  htmlContent: string;
  textContent?: string;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { subject, htmlContent, textContent }: EmailPayload = req.body;

  if (!subject || !htmlContent) {
    res.status(400).json({ error: 'Missing required fields: subject, htmlContent' });
    return;
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailAppPassword) {
    console.warn(
      '[send-email] GMAIL_USER or GMAIL_APP_PASSWORD env vars not set. ' +
      'Email will not be sent. Configure these in your Vercel project settings.'
    );
    res.status(200).json({ success: true, warning: 'Email credentials not configured' });
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });

  try {
    await transporter.sendMail({
      from: `"Skyline Elite Realty Bot" <${gmailUser}>`,
      to: gmailUser,
      subject: subject,
      html: htmlContent,
      text: textContent || htmlContent.replace(/<[^>]*>/g, ''),
    });

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[send-email] Failed to send email:', error);
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
}
