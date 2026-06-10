const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const files = {
  'content.js': 'content.min.js',
  'popup.js': 'popup.min.js'
};

const cssFiles = {
  'content.css': 'content.min.css'
};

async function build() {
  console.log('Building...\n');

  // Minify JS files
  for (const [input, output] of Object.entries(files)) {
    const code = fs.readFileSync(path.join(__dirname, input), 'utf8');
    const result = await minify(code, {
      compress: { drop_console: false },
      mangle: true
    });
    fs.writeFileSync(path.join(__dirname, output), result.code);
    console.log(`✓ ${input} → ${output}`);
  }

  // Minify CSS files
  for (const [input, output] of Object.entries(cssFiles)) {
    let css = fs.readFileSync(path.join(__dirname, input), 'utf8');
    css = css
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s*([{}:;,])\s*/g, '$1')
      .trim();
    fs.writeFileSync(path.join(__dirname, output), css);
    console.log(`✓ ${input} → ${output}`);
  }

  // Update manifest for production
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
  manifest.content_scripts[0].js = ['content.min.js'];
  manifest.content_scripts[0].css = ['content.min.css'];
  manifest.content_scripts[0].run_at = 'document_idle';
  fs.writeFileSync(
    path.join(__dirname, 'manifest.min.json'),
    JSON.stringify(manifest, null, 2)
  );
  console.log('✓ manifest.json → manifest.min.json');

  console.log('\nBuild complete!');
}

build().catch(console.error);
