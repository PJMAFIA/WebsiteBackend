const axios = require('axios');

const sendDiscordWebhook = async (embeds) => {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    
    // 🔍 DEBUGGING: This will print in your terminal so we know if it found the URL
    console.log("🔔 [DISCORD CHECK] URL Found in .env?:", webhookUrl ? "YES ✅" : "NO ❌");

    if (!webhookUrl) {
        console.log("⚠️ [DISCORD ERROR] Aborting webhook because DISCORD_WEBHOOK_URL is missing from .env");
        return;
    }

    try {
        await axios.post(webhookUrl, {
            username: "Universal Store Alert",
            avatar_url: "https://i.postimg.cc/RC37F5FH/download-removebg-preview.png", 
            embeds: embeds
        });
        console.log("✅ [DISCORD SUCCESS] Message sent to your server!");
    } catch (error) {
        // 🔍 DEBUGGING: If Discord rejects it, this will tell us exactly why
        console.error('❌ [DISCORD POST ERROR]:', error.response?.data || error.message);
    }
};

module.exports = { sendDiscordWebhook };