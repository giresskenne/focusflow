#!/usr/bin/env node

/**
 * Production Readiness Audit Script
 * 
 * This script scans the codebase and generates a detailed report of
 * debug artifacts that should be reviewed before production deployment.
 * 
 * Usage:
 *   node scripts/audit-production-readiness.js [--json]
 * 
 * Options:
 *   --json    Output results in JSON format
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_JSON = process.argv.includes('--json');

// Statistics and findings
const findings = {
  criticalIssues: [],
  debugLogs: [],
  devOnlyCode: [],
  environmentChecks: [],
  filesScanneCount: 0,
};

const SKIP_PATTERNS = [
  /node_modules/,
  /__tests__/,
  /\.test\./,
  /\.spec\./,
  /scripts\//,
  /docs\//,
  /\.md$/,
  /design2-liquidglass/,
  /deepfocus-design/,
];

function shouldSkipFile(filePath) {
  return SKIP_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Scan a file for issues
 */
function scanFile(filePath) {
  findings.filesScannedCount++;
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const relativePath = path.relative(process.cwd(), filePath);
    
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmedLine = line.trim();
      
      // Check for DEBUG = true
      if (/const\s+DEBUG\s*=\s*true/i.test(line)) {
        findings.criticalIssues.push({
          file: relativePath,
          line: lineNum,
          type: 'DEBUG_FLAG',
          code: trimmedLine,
          severity: 'HIGH',
          message: 'DEBUG flag set to true - should be false in production',
        });
      }
      
      // Check for verbose console.logs (not gated by __DEV__)
      if (/console\.log\(/.test(line) && !isInDevBlock(lines, index)) {
        // Skip if it's error/warn (production monitoring)
        if (!/console\.(error|warn)/.test(line)) {
          findings.debugLogs.push({
            file: relativePath,
            line: lineNum,
            code: trimmedLine,
            message: 'Console.log not gated by __DEV__',
          });
        }
      }
      
      // Check for dev-only patterns
      if (/(DevStub|MOCK_APPS|devAliasSeeder|\/\/ Debug:)/.test(line)) {
        // Check if already gated by IS_DEV or __DEV__
        if (!isInDevBlock(lines, index) && !hasDevCheck(lines, index)) {
          findings.devOnlyCode.push({
            file: relativePath,
            line: lineNum,
            code: trimmedLine,
            message: 'Dev-only code not properly gated',
          });
        }
      }
      
      // Check environment variable usage
      if (/process\.env\.EXPO_PUBLIC_/.test(line)) {
        findings.environmentChecks.push({
          file: relativePath,
          line: lineNum,
          code: trimmedLine,
          message: 'Environment variable usage - verify production values',
        });
      }
    });
  } catch (error) {
    console.error(`Error scanning ${filePath}: ${error.message}`);
  }
}

/**
 * Check if line is within a __DEV__ or IS_DEV block
 */
function isInDevBlock(lines, currentIndex) {
  let braceCount = 0;
  
  // Look backwards for conditional
  for (let i = currentIndex - 1; i >= Math.max(0, currentIndex - 10); i--) {
    const line = lines[i];
    
    // Count braces
    braceCount += (line.match(/}/g) || []).length;
    braceCount -= (line.match(/{/g) || []).length;
    
    // If we've closed all braces, we're out of scope
    if (braceCount > 0) {
      return false;
    }
    
    // Check for dev conditional
    if (/if\s*\(\s*(__DEV__|IS_DEV)\s*\)/.test(line)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if nearby lines have IS_DEV check
 */
function hasDevCheck(lines, currentIndex) {
  for (let i = Math.max(0, currentIndex - 3); i <= Math.min(lines.length - 1, currentIndex + 3); i++) {
    if (/IS_DEV\s*&&/.test(lines[i]) || /IS_DEV\s*\?/.test(lines[i])) {
      return true;
    }
  }
  return false;
}

/**
 * Scan directory recursively
 */
function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (shouldSkipFile(fullPath)) {
      continue;
    }
    
    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.isFile() && /\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      scanFile(fullPath);
    }
  }
}

/**
 * Generate report
 */
