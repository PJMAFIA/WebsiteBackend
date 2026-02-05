const supabase = require('../config/supabase');

class ProductController {

  // 1. Get All Products (Public)
  async getAllProducts(req, res) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.status(200).json({ status: 'success', results: data.length, data });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  // 2. Create Product (Admin Only)
  async createProduct(req, res) {
    try {
      console.log("📥 Creating Product...");
      
      const { 
        name, description, price_1_day, price_7_days, price_30_days, 
        price_lifetime, download_link, tutorial_video_link, activation_process,
        currency_prices // ✅ Received as String from FormData
      } = req.body;

      const files = req.files || []; 

      if (!name || !price_1_day) {
        return res.status(400).json({ status: 'error', message: 'Product Name and Price are required.' });
      }

      let imageUrls = [];

      // Upload Images
      if (files && files.length > 0) {
        for (const file of files) {
          const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
          const fileName = `product_${Date.now()}_${Math.floor(Math.random()*1000)}_${safeName}`;
          
          const { error: uploadError } = await supabase.storage
            .from('uploads')
            .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: false });

          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
            imageUrls.push(urlData.publicUrl);
          }
        }
      }

      // ✅ FIX: Parse currency_prices from JSON string
      let parsedCurrencyPrices = {};
      try {
        if (currency_prices) {
          parsedCurrencyPrices = JSON.parse(currency_prices);
        }
      } catch (e) {
        console.error("Error parsing currency_prices:", e);
        parsedCurrencyPrices = {};
      }

      // Insert DB
      const { data, error } = await supabase
        .from('products')
        .insert([{
          name, 
          description,
          image_url: imageUrls.length > 0 ? imageUrls[0] : null,
          images: imageUrls,
          
          // Base Prices (USD)
          price_1_day: parseFloat(price_1_day),
          price_7_days: parseFloat(price_7_days || 0),
          price_30_days: parseFloat(price_30_days || 0),
          price_lifetime: parseFloat(price_lifetime || 0),
          
          // ✅ Save parsed currency prices
          currency_prices: parsedCurrencyPrices,

          download_link, 
          tutorial_video_link, 
          activation_process
        }])
        .select()
        .single();

      if (error) throw error;
      res.status(201).json({ status: 'success', data });

    } catch (error) {
      console.error("🔥 Create Product Error:", error.message);
      res.status(400).json({ status: 'error', message: error.message });
    }
  }

  // 3. Update Product (Admin Only)
  async updateProduct(req, res) {
    try {
      const { id } = req.params;
      console.log(`📝 Updating Product ID: ${id}`);

      const { 
        name, description, price_1_day, price_7_days, price_30_days, 
        price_lifetime, download_link, tutorial_video_link, activation_process,
        existing_images, 
        currency_prices // ✅ Received as String
      } = req.body;

      const files = req.files || [];

      // A. Parse Existing Images
      let finalImages = [];
      try {
        finalImages = existing_images ? JSON.parse(existing_images) : [];
      } catch (e) {
        console.error("Failed to parse existing_images:", e);
        finalImages = [];
      }

      // B. Upload NEW images
      if (files && files.length > 0) {
        for (const file of files) {
          const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
          const fileName = `product_${Date.now()}_${Math.floor(Math.random()*1000)}_${safeName}`;
          
          const { error: uploadError } = await supabase.storage
            .from('uploads')
            .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: false });

          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
            finalImages.push(urlData.publicUrl);
          }
        }
      }

      // ✅ FIX: Parse currency_prices from JSON string
      let parsedCurrencyPrices = {};
      try {
        if (currency_prices) {
          parsedCurrencyPrices = JSON.parse(currency_prices);
        }
      } catch (e) {
        console.error("Error parsing currency_prices update:", e);
        parsedCurrencyPrices = {};
      }

      // C. Update Database
      const { data, error } = await supabase
        .from('products')
        .update({
          name, 
          description,
          image_url: finalImages.length > 0 ? finalImages[0] : null,
          images: finalImages, 
          
          // Base Prices
          price_1_day: parseFloat(price_1_day || 0),
          price_7_days: parseFloat(price_7_days || 0),
          price_30_days: parseFloat(price_30_days || 0),
          price_lifetime: parseFloat(price_lifetime || 0),
          
          // ✅ Update currency prices
          currency_prices: parsedCurrencyPrices,

          download_link, 
          tutorial_video_link, 
          activation_process
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      res.status(200).json({ status: 'success', data });

    } catch (error) {
      console.error("🔥 Update Product Error:", error.message);
      res.status(400).json({ status: 'error', message: error.message });
    }
  }

  // 4. Delete Product
  async deleteProduct(req, res) {
    try {
      const { id } = req.params;
      const cleanId = id.includes(':') ? id.split(':')[0] : id;

      const { error } = await supabase.from('products').delete().eq('id', cleanId);
      if (error) throw error;

      res.status(200).json({ status: 'success', message: 'Product deleted successfully' });
    } catch (error) {
      console.error("🔥 Delete Failed:", error.message);
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
}

module.exports = new ProductController();