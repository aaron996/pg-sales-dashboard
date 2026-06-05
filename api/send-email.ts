export default async function handler(req: any, res: any) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, displayName } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error('RESEND_API_KEY is not configured in environment variables.');
    return res.status(500).json({ error: 'Mail server configuration error (RESEND_API_KEY missing).' });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'P&G Sales Dashboard <onboarding@resend.dev>',
        to: ['luongthevinh996@gmail.com'],
        subject: 'Yêu cầu duyệt tài khoản báo cáo Interdist',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.6;">
            <h2 style="color: #0d6efd; margin-bottom: 20px;">Yêu Cầu Duyệt Tài Khoản Mới</h2>
            <p>Chào Vinh,</p>
            <p>Hệ thống ghi nhận có một tài khoản mới vừa đăng ký và đang ở trạng thái <strong>Chờ phê duyệt (Pending)</strong>:</p>
            <table style="border-collapse: collapse; width: 100%; max-width: 500px; margin: 20px 0;">
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f9f9f9; width: 150px;">Email:</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${email}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f9f9f9;">Tên hiển thị:</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${displayName || 'Chưa cung cấp'}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f9f9f9;">Thời gian đăng ký:</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</td>
              </tr>
            </table>
            <p>Vui lòng đăng nhập vào tài khoản Developer của bạn trên hệ thống Dashboard và duyệt quyền (chuyển sang 'Nhân viên' hoặc 'Quản trị viên') tại mục <strong>Quản lý User</strong>.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin-top: 30px;" />
            <p style="font-size: 0.85em; color: #777;">Email này được gửi tự động từ P&G Sales Operations Dashboard.</p>
          </div>
        `,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to send email via Resend API');
    }

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error('Error sending email:', error);
    return res.status(500).json({ error: error.message || String(error) });
  }
}
