export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Missing Supabase environment variables' });
    }

    // Ping the Supabase REST API to keep the project active
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Supabase returned status ${response.status}`);
    }

    return res.status(200).json({ 
      status: 'success', 
      message: 'Supabase pinged successfully',
      code: response.status 
    });

  } catch (error) {
    console.error('Keep-alive ping failed:', error);
    return res.status(500).json({ 
      status: 'error', 
      message: 'Failed to ping Supabase',
      error: error.message 
    });
  }
}
