#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { program } = require('commander');

const TEMPLATE_CONFIG = `name = "my-worker"
main = "src/index.ts"
compatibility_date = "2024-11-04"

compatibility_flags = [ "nodejs_compat" ]

# [vars]
# MY_VARS = ""

# [[kv_namespaces]]
# binding = "MY_KV_STORE"
# d = "__MY_KV_STORE_ID__"

# [[r2_buckets]]
# binding = "MY_BUCKET"
# bucket_name = "__MY_KV_BUCKET_NAME__"

# [[d1_databases]]
# binding = "DB"
# database_name = "__MY_DATABASE_NAME__"
# database_id = "__MY_DATABASE_ID__"

# [ai]
# binding = "AI"

# [observability]
# enabled = true
# head_sampling_rate = 1`;

const TEMPLATE_ENV = `KV_NAMESPACE_ID=your-kv-id-here`;

function ensureGitIgnore(files) {
  let gitignore = '';
  const gitignorePath = '.gitignore';

  if (fs.existsSync(gitignorePath)) {
    gitignore = fs.readFileSync(gitignorePath, 'utf8');
  }

  const missingFiles = files.filter(file => !gitignore.includes(file));
  
  if (missingFiles.length > 0) {
    if (gitignore && !gitignore.endsWith('\n')) {
      gitignore += '\n';
    }
    
    gitignore += missingFiles.join('\n') + '\n';
    
    fs.writeFileSync(gitignorePath, gitignore);
    console.log('✅ Added to .gitignore:', missingFiles.join(', '));
  }
}

function validateConfig(template, vars) {
  const placeholders = template.match(/__[A-Z0-9_]+__/g) || [];
  const missing = placeholders.filter(p => {
    const varName = p.replace(/__/g, '');
    return !vars[varName];
  });

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
}

function initializeProject() {
  try {
    // Create wrangler-config.toml
    if (fs.existsSync('wrangler-config.toml')) {
      console.log('⚠️  wrangler-config.toml already exists, skipping');
    } else {
      fs.writeFileSync('wrangler-config.toml', TEMPLATE_CONFIG);
      console.log('✅ Created wrangler-config.toml');
    }

    // Create .env
    if (fs.existsSync('.env')) {
      console.log('⚠️  .env already exists, skipping');
    } else {
      fs.writeFileSync('.env', TEMPLATE_ENV);
      console.log('✅ Created .env');
    }

    // Update .gitignore
    ensureGitIgnore([
      'wrangler.toml',
      '.dev.vars',
      '.env'
    ]);

    console.log('\n🎉 Project initialized successfully!');
    console.log('\nNext steps:');
    console.log('1. Edit wrangler-config.toml with your project settings');
    console.log('2. Update .env with your secret values');
    console.log('3. Run "wrangler-manager generate" to create config files');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

function generateConfigs(options) {
  try {
    if (!fs.existsSync(options.config)) {
      throw new Error(`Config template ${options.config} not found`);
    }

    const template = fs.readFileSync(options.config, 'utf8');
    const vars = process.env;
    
    validateConfig(template, vars);
    
    let config = template;
    for (const [key, value] of Object.entries(vars)) {
      config = config.replace(`__${key}__`, value);
    }

    fs.writeFileSync('wrangler.toml', config);
    
    const devVars = Object.entries(vars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    fs.writeFileSync('.dev.vars', devVars);

    ensureGitIgnore(['wrangler.toml', '.dev.vars']);

    console.log('✅ Configuration files generated successfully');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

program
  .name('wrangler-manager')
  .description('Manages Wrangler configuration files');

program
  .command('init')
  .description('Initialize a new project with template files')
  .action(initializeProject);

program
  .command('generate')
  .description('Generate configuration files from templates')
  .option('-c, --config <path>', 'path to config template', 'wrangler-config.toml')
  .action(generateConfigs);

program.parse();