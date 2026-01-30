const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

class ProductService {
  
  // 1. Upload Image & Create Product
  async createProduct(data, file) {
    let imageUrl = null;

    if (file) {
      const fileName = `cover-${uuidv4()}-${file.originalname}`;
      
      const { error: uploadError } = await supabase
        .storage
        .from('products')
        .upload(fileName, file.buffer, { contentType: file.mimetype });

      if (uploadError) throw new Error(`Image Upload Failed: ${uploadError.message}`);

      const { data: publicUrlData } = supabase
        .storage
        .from('products')
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
          software_name: data.software_name,
          download_link: data.download_link,
          tutorial_video_link: data.tutorial_video_link,
          activation_process: data.activation_process,
          price_1_day: parseFloat(data.price_1_day),
          price_7_days: parseFloat(data.price_7_days),
          price_30_days: parseFloat(data.price_30_days),
          price_lifetime: parseFloat(data.price_lifetime),
          created_by: data.user_id
        }
      ])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return product;
  }

  // 2. Get All Products
  async getAllProducts() {
    // Note: We don't filter by is_active anymore to allow Admins to see everything if needed, 
    // OR we filter by is_active=true if we are soft deleting. 
    // Since we are HARD DELETING below, simple select is fine.
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  }

  // 3. Delete Product (NEW)
  async deleteProduct(productId) {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (error) {
      // Handle foreign key constraint if ON DELETE SET NULL is not set
      if (error.code === '23503') {
        throw new Error('Cannot delete this product because it has associated orders/licenses.');
      }
      throw new Error(error.message);
    }
    
    return true;
  }
}

module.exports = new ProductService();