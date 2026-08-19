#!/usr/bin/env node

/**
 * Run database schema
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DIRECT_CONNECTION = process.env.NEXT_PUBLIC_SUPABASE__DIRECT_CONNECTION;

if (!DIRECT_CONNECTION) {
  console.error('Error: NEXT_PUBLIC_SUPABASE__DIRECT_CONNECTION not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: DIRECT_CONNECTION });

function splitStatements(sql) {
  const statements = [];
  let current = '';
  let inFunction = false;
  let parenDepth = 0;
  let skipComment = false;
  
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1] || '';
    
    // Handle single-line comments
    if (char === '-' && nextChar === '-') {
      skipComment = true;
    }
    if (char === '\n' && skipComment) {
      skipComment = false;
    }
    
    if (skipComment) {
      current += char;
      continue;
    }
    
    current += char;
    
    if (char === '(') parenDepth++;
    if (char === ')') parenDepth--;
    
    // Check for $$ function delimiters
    if (char === '$' && nextChar === '$') {
      inFunction = !inFunction;
    }
    
    // Split on semicolon only if not inside function and paren depth is 0
    if (char === ';' && !inFunction && parenDepth === 0) {
      let trimmed = current.trim();
      
      // Remove leading comment lines
      while (trimmed.startsWith('--')) {
        const newlineIndex = trimmed.indexOf('\n');
        if (newlineIndex === -1) {
          trimmed = '';
          break;
        }
        trimmed = trimmed.substring(newlineIndex + 1).trim();
      }
      
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = '';
    }
  }
  
  // Add any remaining
  let trimmed = current.trim();
  while (trimmed.startsWith('--')) {
    const newlineIndex = trimmed.indexOf('\n');
    if (newlineIndex === -1) {
      trimmed = '';
      break;
    }
    trimmed = trimmed.substring(newlineIndex + 1).trim();
  }
  if (trimmed.length > 0) {
    statements.push(trimmed);
  }
  
  return statements;
}

async function main() {
  const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  const statements = splitStatements(schema);
  
  console.log('Running schema...');
  console.log(`Found ${statements.length} statements`);
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    try {
      await pool.query(statement);
      console.log(`✓ [${i+1}/${statements.length}] Executed: ${statement.substring(0, 80)}...`);
    } catch (error) {
      if (error.code === '42701' || error.code === '42P07') {
        // Column or table already exists, skip
        console.log(`⊘ [${i+1}/${statements.length}] Skipped (already exists): ${statement.substring(0, 80)}...`);
      } else {
        console.error(`✗ [${i+1}/${statements.length}] Error: ${error.message}`);
        console.error(`  Statement: ${statement.substring(0, 150)}...`);
      }
    }
  }
  
  console.log('\nSchema execution complete!');
  await pool.end();
}

main();