function generateReport() {
  if (OUTPUT_JSON) {
    console.log(JSON.stringify(findings, null, 2));
    return;
  }
  
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║         Production Readiness Audit Report                ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  console.log(`📊 Files scanned: ${findings.filesScannedCount}\n`);
  
  // Critical Issues
  if (findings.criticalIssues.length > 0) {
    console.log('🚨 CRITICAL ISSUES (Must Fix):');
    console.log('─────────────────────────────────────────────────────────────');
    findings.criticalIssues.forEach((issue, i) => {
      console.log(`\n${i + 1}. ${issue.type} [${issue.severity}]`);
      console.log(`   File: ${issue.file}:${issue.line}`);
      console.log(`   Code: ${issue.code}`);
      console.log(`   Fix:  ${issue.message}`);
    });
    console.log('\n');
  } else {
    console.log('✅ No critical issues found\n');
  }
  
  // Debug Logs
  if (findings.debugLogs.length > 0) {
    console.log(`⚠️  DEBUG LOGS (${findings.debugLogs.length} found):`);
    console.log('─────────────────────────────────────────────────────────────');
    console.log('Recommendation: Gate with __DEV__ or remove\n');
    
    // Group by file
    const byFile = findings.debugLogs.reduce((acc, log) => {
      if (!acc[log.file]) acc[log.file] = [];
      acc[log.file].push(log);
      return acc;
    }, {});
    
    Object.entries(byFile).forEach(([file, logs]) => {
      console.log(`📄 ${file} (${logs.length} logs)`);
      if (logs.length <= 5) {
        logs.forEach(log => {
          console.log(`   Line ${log.line}: ${log.code.substring(0, 60)}...`);
        });
      }
    });
    console.log('\n');
  } else {
    console.log('✅ All console logs are properly gated\n');
  }
  
  // Dev-only code
  if (findings.devOnlyCode.length > 0) {
    console.log(`ℹ️  DEV-ONLY CODE (${findings.devOnlyCode.length} instances):`);
    console.log('─────────────────────────────────────────────────────────────');
    findings.devOnlyCode.forEach((code, i) => {
      if (i < 10) { // Show first 10
        console.log(`   ${code.file}:${code.line}`);
        console.log(`   ${code.code.substring(0, 60)}...`);
      }
    });
    if (findings.devOnlyCode.length > 10) {
      console.log(`   ... and ${findings.devOnlyCode.length - 10} more`);
    }
    console.log('\n');
  }
  
  // Environment variables
  if (findings.environmentChecks.length > 0) {
    console.log(`🔧 ENVIRONMENT VARIABLES (${findings.environmentChecks.length} found):`);
    console.log('─────────────────────────────────────────────────────────────');
    
    const uniqueVars = [...new Set(
      findings.environmentChecks.map(e => {
        const match = e.code.match(/EXPO_PUBLIC_[A-Z_]+/);
        return match ? match[0] : '';
      }).filter(Boolean)
    )];
    
    console.log('Variables to verify in .env:\n');
    uniqueVars.forEach(varName => {
      console.log(`   ☐ ${varName}`);
    });
    console.log('\n');
  }
  
  // Summary
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                       SUMMARY                             ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  const totalIssues = findings.criticalIssues.length + findings.debugLogs.length + findings.devOnlyCode.length;
  
  if (totalIssues === 0) {
    console.log('✅ Codebase is production-ready!\n');
  } else {
    console.log(`📋 Action Items:`);
    if (findings.criticalIssues.length > 0) {
      console.log(`   🚨 Fix ${findings.criticalIssues.length} critical issue(s)`);
    }
    if (findings.debugLogs.length > 0) {
      console.log(`   ⚠️  Review ${findings.debugLogs.length} debug log(s)`);
    }
    if (findings.devOnlyCode.length > 0) {
      console.log(`   ℹ️  Verify ${findings.devOnlyCode.length} dev-only code block(s)`);
    }
    console.log(`\n💡 Run: node scripts/sanitize-for-production.js --dry-run`);
    console.log(`   to see proposed changes\n`);
  }
}

/**
 * Main execution
 */
function main() {
  const srcDir = path.join(__dirname, '../src');
  const appJs = path.join(__dirname, '../App.js');
  
  // Scan source directory
  if (fs.existsSync(srcDir)) {
    scanDirectory(srcDir);
  }
  
  // Scan App.js
  if (fs.existsSync(appJs) && !shouldSkipFile(appJs)) {
    scanFile(appJs);
  }
  
  // Generate report
  generateReport();
}

// Run the script
main();
