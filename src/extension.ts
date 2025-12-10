// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface GitFlowConfig {
    main: string;
    develop: string;
    feature: string;
    release: string;
    hotfix: string;
    support: string;
    bugfix: string;
}

interface BranchInfo {
    type: 'feature' | 'release' | 'hotfix' | 'support' | 'bugfix' | 'main' | 'develop' | 'unknown';
    name: string;
    fullName: string;
}

// Tree item for the sidebar view
class GitFlowTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
    }
}

// Tree data provider for the sidebar
class GitFlowTreeDataProvider implements vscode.TreeDataProvider<GitFlowTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<GitFlowTreeItem | undefined | null | void> = new vscode.EventEmitter<GitFlowTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<GitFlowTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: GitFlowTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: GitFlowTreeItem): Promise<GitFlowTreeItem[]> {
        // When git-flow-next is installed and initialized, show branch overview
        const isInstalled = await this.isGitFlowNextInstalled();
        if (!isInstalled) {
            return [];
        }

        const isInitialized = await this.isGitFlowInitialized();
        if (!isInitialized) {
            return [];
        }

        // Root level - show branch types
        if (!element) {
            return [
                new GitFlowTreeItem('Features', vscode.TreeItemCollapsibleState.Collapsed),
                new GitFlowTreeItem('Releases', vscode.TreeItemCollapsibleState.Collapsed),
                new GitFlowTreeItem('Hotfixes', vscode.TreeItemCollapsibleState.Collapsed),
                new GitFlowTreeItem('Bugfixes', vscode.TreeItemCollapsibleState.Collapsed),
                new GitFlowTreeItem('Support', vscode.TreeItemCollapsibleState.Collapsed)
            ];
        }

        // Get branches for the selected type
        const branchType = element.label.toLowerCase().replace(/s$/, ''); // Remove trailing 's'
        const branches = await this.getBranchList(branchType);

        if (branches.length === 0) {
            // Return a single item showing "No branches found"
            // Fix pluralization for proper grammar
            let branchTypeName = branchType;
            if (branchType === 'hotfixe') {
                branchTypeName = 'hotfix';
            } else if (branchType === 'bugfixe') {
                branchTypeName = 'bugfix';
            }

            const emptyItem = new GitFlowTreeItem(
                `No ${branchTypeName} branches found`,
                vscode.TreeItemCollapsibleState.None
            );
            emptyItem.contextValue = 'empty';
            // Don't add a command so clicking does nothing
            return [emptyItem];
        }

