const axios = require('axios');

class CodeExecutionService {
  constructor() {
    this.jdoodleClientId = process.env.JDOODLE_CLIENT_ID;
    this.jdoodleClientSecret = process.env.JDOODLE_CLIENT_SECRET;
    this.pistonApi = 'https://emkc.org/api/v2/piston/execute';
  }

  async executeCode(code, language, input = '') {
    const languageMap = {
      'javascript': { jdoodle: 'nodejs', piston: 'javascript' },
      'python': { jdoodle: 'python3', piston: 'python' },
      'java': { jdoodle: 'java', piston: 'java' },
      'cpp': { jdoodle: 'cpp17', piston: 'cpp' },
      'c': { jdoodle: 'c', piston: 'c' },
      'csharp': { jdoodle: 'csharp', piston: 'csharp' },
      'php': { jdoodle: 'php', piston: 'php' },
      'ruby': { jdoodle: 'ruby', piston: 'ruby' },
      'go': { jdoodle: 'go', piston: 'go' },
      'rust': { jdoodle: 'rust', piston: 'rust' },
      'typescript': { jdoodle: 'typescript', piston: 'typescript' }
    };

    const langConfig = languageMap[language] || languageMap['javascript'];

    // Try JDoodle first (if keys are configured)
    if (this.jdoodleClientId && this.jdoodleClientSecret) {
      try {
        const response = await axios.post('https://api.jdoodle.com/v1/execute', {
          clientId: this.jdoodleClientId,
          clientSecret: this.jdoodleClientSecret,
          script: code,
          stdin: input,
          language: langConfig.jdoodle,
          versionIndex: '0'
        }, { timeout: 15000 });

        return {
          success: true,
          output: response.data.output || 'Code executed successfully',
          error: response.data.error || ''
        };
      } catch (error) {
        console.log('JDoodle failed:', error.message);
      }
    }

    // Fallback to Piston API
    try {
      const response = await axios.post(this.pistonApi, {
        language: langConfig.piston,
        version: '*',
        files: [{ content: code }],
        stdin: input
      }, { timeout: 15000 });

      if (response.data && response.data.run) {
        return {
          success: true,
          output: response.data.run.output || 'Execution completed',
          error: response.data.run.stderr || ''
        };
      }
    } catch (error) {
      console.log('Piston failed:', error.message);
    }

    return {
      success: false,
      output: `Code execution failed.\n\nTo enable multi-language execution:\n1. Go to jdoodle.com/compiler-api\n2. Sign up for free account\n3. Get Client ID and Secret\n4. Add them to your environment variables:\n   - JDOODLE_CLIENT_ID\n   - JDOODLE_CLIENT_SECRET`
    };
  }
}

module.exports = new CodeExecutionService();