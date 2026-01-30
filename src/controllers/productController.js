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
        name, 
        description, 
        price_1_day, 
        price_7_days, 
        price_30_days, 
        price_lifetime, 
        download_link,
        tutorial_video_link,
        activation_process
      } = req.body;

      const file = req.file;

      // Basic Validation
      if (!name || !price_1_day) {
        return res.status(400).json({ 
          status: 'error', 
          message: 'Product Name and at least 1 Day Price are required.' 
        });
      }

      let imageUrl = null;

      // A. Upload Image to Supabase Storage (if provided)
      if (file) {
        // Sanitize filename
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        const fileName = `product_${Date.now()}_${safeName}`;
        
        // Upload to 'uploads' bucket
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('uploads')
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false
          });

        if (uploadError) {
          console.error("❌ Storage Upload Error:", uploadError);
          throw new Error("Failed to upload image to storage");
        }

        // Get Public URL
        const { data: urlData } = supabase.storage
          .from('uploads')
          .getPublicUrl(fileName);
          
        imageUrl = urlData.publicUrl;
      }

      // B. Insert into Database
      const { data, error } = await supabase
        .from('products')
        .insert([{
          name,
          description,
          image_url: imageUrl,
          price_1_day: parseFloat(price_1_day),
          price_7_days: parseFloat(price_7_days || 0),
          price_30_days: parseFloat(price_30_days || 0),
          price_lifetime: parseFloat(price_lifetime || 0),
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

  // 3. Delete Product (Admin Only) - FIXED ID LOGIC
  async deleteProduct(req, res) {
    try {
      const { id } = req.params;
      
      console.log(`🗑️ Request to Delete ID: ${id}`);

      // 🚨 CRITICAL FIX: Clean the ID if it contains a colon (e.g., "uuid:1")
      const cleanId = id.includes(':') ? id.split(':')[0] : id;

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', cleanId);

      if (error) throw error;

      res.status(200).json({ 
        status: 'success', 
        message: 'Product deleted successfully' 
      });
    } catch (error) {
      console.error("🔥 Delete Failed:", error.message);
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
}

module.exports = new ProductController();