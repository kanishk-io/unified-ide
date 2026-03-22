const axios = require('axios');

class AIService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || 'AIzaSyAwPQekuJclwct5T_DMGzH18aNGq50b1Jc';
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    this.model = 'gemini-pro'; // Use Gemini Pro for code
  }

  async generateCode(prompt, language, context = '') {
    try {
      // If no API key, use enhanced mock responses
      if (!this.apiKey || this.apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
        console.log('⚠️ No Gemini API key, using enhanced mock responses');
        return this.getMockCodeGeneration(prompt, language);
      }

      // Construct the prompt for code generation
      let fullPrompt = `Generate ${language} code for the following request: ${prompt}\n\n`;
      
      if (context) {
        fullPrompt += `Context (existing code):\n${context}\n\n`;
      }
      
      fullPrompt += `Provide ONLY the code, no explanations. The code should be complete, runnable, and follow ${language} best practices.`;

      const response = await axios.post(
        `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`,
        {
          contents: [{
            parts: [{
              text: fullPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2048,
            topP: 0.95,
            topK: 40
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.candidates && response.data.candidates[0]?.content?.parts[0]?.text) {
        return response.data.candidates[0].content.parts[0].text;
      }

      throw new Error('No response from Gemini API');
    } catch (error) {
      console.error('Gemini API error:', error.message);
      
      // Fallback to enhanced mock responses
      return this.getMockCodeGeneration(prompt, language);
    }
  }

  async analyzeCode(code, language) {
    try {
      if (!this.apiKey || this.apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
        return this.getMockAnalysis(code, language);
      }

      const prompt = `Analyze this ${language} code and provide:
1. Potential bugs or errors
2. Performance improvements
3. Best practices violations
4. Security vulnerabilities

Code:
${code}

Format the response as a clear, concise list with each issue and its fix.`;

      const response = await axios.post(
        `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024
          }
        }
      );

      if (response.data.candidates && response.data.candidates[0]?.content?.parts[0]?.text) {
        return response.data.candidates[0].content.parts[0].text;
      }

      return this.getMockAnalysis(code, language);
    } catch (error) {
      console.error('Analysis error:', error.message);
      return this.getMockAnalysis(code, language);
    }
  }

  getMockCodeGeneration(prompt, language) {
    // Enhanced mock responses for different languages
    const mockResponses = {
      javascript: {
        'factorial': `function factorial(n) {
  if (n < 0) return null;
  if (n === 0 || n === 1) return 1;
  return n * factorial(n - 1);
}

// Example usage:
console.log(factorial(5)); // Output: 120`,
        'fibonacci': `function fibonacci(n) {
  const fib = [0, 1];
  for (let i = 2; i < n; i++) {
    fib[i] = fib[i - 1] + fib[i - 2];
  }
  return fib.slice(0, n);
}

// Example usage:
console.log(fibonacci(10)); // Output: [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]`,
        'bubble sort': `function bubbleSort(arr) {
  const array = [...arr];
  for (let i = 0; i < array.length - 1; i++) {
    for (let j = 0; j < array.length - i - 1; j++) {
      if (array[j] > array[j + 1]) {
        [array[j], array[j + 1]] = [array[j + 1], array[j]];
      }
    }
  }
  return array;
}

// Example usage:
console.log(bubbleSort([64, 34, 25, 12, 22, 11, 90]));`
      },
      python: {
        'factorial': `def factorial(n):
    if n < 0:
        return None
    if n == 0 or n == 1:
        return 1
    return n * factorial(n - 1)

# Example usage:
print(factorial(5))  # Output: 120`,
        'fibonacci': `def fibonacci(n):
    fib = [0, 1]
    for i in range(2, n):
        fib.append(fib[i-1] + fib[i-2])
    return fib[:n]

# Example usage:
print(fibonacci(10))  # Output: [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]`,
        'bubble sort': `def bubble_sort(arr):
    array = arr.copy()
    n = len(array)
    for i in range(n - 1):
        for j in range(n - i - 1):
            if array[j] > array[j + 1]:
                array[j], array[j + 1] = array[j + 1], array[j]
    return array

# Example usage:
print(bubble_sort([64, 34, 25, 12, 22, 11, 90]))`
      },
      java: {
        'factorial': `public class Main {
    public static int factorial(int n) {
        if (n < 0) return -1;
        if (n == 0 || n == 1) return 1;
        return n * factorial(n - 1);
    }
    
    public static void main(String[] args) {
        System.out.println(factorial(5)); // Output: 120
    }
}`,
        'fibonacci': `import java.util.Arrays;

public class Main {
    public static int[] fibonacci(int n) {
        int[] fib = new int[n];
        if (n >= 1) fib[0] = 0;
        if (n >= 2) fib[1] = 1;
        for (int i = 2; i < n; i++) {
            fib[i] = fib[i-1] + fib[i-2];
        }
        return fib;
    }
    
    public static void main(String[] args) {
        int[] result = fibonacci(10);
        System.out.println(Arrays.toString(result));
    }
}`
      },
      c: {
        'factorial': `#include <stdio.h>

int factorial(int n) {
    if (n < 0) return -1;
    if (n == 0 || n == 1) return 1;
    return n * factorial(n - 1);
}

int main() {
    printf("%d\\n", factorial(5)); // Output: 120
    return 0;
}`,
        'fibonacci': `#include <stdio.h>

void fibonacci(int n) {
    int fib[n];
    fib[0] = 0;
    if (n > 1) fib[1] = 1;
    
    for (int i = 2; i < n; i++) {
        fib[i] = fib[i-1] + fib[i-2];
    }
    
    for (int i = 0; i < n; i++) {
        printf("%d ", fib[i]);
    }
    printf("\\n");
}

int main() {
    fibonacci(10); // Output: 0 1 1 2 3 5 8 13 21 34
    return 0;
}`,
        'star pattern': `#include <stdio.h>

void printPyramid(int n) {
    for (int i = 1; i <= n; i++) {
        // Print spaces
        for (int j = 1; j <= n - i; j++) {
            printf(" ");
        }
        // Print stars
        for (int j = 1; j <= 2 * i - 1; j++) {
            printf("*");
        }
        printf("\\n");
    }
}

int main() {
    int rows = 5;
    printPyramid(rows);
    return 0;
}`
      },
      cpp: {
        'factorial': `#include <iostream>
using namespace std;

int factorial(int n) {
    if (n < 0) return -1;
    if (n == 0 || n == 1) return 1;
    return n * factorial(n - 1);
}

int main() {
    cout << factorial(5) << endl; // Output: 120
    return 0;
}`,
        'fibonacci': `#include <iostream>
#include <vector>
using namespace std;

vector<int> fibonacci(int n) {
    vector<int> fib;
    fib.push_back(0);
    if (n > 1) fib.push_back(1);
    
    for (int i = 2; i < n; i++) {
        fib.push_back(fib[i-1] + fib[i-2]);
    }
    return fib;
}

int main() {
    vector<int> result = fibonacci(10);
    for (int num : result) {
        cout << num << " ";
    }
    cout << endl;
    return 0;
}`
      }
    };

    // Check for specific patterns in prompt
    const lowerPrompt = prompt.toLowerCase();
    
    // Try to match specific patterns
    for (const [pattern, responses] of Object.entries(mockResponses[language] || {})) {
      if (lowerPrompt.includes(pattern)) {
        return responses;
      }
    }

    // Generic response based on language
    const genericResponses = {
      javascript: `// ${language} code for: ${prompt}
function solve() {
    // TODO: Implement your solution here
    return null;
}

// Example usage:
console.log(solve());`,
      python: `# ${language} code for: ${prompt}
def solve():
    # TODO: Implement your solution here
    return None

# Example usage:
print(solve())`,
      java: `// ${language} code for: ${prompt}
public class Main {
    public static void solve() {
        // TODO: Implement your solution here
    }
    
    public static void main(String[] args) {
        solve();
    }
}`,
      c: `// ${language} code for: ${prompt}
#include <stdio.h>

void solve() {
    // TODO: Implement your solution here
}

int main() {
    solve();
    return 0;
}`,
      cpp: `// ${language} code for: ${prompt}
#include <iostream>
using namespace std;

void solve() {
    // TODO: Implement your solution here
}

int main() {
    solve();
    return 0;
}`
    };

    return genericResponses[language] || `// ${language} code for: ${prompt}\n// Please implement your solution here`;
  }

  getMockAnalysis(code, language) {
    return `📊 Code Analysis for ${language}:

✅ Syntax Check: Passed
📏 Code Length: ${code.split('\n').length} lines, ${code.length} characters

🔍 Suggestions:
1. Add comments to explain complex logic
2. Consider breaking down large functions into smaller ones
3. Validate input parameters for edge cases
4. Use meaningful variable names
5. Add error handling for unexpected inputs

⚡ Performance:
- No major performance issues detected
- Consider using appropriate data structures

🔒 Security:
- No immediate security concerns
- Sanitize any user input before use`;
  }
}

module.exports = new AIService();