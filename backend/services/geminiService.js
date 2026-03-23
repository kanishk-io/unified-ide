const axios = require('axios');

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
  }

  async generateCode(prompt, language, context = '') {
    try {
      if (!this.apiKey) {
        return { success: false, error: 'Gemini API key not configured', code: '// Add GEMINI_API_KEY to .env' };
      }

      const fullPrompt = `You are a professional programmer. Generate ONLY the code, no explanations, no markdown, no backticks.
Language: ${language}
Context: ${context || 'None'}
Request: ${prompt}
Return only raw code. Make it complete and runnable.`;

      const response = await axios.post(
        `${this.apiUrl}?key=${this.apiKey}`,
        {
          contents: [{ parts: [{ text: fullPrompt }] }]
        },
        { timeout: 30000 }
      );

      if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        let generatedCode = response.data.candidates[0].content.parts[0].text;
        generatedCode = generatedCode.replace(/```\w*\n/g, '').replace(/```/g, '').trim();
        return { success: true, code: generatedCode };
      }
      
      throw new Error('Invalid response from Gemini API');
    } catch (error) {
      console.error('Gemini API error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        code: `// AI Error: ${error.message}`
      };
    }
  }

  async analyzeCode(code, language) {
    try {
      if (!this.apiKey) {
        return { success: false, analysis: 'Gemini API key not configured' };
      }

      const prompt = `Analyze this ${language} code. Return structured analysis:
Code:
${code.substring(0, 2000)}

Provide:
- Bugs: List any bugs found
- Code Quality: Score 1-10 with explanation
- Security: List any security concerns
- Performance: Suggestions for improvement
- Recommendations: Specific actionable improvements`;

      const response = await axios.post(
        `${this.apiUrl}?key=${this.apiKey}`,
        {
          contents: [{ parts: [{ text: prompt }] }]
        },
        { timeout: 30000 }
      );

      let analysis = response.data.candidates[0].content.parts[0].text;
      analysis = analysis.trim();
      return { success: true, analysis };
    } catch (error) {
      console.error('Analysis error:', error.message);
      return { success: false, analysis: `Analysis failed: ${error.message}` };
    }
  }
}

module.exports = new GeminiService();