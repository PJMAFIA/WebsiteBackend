const sendEmail = async (to, subject, htmlContent) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.ADMIN_EMAIL || 'pjmafiaff123@gmail.com'; 
  const senderName = 'Universal Store';

  if (!apiKey) {
    console.error("❌ Email Error: BREVO_API_KEY is missing.");
    return false;
  }

  const url = 'https://api.brevo.com/v3/smtp/email';

  const options = {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject: subject,
      htmlContent: htmlContent
    })
  };

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Brevo API Error:", JSON.stringify(data));
      return false;
    }

    console.log(`📧 Email sent via Brevo! Message ID: ${data.messageId}`);
    return true;

  } catch (error) {
    console.error("❌ Network/Fetch Error:", error);
    return false;
  }
};

module.exports = { sendEmail };