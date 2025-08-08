// Simple OpenAI test script
import OpenAI from 'openai';

async function testOpenAI() {
  try {
    // Get API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('❌ OPENAI_API_KEY not found in environment');
      return;
    }
    
    console.log('🔑 API Key found, testing connection...');
    
    const client = new OpenAI({
      apiKey: apiKey
    });
    
    // Test simple completion
    console.log('🧪 Testing chat completion...');
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say hello in Portuguese.' }
      ],
      temperature: 0.7,
      max_tokens: 100
    });
    
    console.log('✅ OpenAI Response:', response.choices[0]?.message?.content);
    console.log('📊 Usage:', response.usage);
    
  } catch (error) {
    console.error('❌ OpenAI Error:', error.message);
    console.error('📋 Error Details:', {
      status: error.status,
      type: error.type,
      code: error.code
    });
  }
}

testOpenAI();