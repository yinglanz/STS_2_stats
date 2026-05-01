import * as fs from 'fs';

const htmlContent = fs.readFileSync('output/dashboard.html', 'utf-8');

// Extract JavaScript from script tags
const scriptMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  console.error('No script tag found');
  process.exit(1);
}

const jsCode = scriptMatch[1];

// Check for common syntax errors
const issues: string[] = [];

// Check for unmatched braces
let braceCount = 0;
for (let i = 0; i < jsCode.length; i++) {
  if (jsCode[i] === '{') braceCount++;
  if (jsCode[i] === '}') braceCount--;
}
if (braceCount !== 0) issues.push('Unmatched braces: ' + braceCount);

// Check for unmatched parentheses
let parenCount = 0;
for (let i = 0; i < jsCode.length; i++) {
  if (jsCode[i] === '(') parenCount++;
  if (jsCode[i] === ')') parenCount--;
}
if (parenCount !== 0) issues.push('Unmatched parentheses: ' + parenCount);

// Check for unmatched brackets
let bracketCount = 0;
for (let i = 0; i < jsCode.length; i++) {
  if (jsCode[i] === '[') bracketCount++;
  if (jsCode[i] === ']') bracketCount--;
}
if (bracketCount !== 0) issues.push('Unmatched brackets: ' + bracketCount);

if (issues.length === 0) {
  console.log('✓ JavaScript syntax appears valid');
  console.log('  - Braces are balanced');
  console.log('  - Parentheses are balanced');
  console.log('  - Brackets are balanced');
} else {
  console.error('Syntax issues found:');
  issues.forEach(issue => console.error('  - ' + issue));
  process.exit(1);
}
