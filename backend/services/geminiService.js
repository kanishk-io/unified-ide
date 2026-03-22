const axios = require('axios');

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
  }

  async generateCode(prompt, language, context = '') {
    try {
      const fullPrompt = `You are a professional programmer. Generate ONLY the code, no explanations.
Language: ${language}
Context/Existing Code: ${context || 'None'}
User Request: ${prompt}

Rules:
1. Return ONLY the code, no markdown, no backticks, no explanations
2. Make it complete and runnable
3. Include proper error handling
4. For user input, use standard input methods (scanf for C, input() for Python, readline for Node.js)
5. Add comments for clarity

Code:`;

      const response = await axios.post(
        `${this.apiUrl}?key=${this.apiKey}`,
        {
          contents: [{
            parts: [{ text: fullPrompt }]
          }]
        },
        { timeout: 30000 }
      );

      let generatedCode = response.data.candidates[0].content.parts[0].text;
      generatedCode = generatedCode.replace(/```\w*\n/g, '').replace(/```/g, '').trim();
      
      return { success: true, code: generatedCode };
    } catch (error) {
      console.error('Gemini API error:', error.message);
      return { 
        success: false, 
        error: 'AI service unavailable. Please check your API key.',
        code: `// AI Error: ${error.message}\n\n// Please check your GEMINI_API_KEY in environment variables`
      };
    }
  }

  async analyzeCode(code, language) {
    try {
      const prompt = `Analyze this ${language} code and provide a detailed review.
Code:
${code}

Provide analysis in this exact format:
- Bugs and issues found (if any)
- Code quality (1-10)
- Security concerns (if any)
- Performance suggestions
- Best practices violations
- Specific improvements with code examples

Be specific and critical. If the code is good, say so. If there are issues, point them out clearly.`;

      const response = await axios.post(
        `${this.apiUrl}?key=${this.apiKey}`,
        {
          contents: [{
            parts: [{ text: prompt }]
          }]
        },
        { timeout: 30000 }
      );

      let analysis = response.data.candidates[0].content.parts[0].text;
      analysis = analysis.trim();
      
      return { success: true, analysis };
    } catch (error) {
      console.error('Analysis error:', error.message);
      return { 
        success: false, 
        analysis: `Analysis failed: ${error.message}\n\nPlease check your API key.` 
      };
    }
  }
}

module.exports = new GeminiService();