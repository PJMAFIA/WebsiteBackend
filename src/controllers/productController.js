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
      console.log("📦 Body:", req.body);
      console.log("📂 File:", req.file ? req.file.originalname : "No File");

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
        // Create a unique file name
        const fileName = `product_${Date.now()}_${file.originalname.replace(/\s/g, '_')}`;
        
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

      if (error) {
        console.error("❌ DB Insert Error:", error);
        throw error;
      }

      res.status(201).json({ status: 'success', data });

    } catch (error) {
      console.error("🔥 Create Product Error:", error.message);
      res.status(400).json({ status: 'error', message: error.message });
    }
  }

  // 3. Delete Product (Admin Only)
  async deleteProduct(req, res) {
    try {
      const { id } = req.params;
      
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      res.status(200).json({ 
        status: 'success', 
        message: 'Product deleted successfully' 
      });
    } catch (error) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
}

module.exports = new ProductController();