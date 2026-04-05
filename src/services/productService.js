const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

class ProductService {
  
  // 1. Upload Image & Create Product
  async createProduct(data, file) {
    let imageUrl = null;

    if (file) {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
      const fileName = `cover-${uuidv4()}-${safeName}`;
      
      const { error: uploadError } = await supabase
        .storage
        .from('uploads') // Changed bucket name to 'uploads' to match Controller
        .upload(fileName, file.buffer, { contentType: file.mimetype });

      if (uploadError) throw new Error(`Image Upload Failed: ${uploadError.message}`);

      const { data: publicUrlData } = supabase
        .storage
        .from('uploads')
        .getPublicUrl(fileName);
        
      imageUrl = publicUrlData.publicUrl;
    }

    const { data: product, error } = await supabase
      .from('products')
      .insert([
        {
          name: data.name,
          description: data.description,
          image_url: imageUrl,
          price_1_day: parseFloat(data.price_1_day),
          price_7_days: parseFloat(data.price_7_days || 0),
          price_30_days: parseFloat(data.price_30_days || 0),
          price_lifetime: parseFloat(data.price_lifetime || 0),
          download_link: data.download_link,
          tutorial_video_link: data.tutorial_video_link,
          activation_process: data.activation_process
        }
      ])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return product;
  }

  // 2. Get All Products
  async getAllProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  }

  // 3. Delete Product
  async deleteProduct(productId) {
    // Clean ID here too just in case
    const cleanId = productId.includes(':') ? productId.split(':')[0] : productId;

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', cleanId);

    if (error) throw new Error(error.message);
    
    return true;
  }
}

module.exports = new ProductService();