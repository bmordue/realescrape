{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    # Node.js environment (version 16 to match CI)
    nodejs-16_x
    
    # Package managers
    nodePackages.npm
    
    # Development tools
    nodePackages.typescript
    nodePackages.typescript-language-server
    
    # Git for version control
    git
  ];
  
  shellHook = ''
    # Display welcome banner (set NIX_SHELL_QUIET=1 to disable)
    if [ -z "$NIX_SHELL_QUIET" ]; then
      echo "🚀 RealEstate Scraper Development Environment"
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo "Node version: $(node --version)"
      echo "NPM version: $(npm --version)"
      echo "TypeScript version: $(tsc --version)"
      echo ""
      echo "📦 To get started:"
      echo "  1. Run 'npm install' to install dependencies"
      echo "  2. Create a '.env' file with your OPENAI_API_KEY"
      echo "  3. Run 'npm start' to compile and run the scraper"
      echo "  4. Run 'node built/summarise.js' to run AI analysis"
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo ""
      echo "💡 Tip: Set NIX_SHELL_QUIET=1 to disable this banner"
      echo ""
    fi
    
    # Set up environment
    export PATH="$PWD/node_modules/.bin:$PATH"
    
    # Create properties directory if it doesn't exist
    mkdir -p properties
    
    # Helpful aliases
    alias build='npm run prestart'
    alias dev='npm start'
  '';
}
