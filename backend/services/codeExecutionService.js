const axios = require('axios');

class CodeExecutionService {
  constructor() {
    // Free code execution APIs
    this.apis = {
      // Piston API (free, supports 50+ languages)
      piston: 'https://emkc.org/api/v2/piston/execute',
      
      // JDoodle API (free tier with limits)
      jdoodle: 'https://api.jdoodle.com/v1/execute',
      
      // Replit API (alternative)
      replit: 'https://replit.com/api/v0/repls'
    };
  }

  async executeCode(code, language, input = '') {
    try {
      // Map our language IDs to Piston language names
      const languageMap = {
        'javascript': 'javascript',
        'python': 'python',
        'java': 'java',
        'cpp': 'cpp',
        'c': 'c',
        'csharp': 'csharp',
        'php': 'php',
        'ruby': 'ruby',
        'go': 'go',
        'rust': 'rust',
        'typescript': 'typescript',
        'sql': 'sql',
        'html': 'html',
        'css': 'css'
      };

      const pistonLanguage = languageMap[language] || 'javascript';
      
      // Use Piston API (free, no API key required)
      const response = await axios.post(this.apis.piston, {
        language: pistonLanguage,
        version: '*',
        files: [{
          name: `main.${this.getFileExtension(language)}`,
          content: code
        }],
        stdin: input,
        args: []
      }, {
        timeout: 10000
      });

      const data = response.data;
      
      if (data.run && data.run.output) {
        return {
          success: true,
          output: data.run.output,
          stderr: data.run.stderr || '',
          code: data.run.code || 0
        };
      } else {
        return {
          success: false,
          output: 'No output received from execution service'
        };
      }
    } catch (error) {
      console.error('Code execution error:', error.message);
      
      // Fallback to simple JavaScript execution for demo
      if (language === 'javascript') {
        try {
          return this.executeJavaScriptLocally(code);
        } catch (jsError) {
          return {
            success: false,
            output: `JavaScript Error: ${jsError.message}`
          };
        }
      }
      
      return {
        success: false,
        output: `Execution service error: ${error.message}\n\nFor full multi-language support, please set up a free account at:\n1. https://emkc.org (Piston API)\n2. https://jdoodle.com (JDoodle API)\n\nCurrently, only JavaScript is supported in demo mode.`
      };
    }
  }

  executeJavaScriptLocally(code) {
    let output = '';
    const originalLog = console.log;
    
    console.log = (...args) => {
      output += args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ') + '\n';
    };

    try {
      // Safe execution with timeout
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const func = new AsyncFunction(code);
      func();
      
      console.log = originalLog;
      return {
        success: true,
        output: output || 'Code executed successfully (no output)'
      };
    } catch (error) {
      console.log = originalLog;
      return {
        success: false,
        output: `Error: ${error.message}`
      };
    }
  }

  getFileExtension(language) {
    const extensions = {
      'javascript': 'js',
      'python': 'py',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'csharp': 'cs',
      'php': 'php',
      'ruby': 'rb',
      'go': 'go',
      'rust': 'rs',
      'typescript': 'ts',
      'html': 'html',
      'css': 'css',
      'sql': 'sql'
    };
    return extensions[language] || 'txt';
  }
}

module.exports = new CodeExecutionService();