#!/usr/bin/env node

/**
 * Production Sanitization Script
 * 
 * This script safely removes or gates debug artifacts for production builds.
 * It preserves all production logic and only modifies logging/debug code.
 * 
 * Usage:
 *   node scripts/sanitize-for-production.js [--dry-run] [--verbose]
 * 
 * Options:
 *   --dry-run    Show what would be changed without making modifications
 *   --verbose    Show detailed logging of all operations
 */

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Statistics
const stats = {
  filesScanned: 0,
  filesModified: 0,
  consolesRemoved: 0,
  consolesGated: 0,
  debugFlagsFixed: 0,
  errors: 0,
};

/**
 * Console logs that should be kept (errors/warnings for production monitoring)
 */
const KEEP_PATTERNS = [
  /console\.error/,
  /console\.warn/,
];

/**
 * Console logs that should be removed (verbose debug logs)
 */
const REMOVE_PATTERNS = [
  // Module loaded checks
  /console\.log\(\s*'\[TTS\] Module loaded/,
  /console\.log\(\s*'\[OpenAI TTS\] isAvailable/,
  
  // Debug helpers comments
  /\/\/ Debug:/,
  /\/\/ Immediate post-schedule/,
  
  // Layout debug logs
  /console\.log\(`\[Onboarding\] \$\{label\} layout:/,
  /console\.log\(`\[Onboarding\] \$\{label\} content layout:/,
];

/**
 * Console logs that should be gated with __DEV__ (useful for debugging but not production)
 */
const GATE_PATTERNS = [
  // AI/voice flow logs that help debug user issues
  /console\.log\(\s*'\[AI\] handleUtterance/,
  /console\.log\(\s*'\[AI\] parseIntent result/,
  /console\.log\(\s*'\[AI\] planFromIntent result/,
  /console\.log\(\s*'\[FocusExecutor\]/,
  /console\.log\(\s*'\[VoiceMicButton\] Running utterance/,
  /console\.log\(\s*'\[VoiceMicButton\] Starting STT/,
  /console\.log\(\s*'\[ActiveSession\] Timer check:/,
  /console\.log\(\s*'\[ActiveSession\] Rendering with seconds:/,
];

/**
 * Files to skip (tests, node_modules, etc.)
 */
const SKIP_PATTERNS = [
  /node_modules/,
  /__tests__/,
  /\.test\./,
  /\.spec\./,
  /scripts\//,
  /docs\//,
  /\.md$/,
  /\.json$/,
  /\.lock$/,
  /design2-liquidglass/,
  /deepfocus-design/,
];

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logVerbose(message) {
  if (VERBOSE) {
    console.log(`  ${colors.cyan}→ ${message}${colors.reset}`);
  }
}

/**
 * Check if file should be skipped
 */
function shouldSkipFile(filePath) {
  return SKIP_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Check if line should be kept (error/warn logs)
 */
function shouldKeepLine(line) {
  return KEEP_PATTERNS.some(pattern => pattern.test(line));
}

/**
 * Check if line should be removed
 */
function shouldRemoveLine(line) {
  return REMOVE_PATTERNS.some(pattern => pattern.test(line));
}

/**
 * Check if line should be gated with __DEV__
 */
function shouldGateLine(line) {
  return GATE_PATTERNS.some(pattern => pattern.test(line));
}

/**
 * Check if line is already gated with __DEV__
 */
function isAlreadyGated(lines, index) {
  // Look backwards for if (__DEV__) {
  for (let i = index - 1; i >= Math.max(0, index - 3); i--) {
    if (/if\s*\(\s*__DEV__\s*\)/.test(lines[i])) {
      return true;
    }
  }
  return false;
}

/**
 * Process a single file
 */
function processFile(filePath) {
  stats.filesScanned++;
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const modifiedLines = [];
    let modified = false;
    let skipNext = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip lines marked for skipping
      if (skipNext) {
        skipNext = false;
        continue;
      }

      // Keep error/warn logs (production monitoring)
      if (shouldKeepLine(line)) {
        modifiedLines.push(line);
        logVerbose(`Keeping: ${line.trim()}`);
        continue;
      }

      // Remove verbose debug logs
      if (shouldRemoveLine(line) && !line.trim().startsWith('//')) {
        stats.consolesRemoved++;
        modified = true;
        logVerbose(`Removing: ${line.trim()}`);
        continue;
      }

      // Gate useful logs with __DEV__
      if (shouldGateLine(line) && !isAlreadyGated(lines, i)) {
        const indent = line.match(/^\s*/)[0];
        modifiedLines.push(`${indent}if (__DEV__) {`);
        modifiedLines.push(line);
        modifiedLines.push(`${indent}}`);
        stats.consolesGated++;
        modified = true;
        logVerbose(`Gating: ${line.trim()}`);
        continue;
      }

      // Default: keep the line
      modifiedLines.push(line);
    }

    // Write changes if modified
    if (modified) {
      stats.filesModified++;
      
      if (!DRY_RUN) {
        fs.writeFileSync(filePath, modifiedLines.join('\n'), 'utf8');
        log(`✓ Modified: ${filePath}`, 'green');
      } else {
        log(`⊙ Would modify: ${filePath}`, 'yellow');
      }
    } else {
      logVerbose(`No changes needed: ${filePath}`);
    }
  } catch (error) {
    stats.errors++;
    log(`✗ Error processing ${filePath}: ${error.message}`, 'red');
  }
}

/**
 * Fix DEBUG flag in storekeittest.js
 */
function fixDebugFlags() {
  const storeKitTestPath = path.join(__dirname, '../src/lib/storekeittest.js');
  
  if (!fs.existsSync(storeKitTestPath)) {
    logVerbose('storekeittest.js not found, skipping');
    return;
  }

  try {
    let content = fs.readFileSync(storeKitTestPath, 'utf8');
    const originalContent = content;
    
    // Change DEBUG = true to DEBUG = false
    content = content.replace(
      /const DEBUG = true;/g,
      'const DEBUG = false;'
    );
    
    if (content !== originalContent) {
      stats.debugFlagsFixed++;
      
      if (!DRY_RUN) {
        fs.writeFileSync(storeKitTestPath, content, 'utf8');
        log(`✓ Fixed DEBUG flag in: ${storeKitTestPath}`, 'green');
      } else {
        log(`⊙ Would fix DEBUG flag in: ${storeKitTestPath}`, 'yellow');
      }
    }
  } catch (error) {
    stats.errors++;
    log(`✗ Error fixing debug flags: ${error.message}`, 'red');
  }
}

/**
 * Recursively scan directory for JS/JSX files
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
      processFile(fullPath);
    }
  }
}

/**
 * Main execution
 */
function main() {
  log('\n═══════════════════════════════════════════════', 'cyan');
  log('  Production Sanitization Script', 'cyan');
  log('═══════════════════════════════════════════════\n', 'cyan');
  
  if (DRY_RUN) {
    log('🔍 DRY RUN MODE - No files will be modified\n', 'yellow');
  }
  
  const srcDir = path.join(__dirname, '../src');
  const appJs = path.join(__dirname, '../App.js');
  
  log('📂 Scanning source files...\n', 'blue');
  
  // Process src directory
  scanDirectory(srcDir);
  
  // Process App.js
  if (fs.existsSync(appJs) && !shouldSkipFile(appJs)) {
    processFile(appJs);
  }
  
  // Fix DEBUG flags
  log('\n🔧 Checking debug flags...\n', 'blue');
  fixDebugFlags();
  
  // Print summary
  log('\n═══════════════════════════════════════════════', 'cyan');
  log('  Summary', 'cyan');
  log('═══════════════════════════════════════════════', 'cyan');
  log(`Files scanned:      ${stats.filesScanned}`, 'blue');
  log(`Files modified:     ${stats.filesModified}`, stats.filesModified > 0 ? 'green' : 'blue');
  log(`Console.log removed: ${stats.consolesRemoved}`, stats.consolesRemoved > 0 ? 'green' : 'blue');
  log(`Console.log gated:   ${stats.consolesGated}`, stats.consolesGated > 0 ? 'green' : 'blue');
  log(`Debug flags fixed:   ${stats.debugFlagsFixed}`, stats.debugFlagsFixed > 0 ? 'green' : 'blue');
  log(`Errors:             ${stats.errors}`, stats.errors > 0 ? 'red' : 'blue');
  log('═══════════════════════════════════════════════\n', 'cyan');
  
  if (DRY_RUN) {
    log('💡 Run without --dry-run to apply changes\n', 'yellow');
  } else if (stats.filesModified > 0) {
    log('✅ Production sanitization complete!\n', 'green');
    log('📝 Please review the changes with: git diff\n', 'blue');
  } else {
    log('✨ No changes needed - code is already clean!\n', 'green');
  }
  
  // Exit with error code if there were errors
  process.exit(stats.errors > 0 ? 1 : 0);
}

// Run the script
main();
