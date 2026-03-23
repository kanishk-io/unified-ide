const axios = require('axios');

class CodeExecutionService {
  constructor() {
    this.jdoodleClientId = process.env.JDOODLE_CLIENT_ID;
    this.jdoodleClientSecret = process.env.JDOODLE_CLIENT_SECRET;
    this.pistonApi = 'https://emkc.org/api/v2/piston/execute';
  }

  async executeCode(code, language, input = '') {
    // Language mappings for JDoodle and Piston
    const languageMap = {
      'javascript': { jdoodle: 'nodejs', jdoodleVersion: '4', piston: 'javascript', pistonVersion: '*' },
      'python':     { jdoodle: 'python3', jdoodleVersion: '4', piston: 'python', pistonVersion: '*' },
      'java':       { jdoodle: 'java', jdoodleVersion: '4', piston: 'java', pistonVersion: '*' },
      'cpp':        { jdoodle: 'cpp17', jdoodleVersion: '1', piston: 'c++', pistonVersion: '*' },
      'c':          { jdoodle: 'c', jdoodleVersion: '5', piston: 'c', pistonVersion: '*' },
      'csharp':     { jdoodle: 'csharp', jdoodleVersion: '4', piston: 'csharp', pistonVersion: '*' },
      'php':        { jdoodle: 'php', jdoodleVersion: '4', piston: 'php', pistonVersion: '*' },
      'ruby':       { jdoodle: 'ruby', jdoodleVersion: '4', piston: 'ruby', pistonVersion: '*' },
      'go':         { jdoodle: 'go', jdoodleVersion: '4', piston: 'go', pistonVersion: '*' },
      'rust':       { jdoodle: 'rust', jdoodleVersion: '4', piston: 'rust', pistonVersion: '*' },
      'typescript': { jdoodle: 'typescript', jdoodleVersion: '4', piston: 'typescript', pistonVersion: '*' }
    };

    const langConfig = languageMap[language] || languageMap['javascript'];

    // ── Try JDoodle first (if credentials configured) ──
    if (this.jdoodleClientId && this.jdoodleClientSecret) {
      try {
        console.log(`🔧 Trying JDoodle: ${langConfig.jdoodle} v${langConfig.jdoodleVersion}`);
        const response = await axios.post('https://api.jdoodle.com/v1/execute', {
          clientId: this.jdoodleClientId,
          clientSecret: this.jdoodleClientSecret,
          script: code,
          stdin: input,
          language: langConfig.jdoodle,
          versionIndex: langConfig.jdoodleVersion
        }, { timeout: 15000 });

        console.log('JDoodle raw response:', JSON.stringify(response.data));

        // JDoodle returns statusCode 200 on success
        if (response.data && !response.data.error) {
          const output = response.data.output || '';
          if (output.includes('Error: credits') || output.includes('quota')) {
            console.log('⚠️ JDoodle quota exceeded, falling back to Piston');
          } else {
            return {
              success: true,
              output: output.trim() || '✓ Executed successfully (no output)',
              error: ''
            };
          }
        } else {
          console.log('⚠️ JDoodle error:', response.data?.error || 'Unknown');
        }
      } catch (error) {
        console.log('⚠️ JDoodle failed:', error.response?.status, error.message);
      }
    } else {
      console.log('ℹ️  No JDoodle credentials – using Piston');
    }

    // ── Fallback: Piston API (free, no key needed) ──
    try {
      console.log(`🔧 Trying Piston: ${langConfig.piston}`);
      const response = await axios.post(this.pistonApi, {
        language: langConfig.piston,
        version: langConfig.pistonVersion,
        files: [{ name: `main.${language}`, content: code }],
        stdin: input
      }, { timeout: 20000 });

      console.log('Piston raw response:', JSON.stringify(response.data).substring(0, 200));

      if (response.data && response.data.run) {
        const run = response.data.run;
        const combined = (run.output || '') + (run.stderr ? `\n⚠️ Stderr:\n${run.stderr}` : '');
        return {
          success: run.code === 0,
          output: combined.trim() || '✓ Executed successfully (no output)',
          error: run.stderr || ''
        };
      }
      throw new Error('Unexpected Piston response format');
    } catch (error) {
      console.log('⚠️ Piston failed:', error.response?.status, error.message);
    }

    // ── Both failed ──
    return {
      success: false,
      output: [
        '❌ Code execution failed. Both JDoodle and Piston are unavailable right now.',
        '',
        'Possible reasons:',
        '• Network timeout (Render free tier sleeps after inactivity)',
        '• JDoodle daily credit limit reached',
        '• Piston API temporarily down',
        '',
        'To fix JDoodle:',
        '1. Go to https://www.jdoodle.com/compiler-api',
        '2. Sign up for a free account',
        '3. Copy your Client ID and Secret',
        '4. Update JDOODLE_CLIENT_ID and JDOODLE_CLIENT_SECRET in Render environment variables',
      ].join('\n')
    };
  }
}

module.exports = new CodeExecutionService();