        return branches.map(branch =>
            new GitFlowTreeItem(
                branch,
                vscode.TreeItemCollapsibleState.None,
                {
                    command: `git-flow-next.${branchType}.checkout`,
                    title: 'Checkout Branch',
                    arguments: [branch]
                }
            )
        );
    }

    private async isGitFlowNextInstalled(): Promise<boolean> {
        try {
            await execAsync('git flow version');
            return true;
        } catch (error) {
            return false;
        }
    }

    private async isGitFlowInitialized(): Promise<boolean> {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return false;
        }

        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;

        try {
            const { stdout } = await execAsync('git config --get gitflow.branch.master || git config --get gitflow.branch.main', {
                cwd: workspacePath
            });
            return stdout.trim().length > 0;
        } catch (error) {
            return false;
        }
    }

    private async getBranchList(type: string): Promise<string[]> {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return [];
        }

        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;

        try {
            const { stdout } = await execAsync(`git flow ${type} list`, { cwd: workspacePath });
            return stdout.split('\n')
                .filter(line => line.trim())
                .filter(line => !line.trim().endsWith(':')) // Filter out header lines like "Feature branches:"
                .map(line => line.trim());
        } catch (error) {
            return [];
        }
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Git Flow Next extension is now active!');
    console.log('Extension context:', context.extension.id);

    // Create tree data provider
    const treeDataProvider = new GitFlowTreeDataProvider();
    const treeView = vscode.window.createTreeView('git-flow-next.view', { treeDataProvider });
    context.subscriptions.push(treeView);

    // Storage key for tracking declined installations per repository
    const DECLINED_INSTALL_KEY = 'git-flow-next.declinedInstallations';

    // Helper function to get current repository path
    function getCurrentRepoPath(): string | undefined {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return undefined;
        }
        return vscode.workspace.workspaceFolders[0].uri.fsPath;
    }

    // Helper function to check if user declined installation for current repo
    function hasDeclinedInstallation(): boolean {
        const repoPath = getCurrentRepoPath();
        if (!repoPath) {
            return false;
        }
        const declined = context.workspaceState.get<string[]>(DECLINED_INSTALL_KEY, []);
        return declined.includes(repoPath);
    }

    // Helper function to mark installation as declined for current repo
    function markInstallationDeclined(): void {
        const repoPath = getCurrentRepoPath();
        if (!repoPath) {
            return;
        }
        const declined = context.workspaceState.get<string[]>(DECLINED_INSTALL_KEY, []);
        if (!declined.includes(repoPath)) {
            declined.push(repoPath);
            context.workspaceState.update(DECLINED_INSTALL_KEY, declined);
        }
    }

    // Context variables for conditional command visibility
    const contextKeys = {
        isOnTopicBranch: 'gitFlowNext.isOnTopicBranch',
        isOnFeatureBranch: 'gitFlowNext.isOnFeatureBranch',
        isOnReleaseBranch: 'gitFlowNext.isOnReleaseBranch',
        isOnHotfixBranch: 'gitFlowNext.isOnHotfixBranch',
        isOnSupportBranch: 'gitFlowNext.isOnSupportBranch',
        isOnBugfixBranch: 'gitFlowNext.isOnBugfixBranch',
        featuresExist: 'gitFlowNext.featuresExist',
        releasesExist: 'gitFlowNext.releasesExist',
        hotfixesExist: 'gitFlowNext.hotfixesExist',
        supportsExist: 'gitFlowNext.supportsExist',
        bugfixesExist: 'gitFlowNext.bugfixesExist',
        isInstalled: 'git-flow-next.isInstalled',
        isInitialized: 'git-flow-next.isInitialized'
    };

    // Helper function to update context variables
    async function updateContextVariables() {
        try {
            // Update installation status
            const isInstalled = await isGitFlowNextInstalled();
            await vscode.commands.executeCommand('setContext', contextKeys.isInstalled, isInstalled);

            // Update initialization status
            const isInitialized = await isGitFlowInitialized();
            await vscode.commands.executeCommand('setContext', contextKeys.isInitialized, isInitialized);

            // Refresh tree view
            treeDataProvider.refresh();

            const branchInfo = await getCurrentBranch();
            
            // Set branch type contexts
            await vscode.commands.executeCommand('setContext', contextKeys.isOnTopicBranch, 
                branchInfo.type !== 'main' && branchInfo.type !== 'develop' && branchInfo.type !== 'unknown');
            await vscode.commands.executeCommand('setContext', contextKeys.isOnFeatureBranch, branchInfo.type === 'feature');
            await vscode.commands.executeCommand('setContext', contextKeys.isOnReleaseBranch, branchInfo.type === 'release');
            await vscode.commands.executeCommand('setContext', contextKeys.isOnHotfixBranch, branchInfo.type === 'hotfix');
            await vscode.commands.executeCommand('setContext', contextKeys.isOnSupportBranch, branchInfo.type === 'support');
            await vscode.commands.executeCommand('setContext', contextKeys.isOnBugfixBranch, branchInfo.type === 'bugfix');

            // Check if branches exist for each type
            const [features, releases, hotfixes, supports, bugfixes] = await Promise.all([
                getBranchList('feature'),
                getBranchList('release'),
                getBranchList('hotfix'),
                getBranchList('support'),
                getBranchList('bugfix')
            ]);

            await vscode.commands.executeCommand('setContext', contextKeys.featuresExist, features.length > 0);
            await vscode.commands.executeCommand('setContext', contextKeys.releasesExist, releases.length > 0);
            await vscode.commands.executeCommand('setContext', contextKeys.hotfixesExist, hotfixes.length > 0);
            await vscode.commands.executeCommand('setContext', contextKeys.supportsExist, supports.length > 0);
            await vscode.commands.executeCommand('setContext', contextKeys.bugfixesExist, bugfixes.length > 0);

        } catch (error) {
            // Reset all contexts if not in a git repository
            for (const key of Object.values(contextKeys)) {
                await vscode.commands.executeCommand('setContext', key, false);
            }
        }
    }

    // Helper function to get list of branches of a specific type
    async function getBranchList(type: string): Promise<string[]> {
        try {
            const output = await executeGitFlowCommand(`${type} list`, [], { showOutput: false, showError: false });
            return output.split('\n')
                .filter(line => line.trim())
                .filter(line => !line.trim().endsWith(':')) // Filter out header lines like "Feature branches:"
                .map(line => line.trim());
        } catch (error) {
            return [];
        }
    }

    // Check if git-flow-next is installed
    async function isGitFlowNextInstalled(): Promise<boolean> {
        try {
            await execAsync('git flow version');
            return true;
        } catch (error) {
            return false;
        }
    }

    // Check if Homebrew is installed (macOS only)
    async function isHomebrewInstalled(): Promise<boolean> {
        try {
            await execAsync('brew --version');
            return true;
        } catch (error) {
            return false;
        }
    }


    // Storage key for tracking repos where user declined
    const DECLINED_REPOS_KEY = 'git-flow-next.declinedRepos';

    // Check if git-flow is being used in this repo and show prompt if needed
    async function checkGitFlowUsageAndPrompt() {
        const repoPath = getCurrentRepoPath();
        if (!repoPath) {
            return;
        }

        // Check if git-flow is initialized in this repo
        const isInitialized = await isGitFlowInitialized();

        // If git-flow IS being used, don't show anything
        if (isInitialized) {
            return;
        }

        // Git-flow is NOT being used in this repo
        // Check if user already declined for this repo
        const declinedRepos = context.workspaceState.get<string[]>(DECLINED_REPOS_KEY, []);
        if (declinedRepos.includes(repoPath)) {
            return;
        }

        // Show the prompt
        const choice = await vscode.window.showInformationMessage(
            'This repository is not using git-flow-next. Would you like to install it now?',
            'Yes', 'Not now'
        );

        if (choice === 'Yes') {
            vscode.commands.executeCommand('workbench.view.extension.git-flow-next');
        } else if (choice === 'Not now') {
            // Save that user declined for this repo
            declinedRepos.push(repoPath);
            await context.workspaceState.update(DECLINED_REPOS_KEY, declinedRepos);
        }
    }

    // Update context when workspace changes
    updateContextVariables();

    // Check if git-flow is used in this repo and show prompt if needed (after a short delay to let VS Code load)
    setTimeout(() => {
        checkGitFlowUsageAndPrompt();
    }, 1000);

    const workspaceDisposable = vscode.workspace.onDidChangeWorkspaceFolders(() => {
        updateContextVariables();
    });
    context.subscriptions.push(workspaceDisposable);

    // Update context when git state changes (branch switches, etc.)
    const gitDisposable = vscode.workspace.onDidSaveTextDocument((document) => {
        // Check if this might be a git operation by looking for .git directory changes
        if (document.fileName.includes('.git/') || document.fileName.endsWith('.gitignore')) {
            // Debounce context updates
            setTimeout(() => updateContextVariables(), 1000);
        }
    });
    context.subscriptions.push(gitDisposable);

    // Helper function to check if git flow is initialized
    async function isGitFlowInitialized(): Promise<boolean> {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return false;
        }

        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;

        try {
            // Check if .git/config contains gitflow configuration
            const { stdout } = await execAsync('git config --get gitflow.branch.master || git config --get gitflow.branch.main', {
                cwd: workspacePath
            });
            return stdout.trim().length > 0;
        } catch (error) {
            return false;
        }
    }

    // Helper function to run interactive git flow initialization
    async function runGitFlowInitSetup(skipConfirmation: boolean = false): Promise<void> {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return;
        }

        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;

        // Check if it's a git repository first
        try {
            await execAsync('git rev-parse --git-dir', { cwd: workspacePath });
        } catch (error) {
            vscode.window.showErrorMessage('This is not a git repository. Please initialize git first.');
            return;
        }

        // Prompt user to initialize git flow (only if not called from welcome view button)
        if (!skipConfirmation) {
            const choice = await vscode.window.showInformationMessage(
                'Git Flow has not been initialized in this repository. Would you like to set it up now?',
                'Yes', 'Not now'
            );

            if (choice !== 'Yes') {
                return;
            }
        }

        // Collect git flow configuration with defaults
        const mainBranch = await vscode.window.showInputBox({
            prompt: 'Branch name for production releases',
            value: 'main',
            placeHolder: 'main'
        });
        if (!mainBranch) {
            return;
        }

        const developBranch = await vscode.window.showInputBox({
            prompt: 'Branch name for development',
            value: 'develop',
            placeHolder: 'develop'
        });
        if (!developBranch) {
            return;
        }

        const featurePrefix = await vscode.window.showInputBox({
            prompt: 'Feature branch prefix',
            value: 'feature/',
            placeHolder: 'feature/'
        });
        if (!featurePrefix) {
            return;
        }

        const bugfixPrefix = await vscode.window.showInputBox({
            prompt: 'Bugfix branch prefix',
            value: 'bugfix/',
            placeHolder: 'bugfix/'
        });
        if (!bugfixPrefix) {
            return;
        }

        const releasePrefix = await vscode.window.showInputBox({
            prompt: 'Release branch prefix',
            value: 'release/',
            placeHolder: 'release/'
        });
        if (!releasePrefix) {
            return;
        }

        const hotfixPrefix = await vscode.window.showInputBox({
            prompt: 'Hotfix branch prefix',
            value: 'hotfix/',
            placeHolder: 'hotfix/'
        });
        if (!hotfixPrefix) {
            return;
        }

        const supportPrefix = await vscode.window.showInputBox({
            prompt: 'Support branch prefix',
            value: 'support/',
            placeHolder: 'support/'
        });
        if (!supportPrefix) {
            return;
        }

        const versionTagPrefix = await vscode.window.showInputBox({
            prompt: 'Version tag prefix',
            value: 'v',
            placeHolder: 'v'
        });
        if (!versionTagPrefix) {
            return;
        }

        // Run git flow init with the collected configuration
        try {
            // Configure git flow using git config commands instead of interactive init
            // This is more secure and avoids shell injection issues
            const configCommands = [
                `git config gitflow.branch.master "${mainBranch.replace(/"/g, '\\"')}"`,
                `git config gitflow.branch.develop "${developBranch.replace(/"/g, '\\"')}"`,
                `git config gitflow.prefix.feature "${featurePrefix.replace(/"/g, '\\"')}"`,
                `git config gitflow.prefix.bugfix "${bugfixPrefix.replace(/"/g, '\\"')}"`,
                `git config gitflow.prefix.release "${releasePrefix.replace(/"/g, '\\"')}"`,
                `git config gitflow.prefix.hotfix "${hotfixPrefix.replace(/"/g, '\\"')}"`,
                `git config gitflow.prefix.support "${supportPrefix.replace(/"/g, '\\"')}"`,
                `git config gitflow.prefix.versiontag "${versionTagPrefix.replace(/"/g, '\\"')}"`
            ];

            // Execute all config commands
            for (const cmd of configCommands) {
                await execAsync(cmd, { cwd: workspacePath });
            }

            // Create develop branch if it doesn't exist
            try {
                await execAsync(`git show-ref --verify --quiet refs/heads/${developBranch}`, { cwd: workspacePath });
            } catch {
                // Develop branch doesn't exist, create it
                await execAsync(`git branch "${developBranch.replace(/"/g, '\\"')}"`, { cwd: workspacePath });
            }

            vscode.window.showInformationMessage('Git Flow has been initialized successfully!');

            // Update context variables after initialization
            await updateContextVariables();
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to initialize Git Flow: ${error.message}`);
        }
    }

    // Helper function to get merge strategy from settings
    function getMergeStrategy(branchType: string, operation: 'finish' | 'update'): string[] {
        const config = vscode.workspace.getConfiguration('gitFlowNext');
        const strategy = config.get<string>(`${branchType}.${operation}Strategy`, 'merge');

        if (strategy === 'use-git-config' || !strategy) {
            return [];
        }

        if (operation === 'finish') {
            switch (strategy) {
                case 'rebase':
                    return ['--rebase'];
                case 'squash':
                    return ['--squash'];
                case 'merge':
                    return []; // merge is default
                default:
                    return [];
            }
        } else { // update
            switch (strategy) {
                case 'rebase':
                    return ['--rebase'];
                case 'merge':
                    return []; // merge is default
                default:
                    return [];
            }
        }
    }

    // Helper function to get start point from settings
    function getStartPoint(branchType: string): string[] {
        const config = vscode.workspace.getConfiguration('gitFlowNext');
        const startPoint = config.get<string>(`${branchType}.startPoint`, '');

        if (startPoint && startPoint.trim()) {
            return [startPoint];
        }
        return [];
    }

    // Helper function to configure git-flow remote
    async function configureRemote() {
        const config = vscode.workspace.getConfiguration('gitFlowNext');
        const remoteName = config.get<string>('remoteName', 'origin');

        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return;
        }

        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;

        try {
            await execAsync(`git config gitflow.origin ${remoteName}`, { cwd: workspacePath });
        } catch (error) {
            // Ignore errors - this is not critical
        }
    }

    // Helper function to get fetch flag from settings
    function shouldFetchBeforeStart(): string[] {
        const config = vscode.workspace.getConfiguration('gitFlowNext');
        const shouldFetch = config.get<boolean>('fetchBeforeStart', false);

        return shouldFetch ? ['--fetch'] : [];
    }

    // Helper function to get fast-forward options from settings
    function getFastForwardOptions(branchType: string): string[] {
        const config = vscode.workspace.getConfiguration('gitFlowNext');
        const fastForward = config.get<string>(`${branchType}.fastForward`, 'no-ff');

        if (fastForward === 'use-git-config' || !fastForward) {
            return [];
        }

        switch (fastForward) {
            case 'no-ff':
                return ['--no-ff'];
            case 'ff':
                return ['--ff'];
            default:
                return [];
        }
    }

    // Helper function to get preserve merges option from settings
    function getPreserveMergesOption(branchType: string): string[] {
        const config = vscode.workspace.getConfiguration('gitFlowNext');
        const preserveMerges = config.get<boolean>(`${branchType}.preserveMerges`, false);

        return preserveMerges ? ['--preserve-merges'] : [];
    }

    // Helper function to configure delete remote for branch type
    async function configureDeleteRemote(branchType: string) {
        const config = vscode.workspace.getConfiguration('gitFlowNext');
        const deleteRemote = config.get<boolean>(`${branchType}.deleteRemote`, false);

        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return;
        }

        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;

        try {
            await execAsync(`git config gitflow.branch.${branchType}.deleteRemote ${deleteRemote}`, { cwd: workspacePath });
        } catch (error) {
            // Ignore errors - this is not critical
        }
    }

    // Helper function to get tag options from settings
    async function getTagOptions(branchType: string, branchName?: string): Promise<string[]> {
        const config = vscode.workspace.getConfiguration('gitFlowNext');
        const createTag = config.get<boolean>(`${branchType}.createTag`, false);
        const signTags = config.get<boolean>('signTags', false);
        const gpgKey = config.get<string>('gpgSigningKey', '');
        const tagPrefix = config.get<string>(`${branchType}.tagPrefix`, '');
        const promptForMessage = config.get<boolean>('promptForTagMessage', false);

        const options: string[] = [];

        if (createTag) {
            options.push('--tag');

            // Add tag prefix if configured
            if (tagPrefix && tagPrefix.trim()) {
                options.push('--tagprefix', tagPrefix.trim());
            }

            // Prompt for custom tag message if enabled
            if (promptForMessage && branchName) {
                const tagMessage = await vscode.window.showInputBox({
                    prompt: 'Enter tag message',
                    placeHolder: `Release ${branchName}`,
                    value: `Release ${branchName}`
                });

                if (tagMessage && tagMessage.trim()) {
                    options.push('--message', tagMessage.trim());
                }
            }

            if (signTags) {
                options.push('--sign');
                if (gpgKey && gpgKey.trim()) {
                    options.push('--signingkey', gpgKey.trim());
                }
            }
        } else {
            options.push('--notag');
        }

        return options;
    }

    // Helper function to get branch retention options from settings
    function getBranchRetentionOptions(branchType: string): string[] {
        const config = vscode.workspace.getConfiguration('gitFlowNext');
        const keepBranch = config.get<string>(`${branchType}.keepBranch`, 'delete');
        const forceDelete = config.get<boolean>('forceDelete', false);

        const options: string[] = [];

        if (keepBranch !== 'use-git-config') {
            switch (keepBranch) {
                case 'keep':
                    options.push('--keep');
                    break;
                case 'keep-local':
                    options.push('--keeplocal');
                    break;
                case 'keep-remote':
                    options.push('--keepremote');
                    break;
                case 'delete':
                    // Default behavior, no flag needed
                    break;
            }
        }

        if (forceDelete) {
            options.push('--force-delete');
        }

        return options;
    }

    // Helper function to execute git flow commands
    async function executeGitFlowCommand(command: string, args: string[] = [], options: { showOutput?: boolean; showError?: boolean } = {}): Promise<string> {
        const { showOutput = true, showError = true } = options;

        // Check if git-flow-next is installed before executing commands
        const isInstalled = await isGitFlowNextInstalled();
        if (!isInstalled) {
            // Check if user already declined installation for this repository
            if (hasDeclinedInstallation()) {
                throw new Error('git-flow-next is not installed and installation was declined for this repository');
            }

            const isMac = process.platform === 'darwin';

            if (isMac) {
                const choice = await vscode.window.showErrorMessage(
                    'git-flow-next is required to run this command but is not installed.',
                    'Install via Homebrew',
                    'Show Instructions',
                    'Not Now'
                );

                if (choice === 'Install via Homebrew') {
                    const hasHomebrew = await isHomebrewInstalled();

                    if (!hasHomebrew) {
                        const installBrew = await vscode.window.showWarningMessage(
                            'Homebrew is not installed. Would you like to see installation instructions?',
                            'Yes',
                            'No'
                        );

                        if (installBrew === 'Yes') {
                            vscode.env.openExternal(vscode.Uri.parse('https://brew.sh'));
                        }
                        throw new Error('git-flow-next is not installed');
                    }

                    // Install git-flow-next via Homebrew in terminal
                    const terminal = vscode.window.createTerminal('Git Flow Next Installation');
                    terminal.show();
                    terminal.sendText('brew install gittower/tap/git-flow-next');

                    vscode.window.showInformationMessage(
                        'Installing git-flow-next via Homebrew. Please wait for the installation to complete, then try your command again.'
                    );
                    throw new Error('git-flow-next installation in progress');
                } else if (choice === 'Show Instructions') {
                    vscode.env.openExternal(vscode.Uri.parse('https://github.com/gittower/git-flow-next#installation'));
                    throw new Error('git-flow-next is not installed');
                } else if (choice === 'Not Now') {
                    // User declined - remember this for this repository
                    markInstallationDeclined();
                    throw new Error('git-flow-next is not installed');
                }
            } else {
                const choice = await vscode.window.showErrorMessage(
                    'git-flow-next is required to run this command but is not installed.',
                    'Show Installation Instructions',
                    'Not Now'
                );

                if (choice === 'Show Installation Instructions') {
                    vscode.env.openExternal(vscode.Uri.parse('https://github.com/gittower/git-flow-next#installation'));
                    throw new Error('git-flow-next is not installed');
                } else if (choice === 'Not Now') {
                    // User declined - remember this for this repository
                    markInstallationDeclined();
                    throw new Error('git-flow-next is not installed');
                }
            }

            throw new Error('git-flow-next is not installed');
        }

        // Check if we have a workspace
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            throw new Error('No workspace folder open. Please open a git repository folder.');
        }

        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const fullCommand = `git flow ${command} ${args.join(' ')}`;

        try {
            const { stdout, stderr } = await execAsync(fullCommand, {
                cwd: workspacePath
            });

            if (stderr && showError) {
                console.error(`Git Flow Error: ${stderr}`);
            }

            if (showOutput && stdout.trim()) {
                vscode.window.showInformationMessage(`Git Flow: ${stdout.trim()}`);
            }

            return stdout;
        } catch (error: any) {
            let errorMessage = error.message || error.toString();

            // Extract the actual git-flow error message from the command error
            // The error format is typically: "Command failed: <command>\nError: <actual error>"
            // We want to show only the actual error, not the command wrapper
            const errorMatch = errorMessage.match(/Error: (.+?)(?:\n|$)/);
            if (errorMatch) {
                errorMessage = errorMatch[1];
            } else {
                // If no "Error:" prefix found, try to remove "Command failed:" prefix
                errorMessage = errorMessage.replace(/^Command failed: [^\n]+\n?/, '').trim();
            }

            if (showError && errorMessage) {
                vscode.window.showErrorMessage(`Git Flow: ${errorMessage}`);
            }
            throw error;
        }
    }

    // Helper function to get git-flow prefix from config
    async function getGitFlowPrefix(prefixType: string): Promise<string> {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            // Return default prefixes if no workspace
            const defaults: { [key: string]: string } = {
                'feature': 'feature/',
                'release': 'release/',
                'hotfix': 'hotfix/',
                'support': 'support/',
                'bugfix': 'bugfix/'
            };
            return defaults[prefixType] || `${prefixType}/`;
        }

        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;

        try {
            const { stdout } = await execAsync(`git config --get gitflow.prefix.${prefixType}`, {
                cwd: workspacePath
            });
            return stdout.trim();
        } catch {
            // If config doesn't exist, return default prefix
            return `${prefixType}/`;
        }
    }

    // Helper function to get current branch info
    async function getCurrentBranch(): Promise<BranchInfo> {
        // Check if we have a workspace
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            throw new Error('No workspace folder open. Please open a git repository folder.');
        }

        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;

        try {
            const { stdout } = await execAsync('git branch --show-current', {
                cwd: workspacePath
            });

            const branchName = stdout.trim();

            // Get configured prefixes
            const featurePrefix = await getGitFlowPrefix('feature');
            const releasePrefix = await getGitFlowPrefix('release');
            const hotfixPrefix = await getGitFlowPrefix('hotfix');
            const supportPrefix = await getGitFlowPrefix('support');
            const bugfixPrefix = await getGitFlowPrefix('bugfix');

            // Determine branch type based on configured prefixes
            if (branchName.startsWith(featurePrefix)) {
                return {
                    type: 'feature',
                    name: branchName.replace(featurePrefix, ''),
                    fullName: branchName
                };
            } else if (branchName.startsWith(releasePrefix)) {
                return {
                    type: 'release',
                    name: branchName.replace(releasePrefix, ''),
                    fullName: branchName
                };
            } else if (branchName.startsWith(hotfixPrefix)) {
                return {
                    type: 'hotfix',
                    name: branchName.replace(hotfixPrefix, ''),
                    fullName: branchName
                };
            } else if (branchName.startsWith(supportPrefix)) {
                return {
                    type: 'support',
                    name: branchName.replace(supportPrefix, ''),
                    fullName: branchName
                };
            } else if (branchName.startsWith(bugfixPrefix)) {
                return {
                    type: 'bugfix',
                    name: branchName.replace(bugfixPrefix, ''),
                    fullName: branchName
                };
            } else if (branchName === 'main' || branchName === 'master') {
                return {
                    type: 'main',
                    name: branchName,
                    fullName: branchName
                };
            } else if (branchName === 'develop') {
                return {
                    type: 'develop',
                    name: branchName,
                    fullName: branchName
                };
            } else {
                return {
                    type: 'unknown',
                    name: branchName,
                    fullName: branchName
                };
            }
        } catch (error) {
            throw new Error('Not in a git repository');
        }
    }

    // Helper function to prompt for input
    async function promptForInput(prompt: string, placeholder?: string): Promise<string | undefined> {
        return await vscode.window.showInputBox({
            prompt,
            placeHolder: placeholder,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Please enter a valid value';
                }
                return null;
            }
        });
    }

    // Helper function to show branch selection
    async function showBranchSelection(branches: string[], prompt: string): Promise<string | undefined> {
        if (branches.length === 0) {
            vscode.window.showInformationMessage('No branches found');
            return undefined;
        }
        
        return await vscode.window.showQuickPick(branches, {
            placeHolder: prompt
        });
    }

    // Install git-flow-next package
    const installPackageCommand = vscode.commands.registerCommand('git-flow-next.installPackage', async () => {
        const isMac = process.platform === 'darwin';

        if (isMac) {
            // macOS - offer Homebrew installation
            const hasHomebrew = await isHomebrewInstalled();

            if (!hasHomebrew) {
                const installBrew = await vscode.window.showWarningMessage(
                    'Homebrew is not installed. Would you like to see installation instructions?',
                    'Yes',
                    'No'
                );

                if (installBrew === 'Yes') {
                    vscode.env.openExternal(vscode.Uri.parse('https://brew.sh'));
                }
                return;
            }

            // Install git-flow-next via Homebrew in terminal
            const terminal = vscode.window.createTerminal('Git Flow Next Installation');
            terminal.show();
            terminal.sendText('brew install gittower/tap/git-flow-next');

            vscode.window.showInformationMessage(
                'Installing git-flow-next via Homebrew. The extension will be ready once installation completes.'
            );

            // Update context after a delay to allow installation to complete
            setTimeout(async () => {
                await updateContextVariables();
            }, 5000);
        } else {
            // Non-macOS platforms - show instructions
            vscode.window.showInformationMessage(
                'Please follow the installation instructions for your platform.',
                'View Instructions'
            ).then(choice => {
                if (choice === 'View Instructions') {
                    vscode.env.openExternal(vscode.Uri.parse('https://github.com/gittower/git-flow-next#installation'));
                }
            });
        }
    });

    // Show installation instructions
    const showInstallInstructionsCommand = vscode.commands.registerCommand('git-flow-next.showInstallInstructions', async () => {
        vscode.env.openExternal(vscode.Uri.parse('https://github.com/gittower/git-flow-next#installation'));
    });

    // Initialize Git Flow (with confirmation for command palette)
    const initCommand = vscode.commands.registerCommand('git-flow-next.init', async () => {
        try {
            // Check if already initialized
            const isInitialized = await isGitFlowInitialized();
            if (isInitialized) {
                const reinit = await vscode.window.showWarningMessage(
                    'Git Flow is already initialized. Do you want to reinitialize?',
                    'Yes', 'No'
                );
                if (reinit !== 'Yes') {
                    return;
                }
            }

            // Run the interactive setup (with confirmation when called from command palette)
            await runGitFlowInitSetup(isInitialized); // Skip confirmation only if re-initializing
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to initialize Git Flow: ${error}`);
        }
    });

    // Initialize Git Flow from welcome view (without confirmation)
    const initFromWelcomeCommand = vscode.commands.registerCommand('git-flow-next.initFromWelcome', async () => {
        try {
            // Check if already initialized
            const isInitialized = await isGitFlowInitialized();
            if (isInitialized) {
                vscode.window.showInformationMessage('Git Flow is already initialized!');
                await updateContextVariables();
                return;
            }

            // Run the interactive setup directly (no confirmation needed from welcome button)
            await runGitFlowInitSetup(true);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to initialize Git Flow: ${error}`);
        }
    });

    // Feature commands
    const featureStartCommand = vscode.commands.registerCommand('git-flow-next.feature.start', async () => {
        try {
            const featureName = await promptForInput('Enter feature name', 'my-feature');
            if (!featureName) {
                return;
            }

            // Ask if user wants to specify a base commit/branch
            const useCustomBase = await vscode.window.showQuickPick(['No', 'Yes'], {
                placeHolder: 'Start from a specific commit, tag, or branch?'
            });

            let baseArgs: string[] = [];
            if (useCustomBase === 'Yes') {
                const base = await vscode.window.showInputBox({
                    prompt: 'Enter base commit, tag, or branch (leave empty to use default)',
                    placeHolder: 'main, abc123, v1.0.0'
                });
                if (base && base.trim()) {
                    baseArgs = [base.trim()];
                }
            }

            await configureRemote();
            const startPointArgs = baseArgs.length > 0 ? baseArgs : getStartPoint('feature');
            const fetchArgs = shouldFetchBeforeStart();
            await executeGitFlowCommand('feature start', [featureName, ...startPointArgs, ...fetchArgs]);
            await updateContextVariables();
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const featureFinishCommand = vscode.commands.registerCommand('git-flow-next.feature.finish', async () => {
        try {
            await configureRemote();
            await configureDeleteRemote('feature');
            const strategyArgs = getMergeStrategy('feature', 'finish');
            const fastForwardArgs = getFastForwardOptions('feature');
            const preserveMergesArgs = getPreserveMergesOption('feature');
            const retentionArgs = getBranchRetentionOptions('feature');
            const branchInfo = await getCurrentBranch();

            if (branchInfo.type === 'feature') {
                const tagArgs = await getTagOptions('feature', branchInfo.name);
                await executeGitFlowCommand('feature finish', [branchInfo.name, ...strategyArgs, ...fastForwardArgs, ...preserveMergesArgs, ...tagArgs, ...retentionArgs]);
            } else {
                // Show list of features to finish
                const output = await executeGitFlowCommand('feature list', [], { showOutput: false });
                const features = output.split('\n')
                    .filter(line => line.trim())
                    .filter(line => !line.trim().endsWith(':')) // Filter out header lines
                    .filter(line => !line.includes('No feature branches')) // Filter out "No feature branches" messages
                    .map(line => line.trim());

                if (features.length === 0) {
                    vscode.window.showInformationMessage('No feature branches available to finish');
                    return;
                }

                const selectedFeature = await showBranchSelection(features, 'Select feature to finish');
                if (selectedFeature) {
                    const tagArgs = await getTagOptions('feature', selectedFeature);
                    await executeGitFlowCommand('feature finish', [selectedFeature, ...strategyArgs, ...fastForwardArgs, ...preserveMergesArgs, ...tagArgs, ...retentionArgs]);
                }
            }
            await updateContextVariables();
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const featureListCommand = vscode.commands.registerCommand('git-flow-next.feature.list', async () => {
        try {
            const output = await executeGitFlowCommand('feature list', [], { showOutput: false });
            const features = output.split('\n')
                .filter(line => line.trim())
                .filter(line => !line.trim().endsWith(':')) // Filter out header lines
                .map(line => line.trim());

            if (features.length === 0) {
                vscode.window.showInformationMessage('Git Flow: No feature branches found');
            } else {
                const formattedList = features.map(f => `"${f}"`).join(', ');
                vscode.window.showInformationMessage(`Git Flow: Feature branches: ${formattedList}`);
            }
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const featureCheckoutCommand = vscode.commands.registerCommand('git-flow-next.feature.checkout', async () => {
        try {
            const output = await executeGitFlowCommand('feature list', [], { showOutput: false });
            const features = output.split('\n')
                .filter(line => line.trim())
                .filter(line => !line.trim().endsWith(':')) // Filter out header lines like "Feature branches:"
                .filter(line => !line.includes('No feature branches')) // Filter out "No feature branches" messages
                .map(line => line.trim());

            if (features.length === 0) {
                vscode.window.showInformationMessage('No feature branches available to checkout');
                return;
            }

            const selectedFeature = await showBranchSelection(features, 'Select feature to checkout');
            if (selectedFeature) {
                await executeGitFlowCommand('feature checkout', [selectedFeature]);
            }
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const featureDeleteCommand = vscode.commands.registerCommand('git-flow-next.feature.delete', async () => {
        try {
            const output = await executeGitFlowCommand('feature list', [], { showOutput: false });
            const features = output.split('\n')
                .filter(line => line.trim())
                .filter(line => !line.trim().endsWith(':')) // Filter out header lines
                .filter(line => !line.includes('No feature branches')) // Filter out "No feature branches" messages
                .map(line => line.trim());

            if (features.length === 0) {
                vscode.window.showInformationMessage('No feature branches available to delete');
                return;
            }

            const selectedFeature = await showBranchSelection(features, 'Select feature to delete');
            if (selectedFeature) {
                const confirmed = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete feature "${selectedFeature}"?`,
                    'Yes', 'No'
                );
                if (confirmed === 'Yes') {
                    await executeGitFlowCommand('feature delete', [selectedFeature]);
                    await updateContextVariables();
                }
            }
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const featureRenameCommand = vscode.commands.registerCommand('git-flow-next.feature.rename', async () => {
        try {
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type === 'feature') {
                if (!branchInfo.name || branchInfo.name.trim().length === 0) {
                    vscode.window.showErrorMessage('Failed to get current branch name');
                    return;
                }
                const newName = await promptForInput('Enter new feature name', branchInfo.name);
                if (newName) {
                    await executeGitFlowCommand('feature rename', [branchInfo.name, newName]);
                }
            } else {
                vscode.window.showWarningMessage('You must be on a feature branch to rename it');
            }
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const featureUpdateCommand = vscode.commands.registerCommand('git-flow-next.feature.update', async () => {
        try {
            const strategyArgs = getMergeStrategy('feature', 'update');
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type === 'feature') {
                await executeGitFlowCommand('feature update', [branchInfo.name, ...strategyArgs]);
            } else {
                vscode.window.showWarningMessage('You must be on a feature branch to update it');
            }
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    // Release commands
    const releaseStartCommand = vscode.commands.registerCommand('git-flow-next.release.start', async () => {
        try {
            const version = await promptForInput('Enter release version', '1.0.0');
            if (!version) {
                return;
            }

            // Ask if user wants to specify a base commit/branch
            const useCustomBase = await vscode.window.showQuickPick(['No', 'Yes'], {
                placeHolder: 'Start from a specific commit, tag, or branch?'
            });

            let baseArgs: string[] = [];
            if (useCustomBase === 'Yes') {
                const base = await vscode.window.showInputBox({
                    prompt: 'Enter base commit, tag, or branch (leave empty to use default)',
                    placeHolder: 'main, abc123, v1.0.0'
                });
                if (base && base.trim()) {
                    baseArgs = [base.trim()];
                }
            }

            await configureRemote();
            const startPointArgs = baseArgs.length > 0 ? baseArgs : getStartPoint('release');
            const fetchArgs = shouldFetchBeforeStart();
            await executeGitFlowCommand('release start', [version, ...startPointArgs, ...fetchArgs]);
            await updateContextVariables();
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const releaseFinishCommand = vscode.commands.registerCommand('git-flow-next.release.finish', async () => {
        try {
            await configureRemote();
            await configureDeleteRemote('release');
            const fastForwardArgs = getFastForwardOptions('release');
            const preserveMergesArgs = getPreserveMergesOption('release');
            const retentionArgs = getBranchRetentionOptions('release');
            const strategyArgs = getMergeStrategy('release', 'finish');
            const branchInfo = await getCurrentBranch();

            if (branchInfo.type === 'release') {
                const tagArgs = await getTagOptions('release', branchInfo.name);
                await executeGitFlowCommand('release finish', [branchInfo.name, ...strategyArgs, ...fastForwardArgs, ...preserveMergesArgs, ...tagArgs, ...retentionArgs]);
            } else {
                const output = await executeGitFlowCommand('release list', [], { showOutput: false });
                const releases = output.split('\n')
                    .filter(line => line.trim())
                    .filter(line => !line.trim().endsWith(':')) // Filter out header lines
                    .filter(line => !line.includes('No release branches')) // Filter out "No release branches" messages
                    .map(line => line.trim());

                if (releases.length === 0) {
                    vscode.window.showInformationMessage('No release branches available to finish');
                    return;
                }

                const selectedRelease = await showBranchSelection(releases, 'Select release to finish');
                if (selectedRelease) {
                    const tagArgs = await getTagOptions('release', selectedRelease);
                    await executeGitFlowCommand('release finish', [selectedRelease, ...strategyArgs, ...fastForwardArgs, ...preserveMergesArgs, ...tagArgs, ...retentionArgs]);
                }
            }
            await updateContextVariables();
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const releaseListCommand = vscode.commands.registerCommand('git-flow-next.release.list', async () => {
        await executeGitFlowCommand('release list');
    });

    const releaseCheckoutCommand = vscode.commands.registerCommand('git-flow-next.release.checkout', async () => {
        try {
            const output = await executeGitFlowCommand('release list', [], { showOutput: false });
            const releases = output.split('\n')
                .filter(line => line.trim())
                .filter(line => !line.trim().endsWith(':')) // Filter out header lines
                .filter(line => !line.includes('No release branches')) // Filter out "No release branches" messages
                .map(line => line.trim());

            if (releases.length === 0) {
                vscode.window.showInformationMessage('No release branches available to checkout');
                return;
            }

            const selectedRelease = await showBranchSelection(releases, 'Select release to checkout');
            if (selectedRelease) {
                await executeGitFlowCommand('release checkout', [selectedRelease]);
            }
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const releaseDeleteCommand = vscode.commands.registerCommand('git-flow-next.release.delete', async () => {
        try {
            const output = await executeGitFlowCommand('release list', [], { showOutput: false });
            const releases = output.split('\n')
                .filter(line => line.trim())
                .filter(line => !line.trim().endsWith(':')) // Filter out header lines
                .filter(line => !line.includes('No release branches')) // Filter out "No release branches" messages
                .map(line => line.trim());

            if (releases.length === 0) {
                vscode.window.showInformationMessage('No release branches available to delete');
                return;
            }

            const selectedRelease = await showBranchSelection(releases, 'Select release to delete');
            if (selectedRelease) {
                const confirmed = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete release "${selectedRelease}"?`,
                    'Yes', 'No'
                );
                if (confirmed === 'Yes') {
                    await executeGitFlowCommand('release delete', [selectedRelease]);
                }
            }
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const releaseRenameCommand = vscode.commands.registerCommand('git-flow-next.release.rename', async () => {
        try {
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type === 'release') {
                if (!branchInfo.name || branchInfo.name.trim().length === 0) {
                    vscode.window.showErrorMessage('Failed to get current branch name');
                    return;
                }
                const newName = await promptForInput('Enter new release version', branchInfo.name);
                if (newName) {
                    await executeGitFlowCommand('release rename', [branchInfo.name, newName]);
                }
            } else {
                vscode.window.showWarningMessage('You must be on a release branch to rename it');
            }
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const releaseUpdateCommand = vscode.commands.registerCommand('git-flow-next.release.update', async () => {
        try {
            const strategyArgs = getMergeStrategy('release', 'update');
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type === 'release') {
                await executeGitFlowCommand('release update', [branchInfo.name, ...strategyArgs]);
            } else {
                vscode.window.showWarningMessage('You must be on a release branch to update it');
            }
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    // Hotfix commands
    const hotfixStartCommand = vscode.commands.registerCommand('git-flow-next.hotfix.start', async () => {
        try {
            const version = await promptForInput('Enter hotfix version', '1.0.1');
            if (!version) {
                return;
            }

            // Ask if user wants to specify a base commit/branch
            const useCustomBase = await vscode.window.showQuickPick(['No', 'Yes'], {
                placeHolder: 'Start from a specific commit, tag, or branch?'
            });

            let baseArgs: string[] = [];
            if (useCustomBase === 'Yes') {
                const base = await vscode.window.showInputBox({
                    prompt: 'Enter base commit, tag, or branch (leave empty to use default)',
                    placeHolder: 'main, abc123, v1.0.0'
                });
                if (base && base.trim()) {
                    baseArgs = [base.trim()];
                }
            }

            await configureRemote();
            const startPointArgs = baseArgs.length > 0 ? baseArgs : getStartPoint('hotfix');
            const fetchArgs = shouldFetchBeforeStart();
            await executeGitFlowCommand('hotfix start', [version, ...startPointArgs, ...fetchArgs]);
            await updateContextVariables();
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const hotfixFinishCommand = vscode.commands.registerCommand('git-flow-next.hotfix.finish', async () => {
        try {
            await configureRemote();
            await configureDeleteRemote('hotfix');
            const fastForwardArgs = getFastForwardOptions('hotfix');
            const preserveMergesArgs = getPreserveMergesOption('hotfix');
            const retentionArgs = getBranchRetentionOptions('hotfix');
            const strategyArgs = getMergeStrategy('hotfix', 'finish');
            const branchInfo = await getCurrentBranch();

            if (branchInfo.type === 'hotfix') {
                const tagArgs = await getTagOptions('hotfix', branchInfo.name);
                await executeGitFlowCommand('hotfix finish', [branchInfo.name, ...strategyArgs, ...fastForwardArgs, ...preserveMergesArgs, ...tagArgs, ...retentionArgs]);
            } else {
                const output = await executeGitFlowCommand('hotfix list', [], { showOutput: false });
                const hotfixes = output.split('\n')
                    .filter(line => line.trim())
                    .filter(line => !line.trim().endsWith(':')) // Filter out header lines
                    .filter(line => !line.includes('No hotfix branches')) // Filter out "No hotfix branches" messages
                    .map(line => line.trim());

                if (hotfixes.length === 0) {
                    vscode.window.showInformationMessage('No hotfix branches available to finish');
                    return;
                }

                const selectedHotfix = await showBranchSelection(hotfixes, 'Select hotfix to finish');
                if (selectedHotfix) {
                    const tagArgs = await getTagOptions('hotfix', selectedHotfix);
                    await executeGitFlowCommand('hotfix finish', [selectedHotfix, ...strategyArgs, ...fastForwardArgs, ...preserveMergesArgs, ...tagArgs, ...retentionArgs]);
                }
            }
            await updateContextVariables();
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const hotfixListCommand = vscode.commands.registerCommand('git-flow-next.hotfix.list', async () => {
        await executeGitFlowCommand('hotfix list');
    });

    const hotfixCheckoutCommand = vscode.commands.registerCommand('git-flow-next.hotfix.checkout', async () => {
        try {
            const output = await executeGitFlowCommand('hotfix list', [], { showOutput: false });
            const hotfixes = output.split('\n')
                .filter(line => line.trim())
                .filter(line => !line.trim().endsWith(':')) // Filter out header lines
                .filter(line => !line.includes('No hotfix branches')) // Filter out "No hotfix branches" messages
                .map(line => line.trim());

            if (hotfixes.length === 0) {
                vscode.window.showInformationMessage('No hotfix branches available to checkout');
                return;
            }

            const selectedHotfix = await showBranchSelection(hotfixes, 'Select hotfix to checkout');
            if (selectedHotfix) {
                await executeGitFlowCommand('hotfix checkout', [selectedHotfix]);
            }
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const hotfixDeleteCommand = vscode.commands.registerCommand('git-flow-next.hotfix.delete', async () => {
        try {
            const output = await executeGitFlowCommand('hotfix list', [], { showOutput: false });
            const hotfixes = output.split('\n')
                .filter(line => line.trim())
                .filter(line => !line.trim().endsWith(':')) // Filter out header lines
                .filter(line => !line.includes('No hotfix branches')) // Filter out "No hotfix branches" messages
                .map(line => line.trim());

            if (hotfixes.length === 0) {
                vscode.window.showInformationMessage('No hotfix branches available to delete');
                return;
            }

            const selectedHotfix = await showBranchSelection(hotfixes, 'Select hotfix to delete');
            if (selectedHotfix) {
                const confirmed = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete hotfix "${selectedHotfix}"?`,
                    'Yes', 'No'
                );
                if (confirmed === 'Yes') {
                    await executeGitFlowCommand('hotfix delete', [selectedHotfix]);
                }
            }
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const hotfixRenameCommand = vscode.commands.registerCommand('git-flow-next.hotfix.rename', async () => {
        try {
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type === 'hotfix') {
                if (!branchInfo.name || branchInfo.name.trim().length === 0) {
                    vscode.window.showErrorMessage('Failed to get current branch name');
                    return;
                }
                const newName = await promptForInput('Enter new hotfix version', branchInfo.name);
                if (newName) {
                    await executeGitFlowCommand('hotfix rename', [branchInfo.name, newName]);
                }
            } else {
                vscode.window.showWarningMessage('You must be on a hotfix branch to rename it');
            }
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const hotfixUpdateCommand = vscode.commands.registerCommand('git-flow-next.hotfix.update', async () => {
        try {
            const strategyArgs = getMergeStrategy('hotfix', 'update');
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type === 'hotfix') {
                await executeGitFlowCommand('hotfix update', [branchInfo.name, ...strategyArgs]);
            } else {
                vscode.window.showWarningMessage('You must be on a hotfix branch to update it');
            }
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    // Support commands
    const supportStartCommand = vscode.commands.registerCommand('git-flow-next.support.start', async () => {
        try {
            const version = await promptForInput('Enter support version', '1.0');
            if (!version) {
                return;
            }

            // Ask if user wants to specify a base commit/branch
            const useCustomBase = await vscode.window.showQuickPick(['No', 'Yes'], {
                placeHolder: 'Start from a specific commit, tag, or branch?'
            });

            let baseArgs: string[] = [];
            if (useCustomBase === 'Yes') {
                const base = await vscode.window.showInputBox({
                    prompt: 'Enter base commit, tag, or branch (leave empty to use default)',
                    placeHolder: 'main, abc123, v1.0.0'
                });
                if (base && base.trim()) {
                    baseArgs = [base.trim()];
                }
            }

            await configureRemote();
            const startPointArgs = baseArgs.length > 0 ? baseArgs : getStartPoint('support');
            const fetchArgs = shouldFetchBeforeStart();
            await executeGitFlowCommand('support start', [version, ...startPointArgs, ...fetchArgs]);
            await updateContextVariables();
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const supportFinishCommand = vscode.commands.registerCommand('git-flow-next.support.finish', async () => {
        try {
            await configureRemote();
            await configureDeleteRemote('support');
            const fastForwardArgs = getFastForwardOptions('support');
            const preserveMergesArgs = getPreserveMergesOption('support');
            const retentionArgs = getBranchRetentionOptions('support');
            const strategyArgs = getMergeStrategy('support', 'finish');
            const branchInfo = await getCurrentBranch();

            if (branchInfo.type === 'support') {
                const tagArgs = await getTagOptions('support', branchInfo.name);
                await executeGitFlowCommand('support finish', [branchInfo.name, ...strategyArgs, ...fastForwardArgs, ...preserveMergesArgs, ...tagArgs, ...retentionArgs]);
            } else {
                const output = await executeGitFlowCommand('support list', [], { showOutput: false });
                const supports = output.split('\n')
                    .filter(line => line.trim())
                    .filter(line => !line.trim().endsWith(':')) // Filter out header lines
                    .filter(line => !line.includes('No support branches')) // Filter out "No support branches" messages
                    .map(line => line.trim());

                if (supports.length === 0) {
                    vscode.window.showInformationMessage('No support branches available to finish');
                    return;
                }

                const selectedSupport = await showBranchSelection(supports, 'Select support to finish');
                if (selectedSupport) {
                    const tagArgs = await getTagOptions('support', selectedSupport);
                    await executeGitFlowCommand('support finish', [selectedSupport, ...strategyArgs, ...fastForwardArgs, ...preserveMergesArgs, ...tagArgs, ...retentionArgs]);
                }
            }
            await updateContextVariables();
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const supportListCommand = vscode.commands.registerCommand('git-flow-next.support.list', async () => {
        await executeGitFlowCommand('support list');
    });

    const supportCheckoutCommand = vscode.commands.registerCommand('git-flow-next.support.checkout', async () => {
        try {
            const output = await executeGitFlowCommand('support list', [], { showOutput: false });
            const supports = output.split('\n')
                .filter(line => line.trim())
                .filter(line => !line.trim().endsWith(':')) // Filter out header lines
                .filter(line => !line.includes('No support branches')) // Filter out "No support branches" messages
                .map(line => line.trim());

            if (supports.length === 0) {
                vscode.window.showInformationMessage('No support branches available to checkout');
                return;
            }

            const selectedSupport = await showBranchSelection(supports, 'Select support to checkout');
            if (selectedSupport) {
                await executeGitFlowCommand('support checkout', [selectedSupport]);
            }
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const supportDeleteCommand = vscode.commands.registerCommand('git-flow-next.support.delete', async () => {
        try {
            const output = await executeGitFlowCommand('support list', [], { showOutput: false });
            const supports = output.split('\n')
                .filter(line => line.trim())
                .filter(line => !line.trim().endsWith(':')) // Filter out header lines
                .filter(line => !line.includes('No support branches')) // Filter out "No support branches" messages
                .map(line => line.trim());

            if (supports.length === 0) {
                vscode.window.showInformationMessage('No support branches available to delete');
                return;
            }

            const selectedSupport = await showBranchSelection(supports, 'Select support to delete');
            if (selectedSupport) {
                const confirmed = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete support "${selectedSupport}"?`,
                    'Yes', 'No'
                );
                if (confirmed === 'Yes') {
                    await executeGitFlowCommand('support delete', [selectedSupport]);
                }
            }
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const supportRenameCommand = vscode.commands.registerCommand('git-flow-next.support.rename', async () => {
        try {
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type === 'support') {
                if (!branchInfo.name || branchInfo.name.trim().length === 0) {
                    vscode.window.showErrorMessage('Failed to get current branch name');
                    return;
                }
                const newName = await promptForInput('Enter new support version', branchInfo.name);
                if (newName) {
                    await executeGitFlowCommand('support rename', [branchInfo.name, newName]);
                }
            } else {
                vscode.window.showWarningMessage('You must be on a support branch to rename it');
            }
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const supportUpdateCommand = vscode.commands.registerCommand('git-flow-next.support.update', async () => {
        try {
            const strategyArgs = getMergeStrategy('support', 'update');
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type === 'support') {
                await executeGitFlowCommand('support update', [branchInfo.name, ...strategyArgs]);
            } else {
                vscode.window.showWarningMessage('You must be on a support branch to update it');
            }
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    // Bugfix commands
    const bugfixStartCommand = vscode.commands.registerCommand('git-flow-next.bugfix.start', async () => {
        try {
            const bugfixName = await promptForInput('Enter bugfix name', 'my-bugfix');
            if (!bugfixName) {
                return;
            }

            // Ask if user wants to specify a base commit/branch
            const useCustomBase = await vscode.window.showQuickPick(['No', 'Yes'], {
                placeHolder: 'Start from a specific commit, tag, or branch?'
            });

            let baseArgs: string[] = [];
            if (useCustomBase === 'Yes') {
                const base = await vscode.window.showInputBox({
                    prompt: 'Enter base commit, tag, or branch (leave empty to use default)',
                    placeHolder: 'main, abc123, v1.0.0'
                });
                if (base && base.trim()) {
                    baseArgs = [base.trim()];
                }
            }

            await configureRemote();
            const startPointArgs = baseArgs.length > 0 ? baseArgs : getStartPoint('bugfix');
            const fetchArgs = shouldFetchBeforeStart();
            await executeGitFlowCommand('bugfix start', [bugfixName, ...startPointArgs, ...fetchArgs]);
            await updateContextVariables();
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const bugfixFinishCommand = vscode.commands.registerCommand('git-flow-next.bugfix.finish', async () => {
        try {
            await configureRemote();
            await configureDeleteRemote('bugfix');
            const fastForwardArgs = getFastForwardOptions('bugfix');
            const preserveMergesArgs = getPreserveMergesOption('bugfix');
            const retentionArgs = getBranchRetentionOptions('bugfix');
            const strategyArgs = getMergeStrategy('bugfix', 'finish');
            const branchInfo = await getCurrentBranch();

            if (branchInfo.type === 'bugfix') {
                const tagArgs = await getTagOptions('bugfix', branchInfo.name);
                await executeGitFlowCommand('bugfix finish', [branchInfo.name, ...strategyArgs, ...fastForwardArgs, ...preserveMergesArgs, ...tagArgs, ...retentionArgs]);
            } else {
                const output = await executeGitFlowCommand('bugfix list', [], { showOutput: false });
                const bugfixes = output.split('\n')
                    .filter(line => line.trim())
                    .filter(line => !line.trim().endsWith(':')) // Filter out header lines
                    .filter(line => !line.includes('No bugfix branches')) // Filter out "No bugfix branches" messages
                    .map(line => line.trim());

                if (bugfixes.length === 0) {
                    vscode.window.showInformationMessage('No bugfix branches available to finish');
                    return;
                }

                const selectedBugfix = await showBranchSelection(bugfixes, 'Select bugfix to finish');
                if (selectedBugfix) {
                    const tagArgs = await getTagOptions('bugfix', selectedBugfix);
                    await executeGitFlowCommand('bugfix finish', [selectedBugfix, ...strategyArgs, ...fastForwardArgs, ...preserveMergesArgs, ...tagArgs, ...retentionArgs]);
                }
            }
            await updateContextVariables();
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const bugfixListCommand = vscode.commands.registerCommand('git-flow-next.bugfix.list', async () => {
        await executeGitFlowCommand('bugfix list');
    });

    const bugfixCheckoutCommand = vscode.commands.registerCommand('git-flow-next.bugfix.checkout', async () => {
        try {
            const output = await executeGitFlowCommand('bugfix list', [], { showOutput: false });
            const bugfixes = output.split('\n')
                .filter(line => line.trim())
                .filter(line => !line.trim().endsWith(':')) // Filter out header lines
                .filter(line => !line.includes('No bugfix branches')) // Filter out "No bugfix branches" messages
                .map(line => line.trim());

            if (bugfixes.length === 0) {
                vscode.window.showInformationMessage('No bugfix branches available to checkout');
                return;
            }

            const selectedBugfix = await showBranchSelection(bugfixes, 'Select bugfix to checkout');
            if (selectedBugfix) {
                await executeGitFlowCommand('bugfix checkout', [selectedBugfix]);
            }
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const bugfixDeleteCommand = vscode.commands.registerCommand('git-flow-next.bugfix.delete', async () => {
        try {
            const output = await executeGitFlowCommand('bugfix list', [], { showOutput: false });
            const bugfixes = output.split('\n')
                .filter(line => line.trim())
                .filter(line => !line.trim().endsWith(':')) // Filter out header lines
                .filter(line => !line.includes('No bugfix branches')) // Filter out "No bugfix branches" messages
                .map(line => line.trim());

            if (bugfixes.length === 0) {
                vscode.window.showInformationMessage('No bugfix branches available to delete');
                return;
            }

            const selectedBugfix = await showBranchSelection(bugfixes, 'Select bugfix to delete');
            if (selectedBugfix) {
                const confirmed = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete bugfix "${selectedBugfix}"?`,
                    'Yes', 'No'
                );
                if (confirmed === 'Yes') {
                    await executeGitFlowCommand('bugfix delete', [selectedBugfix]);
                }
            }
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const bugfixRenameCommand = vscode.commands.registerCommand('git-flow-next.bugfix.rename', async () => {
        try {
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type === 'bugfix') {
                if (!branchInfo.name || branchInfo.name.trim().length === 0) {
                    vscode.window.showErrorMessage('Failed to get current branch name');
                    return;
                }
                const newName = await promptForInput('Enter new bugfix name', branchInfo.name);
                if (newName) {
                    await executeGitFlowCommand('bugfix rename', [branchInfo.name, newName]);
                }
            } else {
                vscode.window.showWarningMessage('You must be on a bugfix branch to rename it');
            }
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const bugfixUpdateCommand = vscode.commands.registerCommand('git-flow-next.bugfix.update', async () => {
        try {
            const strategyArgs = getMergeStrategy('bugfix', 'update');
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type === 'bugfix') {
                await executeGitFlowCommand('bugfix update', [branchInfo.name, ...strategyArgs]);
            } else {
                vscode.window.showWarningMessage('You must be on a bugfix branch to update it');
            }
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    // Shorthand commands
    const shorthandFinishCommand = vscode.commands.registerCommand('git-flow-next.shorthand.finish', async () => {
        try {
            await executeGitFlowCommand('finish');
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const shorthandDeleteCommand = vscode.commands.registerCommand('git-flow-next.shorthand.delete', async () => {
        try {
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type !== 'unknown' && branchInfo.type !== 'main' && branchInfo.type !== 'develop') {
                const confirmed = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete "${branchInfo.fullName}"?`,
                    'Yes', 'No'
                );
                if (confirmed === 'Yes') {
                    await executeGitFlowCommand('delete');
                }
            } else {
                vscode.window.showWarningMessage('Cannot delete main/develop or unknown branch');
            }
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const shorthandRebaseCommand = vscode.commands.registerCommand('git-flow-next.shorthand.rebase', async () => {
        try {
            await executeGitFlowCommand('rebase');
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const shorthandUpdateCommand = vscode.commands.registerCommand('git-flow-next.shorthand.update', async () => {
        try {
            await executeGitFlowCommand('update');
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const shorthandRenameCommand = vscode.commands.registerCommand('git-flow-next.shorthand.rename', async () => {
        try {
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type !== 'unknown' && branchInfo.type !== 'main' && branchInfo.type !== 'develop') {
                const newName = await promptForInput('Enter new branch name', branchInfo.name);
                if (newName) {
                    await executeGitFlowCommand('rename', [newName]);
                }
            } else {
                vscode.window.showWarningMessage('Cannot rename main/develop or unknown branch');
            }
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const shorthandPublishCommand = vscode.commands.registerCommand('git-flow-next.shorthand.publish', async () => {
        try {
            await executeGitFlowCommand('publish');
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    // Overview command
    const overviewCommand = vscode.commands.registerCommand('git-flow-next.overview', async () => {
        try {
            await executeGitFlowCommand('overview');
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    // Config command
    const configCommand = vscode.commands.registerCommand('git-flow-next.config', async () => {
        try {
            await executeGitFlowCommand('config');
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    // Finish operation control commands
    const finishContinueCommand = vscode.commands.registerCommand('git-flow-next.finish.continue', async () => {
        try {
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type !== 'unknown' && branchInfo.type !== 'main' && branchInfo.type !== 'develop') {
                await executeGitFlowCommand(`${branchInfo.type} finish`, ['--continue']);
                await updateContextVariables();
            } else {
                vscode.window.showWarningMessage('Cannot continue finish on main/develop or unknown branch');
            }
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    const finishAbortCommand = vscode.commands.registerCommand('git-flow-next.finish.abort', async () => {
        try {
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type !== 'unknown' && branchInfo.type !== 'main' && branchInfo.type !== 'develop') {
                await executeGitFlowCommand(`${branchInfo.type} finish`, ['--abort']);
                await updateContextVariables();
            } else {
                vscode.window.showWarningMessage('Cannot abort finish on main/develop or unknown branch');
            }
        } catch (error) {
            // Error already shown by executeGitFlowCommand
        }
    });

    // Register all commands
    context.subscriptions.push(
        installPackageCommand,
        showInstallInstructionsCommand,
        initCommand,
        initFromWelcomeCommand,
        featureStartCommand, featureFinishCommand, featureListCommand, featureCheckoutCommand,
        featureDeleteCommand, featureRenameCommand, featureUpdateCommand,
        releaseStartCommand, releaseFinishCommand, releaseListCommand, releaseCheckoutCommand,
        releaseDeleteCommand, releaseRenameCommand, releaseUpdateCommand,
        hotfixStartCommand, hotfixFinishCommand, hotfixListCommand, hotfixCheckoutCommand,
        hotfixDeleteCommand, hotfixRenameCommand, hotfixUpdateCommand,
        supportStartCommand, supportFinishCommand, supportListCommand, supportCheckoutCommand,
        supportDeleteCommand, supportRenameCommand, supportUpdateCommand,
        bugfixStartCommand, bugfixFinishCommand, bugfixListCommand, bugfixCheckoutCommand,
        bugfixDeleteCommand, bugfixRenameCommand, bugfixUpdateCommand,
        shorthandFinishCommand, shorthandDeleteCommand, shorthandRebaseCommand,
        shorthandUpdateCommand, shorthandRenameCommand, shorthandPublishCommand,
        finishContinueCommand, finishAbortCommand,
        overviewCommand, configCommand
    );
}

export function deactivate() {}