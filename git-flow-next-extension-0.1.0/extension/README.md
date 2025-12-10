# Git Flow Next VS Code Extension

A comprehensive VS Code extension for Git Flow Next workflow management, bringing the power of the modern git-flow-next CLI tool directly into your editor.

## Features

- **Complete Git Flow Support**: All git-flow-next commands available through VS Code's command palette
- **Smart Branch Detection**: Automatically detects current branch type and suggests appropriate actions
- **Interactive UI**: User-friendly prompts and selections for all operations
- **Shorthand Commands**: Quick access to common operations like finish, delete, rebase, and update
- **Branch Management**: Full CRUD operations for features, releases, hotfixes, support, and bugfix branches
- **Error Handling**: Clear error messages and validation for all operations
- **Configuration**: Easy setup with presets (Classic, GitHub, GitLab) or custom configuration

## Requirements

- VS Code 1.74.0 or higher
- git-flow-next CLI tool installed ([Installation Guide](https://github.com/gittower/git-flow-next))

## Installation

### Install git-flow-next CLI

**macOS/Linux (Homebrew):**
```bash
brew install gittower/tap/git-flow-next
```

**Manual Installation:**
1. Download the latest release from [GitHub](https://github.com/gittower/git-flow-next/releases)
2. Extract the binary to a location in your PATH
3. Make it executable: `chmod +x /path/to/git-flow`

### Install VS Code Extension

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Git Flow Next"
4. Click Install

## Usage

### Getting Started

1. **Initialize Git Flow** in your repository:
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
   - Type "Git Flow Next: Initialize Git Flow"
   - Choose a preset (Classic, GitHub, GitLab, or Custom)

2. **Start Working with Branches**:
   - Use the command palette to access all git-flow commands
   - Commands are organized by category: Features, Releases, Hotfixes, Support, Bugfixes

### Available Commands

#### Core Commands
- **Initialize Git Flow**: Set up git-flow in your repository
- **Show Overview**: Display git-flow configuration and branches
- **Configure Git Flow**: Manage git-flow settings

#### Feature Management
- **Feature: Start** - Create a new feature branch
- **Feature: Finish** - Complete and merge a feature
- **Feature: List** - Show all feature branches
- **Feature: Checkout** - Switch to a feature branch
- **Feature: Delete** - Remove a feature branch
- **Feature: Rename** - Rename current feature branch
- **Feature: Update** - Update feature from parent branch

#### Release Management
- **Release: Start** - Begin a new release
- **Release: Finish** - Complete a release
- **Release: List** - Show all release branches
- **Release: Checkout** - Switch to a release branch
- **Release: Delete** - Remove a release branch
- **Release: Rename** - Rename current release branch
- **Release: Update** - Update release from parent branch

#### Hotfix Management
- **Hotfix: Start** - Create a hotfix branch
- **Hotfix: Finish** - Complete a hotfix
- **Hotfix: List** - Show all hotfix branches
- **Hotfix: Checkout** - Switch to a hotfix branch
- **Hotfix: Delete** - Remove a hotfix branch
- **Hotfix: Rename** - Rename current hotfix branch
- **Hotfix: Update** - Update hotfix from parent branch

#### Support Management
- **Support: Start** - Create a support branch
- **Support: Finish** - Complete support work
- **Support: List** - Show all support branches
- **Support: Checkout** - Switch to a support branch
- **Support: Delete** - Remove a support branch
- **Support: Rename** - Rename current support branch
- **Support: Update** - Update support from parent branch

#### Bugfix Management
- **Bugfix: Start** - Create a bugfix branch
- **Bugfix: Finish** - Complete a bugfix
- **Bugfix: List** - Show all bugfix branches
- **Bugfix: Checkout** - Switch to a bugfix branch
- **Bugfix: Delete** - Remove a bugfix branch
- **Bugfix: Rename** - Rename current bugfix branch
- **Bugfix: Update** - Update bugfix from parent branch

#### Shorthand Commands (Smart Context Detection)
- **Finish Current Branch** - Automatically finish the current topic branch
- **Delete Current Branch** - Remove the current topic branch
- **Rebase Current Branch** - Rebase current branch from parent
- **Update Current Branch** - Update current branch from parent
- **Rename Current Branch** - Rename the current topic branch
- **Publish Current Branch** - Publish current branch to remote

### Smart Features

#### Branch Detection
The extension automatically detects your current branch type:
- `feature/my-feature` → Feature branch
- `release/1.0.0` → Release branch
- `hotfix/critical-bug` → Hotfix branch
- `support/1.0` → Support branch
- `bugfix/my-bugfix` → Bugfix branch

#### Context-Aware Commands
When you're on a topic branch, commands like "Finish Current Branch" automatically use the correct git-flow command:
```bash
# On feature/my-awesome-feature
# "Finish Current Branch" → git flow feature finish my-awesome-feature

# On release/v1.2.0  
# "Finish Current Branch" → git flow release finish v1.2.0
```

## Configuration

The extension works with git-flow-next's configuration system. You can configure:

- Branch naming prefixes (feature/, release/, hotfix/, etc.)
- Main and develop branch names
- Version tag prefixes
- Merge strategies

Use the "Configure Git Flow" command to manage settings, or configure directly via git-flow-next CLI.

## Workflow Examples

### Starting a New Feature
1. Press `Ctrl+Shift+P`
2. Type "Git Flow Next: Feature: Start"
3. Enter feature name (e.g., "user-authentication")
4. Extension creates `feature/user-authentication` branch and switches to it

### Finishing a Feature
1. Ensure you're on the feature branch
2. Press `Ctrl+Shift+P`
3. Type "Git Flow Next: Finish Current Branch" (or "Feature: Finish")
4. Extension merges the feature and switches back to develop

### Creating a Release
1. Press `Ctrl+Shift+P`
2. Type "Git Flow Next: Release: Start"
3. Enter version number (e.g., "1.2.0")
4. Extension creates `release/1.2.0` branch

### Emergency Hotfix
1. Press `Ctrl+Shift+P`
2. Type "Git Flow Next: Hotfix: Start"
3. Enter hotfix version (e.g., "1.2.1")
4. Extension creates `hotfix/1.2.1` branch from main

## Troubleshooting

### Extension Not Working
1. Ensure git-flow-next CLI is installed and in your PATH
2. Verify you're in a git repository
3. Check that git-flow is initialized (`git flow overview`)

### Command Not Found
- Make sure git-flow-next is properly installed
- Try running `git flow --version` in terminal to verify installation

### Permission Issues
- Ensure the git-flow-next binary is executable
- Check that you have write permissions to the repository

## Development

### Prerequisites
- Node.js 16+
- npm
- VS Code
- git-flow-next CLI

### Setup
1. Clone this repository
2. Run `npm install` to install dependencies
3. Press F5 to run the extension in a new Extension Development Host window

### Building
- `npm run esbuild` - Build the extension
- `npm run esbuild-watch` - Build and watch for changes
- `npm run lint` - Run ESLint

### Testing
1. Open the extension in VS Code
2. Press F5 to launch Extension Development Host
3. Test commands in the new window
4. Use the Command Palette (`Ctrl+Shift+P`) to access all Git Flow Next commands

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch: `git flow feature start my-feature`
3. Make your changes
4. Test thoroughly
5. Commit your changes
6. Push to your fork
7. Create a Pull Request

## Changelog

### 0.1.0
- Initial release
- Complete git-flow-next command integration
- Smart branch detection
- Interactive UI for all operations
- Shorthand commands for common workflows

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built for [git-flow-next](https://github.com/gittower/git-flow-next) by the Tower team
- Inspired by the original [git-flow](https://github.com/nvie/gitflow) by Vincent Driessen
- Thanks to the VS Code extension development community

## Support

- **Issues**: [GitHub Issues](https://github.com/gittower/git-flow-next-vscode/issues)
- **Documentation**: [git-flow-next Docs](https://github.com/gittower/git-flow-next)
- **Tower Git Client**: [Tower](https://www.git-tower.com/)
