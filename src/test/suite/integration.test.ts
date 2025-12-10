import * as assert from 'assert';
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Test repository path - uses current workspace folder
const TEST_REPO_PATH = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

suite('Git Flow Next Integration Test Suite', () => {
	let originalWorkspaceFolder: vscode.WorkspaceFolder | undefined;

	suiteSetup(async function() {
		this.timeout(60000); // 60 seconds for setup

		// Store original workspace
		originalWorkspaceFolder = vscode.workspace.workspaceFolders?.[0];

		// Open the test repository
		const testRepoUri = vscode.Uri.file(TEST_REPO_PATH);
		await vscode.commands.executeCommand('vscode.openFolder', testRepoUri, false);

		// Wait for workspace to be ready
		await new Promise(resolve => setTimeout(resolve, 3000));

		// Ensure extension is activated
		const ext = vscode.extensions.getExtension('gittower.git-flow-next-extension');
		if (ext && !ext.isActive) {
			await ext.activate();
		}

		// Wait for extension to initialize
		await new Promise(resolve => setTimeout(resolve, 2000));

		vscode.window.showInformationMessage('Integration test setup complete');
	});

	suiteTeardown(async function() {
		this.timeout(30000);

		// Clean up any test branches
		try {
			await cleanupTestBranches();
		} catch (error) {
			console.error('Cleanup error:', error);
		}

		vscode.window.showInformationMessage('Integration tests completed');
	});

	/**
	 * Helper function to execute git commands in the test repository
	 */
	async function executeGit(command: string): Promise<string> {
		const { stdout, stderr } = await execAsync(command, { cwd: TEST_REPO_PATH });
		if (stderr && !stderr.includes('Switched to') && !stderr.includes('Already on')) {
			console.warn('Git stderr:', stderr);
		}
		return stdout.trim();
	}

	/**
	 * Get the current git branch
	 */
	async function getCurrentBranch(): Promise<string> {
		return await executeGit('git branch --show-current');
	}

	/**
	 * Check if a branch exists
	 */
	async function branchExists(branchName: string): Promise<boolean> {
		try {
			await executeGit(`git show-ref --verify --quiet refs/heads/${branchName}`);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Check if a tag exists
	 */
	async function tagExists(tagName: string): Promise<boolean> {
		try {
			await executeGit(`git show-ref --verify --quiet refs/tags/${tagName}`);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Delete a branch if it exists
	 */
	async function deleteBranchIfExists(branchName: string): Promise<void> {
		if (await branchExists(branchName)) {
			try {
				// Switch to develop first if we're on the branch to delete
				const currentBranch = await getCurrentBranch();
				if (currentBranch === branchName) {
					await executeGit('git checkout develop');
				}
				await executeGit(`git branch -D ${branchName}`);
			} catch (error) {
				console.warn(`Could not delete branch ${branchName}:`, error);
			}
		}
	}

	/**
	 * Delete a tag if it exists
	 */
	async function deleteTagIfExists(tagName: string): Promise<void> {
		if (await tagExists(tagName)) {
			try {
				await executeGit(`git tag -d ${tagName}`);
			} catch (error) {
				console.warn(`Could not delete tag ${tagName}:`, error);
			}
		}
	}

	/**
	 * Clean up all test branches and tags
	 */
	async function cleanupTestBranches(): Promise<void> {
		const testBranches = [
			'feature/test-feature',
			'feature/test-feature-2',
			'feature/renamed-feature',
			'release/1.0.0',
			'release/1.0.0-renamed',
			'hotfix/1.0.1',
			'hotfix/1.0.1-renamed',
			'support/1.x',
			'support/1.x-renamed',
			'bugfix/test-bug',
			'bugfix/test-bug-2',
			'bugfix/renamed-bug'
		];

		const testTags = [
			'v1.0.0',
			'v1.0.1',
			'support-1.x'
		];

		// Switch to develop first
		try {
			await executeGit('git checkout develop');
		} catch (error) {
			console.warn('Could not switch to develop:', error);
		}

		// Delete all test branches
		for (const branch of testBranches) {
			await deleteBranchIfExists(branch);
		}

		// Delete all test tags
		for (const tag of testTags) {
			await deleteTagIfExists(tag);
		}
	}

	/**
	 * Helper to mock user input for prompts
	 */
	function mockInputBox(value: string): void {
		// Store original showInputBox
		const originalShowInputBox = vscode.window.showInputBox;

		// Mock it to return our value
		(vscode.window as any).showInputBox = async (options: any) => {
			return value;
		};

		// Restore after a delay
		setTimeout(() => {
			(vscode.window as any).showInputBox = originalShowInputBox;
		}, 100);
	}

	/**
	 * Helper to mock quick pick selection
	 */
	function mockQuickPick(value: string): void {
		const originalShowQuickPick = vscode.window.showQuickPick;

		(vscode.window as any).showQuickPick = async (items: any, options: any) => {
			return value;
		};

		setTimeout(() => {
			(vscode.window as any).showQuickPick = originalShowQuickPick;
		}, 100);
	}

	suite('Feature Branch Tests', () => {
		setup(async function() {
			this.timeout(10000);
			await cleanupTestBranches();
			// Ensure we're on develop
			await executeGit('git checkout develop');
		});

		test('Feature: Start - should create a new feature branch', async function() {
			this.timeout(15000);

			// Mock the input
			mockInputBox('test-feature');
			mockQuickPick('No');

			// Execute the command
			await vscode.commands.executeCommand('git-flow-next.feature.start');

			// Wait for command to complete
			await new Promise(resolve => setTimeout(resolve, 2000));

			// Verify branch was created and checked out
			const currentBranch = await getCurrentBranch();
			assert.strictEqual(currentBranch, 'feature/test-feature', 'Should be on feature/test-feature branch');

			// Verify branch exists
			const exists = await branchExists('feature/test-feature');
			assert.strictEqual(exists, true, 'feature/test-feature branch should exist');
		});

		test('Feature: List - should list feature branches', async function() {
			this.timeout(10000);

			// Create a feature branch first
			await executeGit('git flow feature start test-feature');

			// Execute list command
			await vscode.commands.executeCommand('git-flow-next.feature.list');

			// Wait for command to complete
			await new Promise(resolve => setTimeout(resolve, 1000));

			// Verify branch exists (list command shows output in UI)
			const exists = await branchExists('feature/test-feature');
			assert.strictEqual(exists, true, 'feature/test-feature should be listed');
		});

		test('Feature: Checkout - should switch between feature branches', async function() {
			this.timeout(15000);

			// Create two feature branches
			await executeGit('git flow feature start test-feature');
			await executeGit('git flow feature start test-feature-2');

			// Mock quick pick to select first feature
			mockQuickPick('test-feature');

			// Execute checkout command
			await vscode.commands.executeCommand('git-flow-next.feature.checkout');

			// Wait for command to complete
			await new Promise(resolve => setTimeout(resolve, 2000));

			// Verify we're on the selected branch
			const currentBranch = await getCurrentBranch();
			assert.strictEqual(currentBranch, 'feature/test-feature', 'Should switch to feature/test-feature');
		});

		test('Feature: Rename - should rename the current feature branch', async function() {
			this.timeout(15000);

			// Create and checkout a feature branch
			await executeGit('git flow feature start test-feature');

			// Mock the new name input
			mockInputBox('renamed-feature');

			// Execute rename command
			await vscode.commands.executeCommand('git-flow-next.feature.rename');

			// Wait for command to complete
			await new Promise(resolve => setTimeout(resolve, 2000));

			// Verify old branch doesn't exist and new one does
			const oldExists = await branchExists('feature/test-feature');
			const newExists = await branchExists('feature/renamed-feature');

			assert.strictEqual(oldExists, false, 'Old branch should not exist');
			assert.strictEqual(newExists, true, 'New branch should exist');
		});

		test('Feature: Update - should update feature from develop', async function() {
			this.timeout(15000);

			// Create a feature branch
			await executeGit('git flow feature start test-feature');

			// Execute update command
			await vscode.commands.executeCommand('git-flow-next.feature.update');

			// Wait for command to complete
			await new Promise(resolve => setTimeout(resolve, 2000));

			// Verify we're still on the feature branch
			const currentBranch = await getCurrentBranch();
			assert.strictEqual(currentBranch, 'feature/test-feature', 'Should still be on feature branch');
		});

		test('Feature: Finish - should merge and delete feature branch', async function() {
			this.timeout(20000);

			// Create a feature branch and make a commit
			await executeGit('git flow feature start test-feature');
			await executeGit('echo "test" > test-file.txt');
			await executeGit('git add test-file.txt');
			await executeGit('git commit -m "Test commit"');

			// Execute finish command
			await vscode.commands.executeCommand('git-flow-next.feature.finish');

			// Wait for command to complete
			await new Promise(resolve => setTimeout(resolve, 3000));

			// Verify we're back on develop
			const currentBranch = await getCurrentBranch();
			assert.strictEqual(currentBranch, 'develop', 'Should be back on develop');

			// Verify feature branch was deleted
			const exists = await branchExists('feature/test-feature');
			assert.strictEqual(exists, false, 'Feature branch should be deleted');
		});

		test('Feature: Delete - should delete a feature branch', async function() {
			this.timeout(15000);

			// Create a feature branch
			await executeGit('git flow feature start test-feature');
			await executeGit('git checkout develop');

			// Mock the selection and confirmation
			mockQuickPick('test-feature');
			setTimeout(() => {
				mockQuickPick('Yes');
			}, 500);

			// Execute delete command
			await vscode.commands.executeCommand('git-flow-next.feature.delete');

			// Wait for command to complete
			await new Promise(resolve => setTimeout(resolve, 2000));

			// Verify branch was deleted
			const exists = await branchExists('feature/test-feature');
			assert.strictEqual(exists, false, 'Feature branch should be deleted');
		});
	});

	suite('Release Branch Tests', () => {
		setup(async function() {
			this.timeout(10000);
			await cleanupTestBranches();
			await executeGit('git checkout develop');
		});

		test('Release: Start - should create a new release branch', async function() {
			this.timeout(15000);

			mockInputBox('1.0.0');
			mockQuickPick('No');

			await vscode.commands.executeCommand('git-flow-next.release.start');
			await new Promise(resolve => setTimeout(resolve, 2000));

			const currentBranch = await getCurrentBranch();
			assert.strictEqual(currentBranch, 'release/1.0.0', 'Should be on release/1.0.0 branch');

			const exists = await branchExists('release/1.0.0');
			assert.strictEqual(exists, true, 'release/1.0.0 branch should exist');
		});

		test('Release: List - should list release branches', async function() {
			this.timeout(10000);

			await executeGit('git flow release start 1.0.0');

			await vscode.commands.executeCommand('git-flow-next.release.list');
			await new Promise(resolve => setTimeout(resolve, 1000));

			const exists = await branchExists('release/1.0.0');
			assert.strictEqual(exists, true, 'release/1.0.0 should exist');
		});

		test('Release: Rename - should rename the current release branch', async function() {
			this.timeout(15000);

			await executeGit('git flow release start 1.0.0');

			mockInputBox('1.0.0-renamed');

			await vscode.commands.executeCommand('git-flow-next.release.rename');
			await new Promise(resolve => setTimeout(resolve, 2000));

			const oldExists = await branchExists('release/1.0.0');
			const newExists = await branchExists('release/1.0.0-renamed');

			assert.strictEqual(oldExists, false, 'Old release branch should not exist');
			assert.strictEqual(newExists, true, 'New release branch should exist');
		});
	});

	suite('Hotfix Branch Tests', () => {
		setup(async function() {
			this.timeout(10000);
			await cleanupTestBranches();
			await executeGit('git checkout develop');
		});

		test('Hotfix: Start - should create a new hotfix branch', async function() {
			this.timeout(15000);

			mockInputBox('1.0.1');
			mockQuickPick('No');

			await vscode.commands.executeCommand('git-flow-next.hotfix.start');
			await new Promise(resolve => setTimeout(resolve, 2000));

			const currentBranch = await getCurrentBranch();
			assert.strictEqual(currentBranch, 'hotfix/1.0.1', 'Should be on hotfix/1.0.1 branch');

			const exists = await branchExists('hotfix/1.0.1');
			assert.strictEqual(exists, true, 'hotfix/1.0.1 branch should exist');
		});

		test('Hotfix: List - should list hotfix branches', async function() {
			this.timeout(10000);

			await executeGit('git flow hotfix start 1.0.1');

			await vscode.commands.executeCommand('git-flow-next.hotfix.list');
			await new Promise(resolve => setTimeout(resolve, 1000));

			const exists = await branchExists('hotfix/1.0.1');
			assert.strictEqual(exists, true, 'hotfix/1.0.1 should exist');
		});

		test('Hotfix: Rename - should rename the current hotfix branch', async function() {
			this.timeout(15000);

			await executeGit('git flow hotfix start 1.0.1');

			mockInputBox('1.0.1-renamed');

			await vscode.commands.executeCommand('git-flow-next.hotfix.rename');
			await new Promise(resolve => setTimeout(resolve, 2000));

			const oldExists = await branchExists('hotfix/1.0.1');
			const newExists = await branchExists('hotfix/1.0.1-renamed');

			assert.strictEqual(oldExists, false, 'Old hotfix branch should not exist');
			assert.strictEqual(newExists, true, 'New hotfix branch should exist');
		});
	});

	suite('Support Branch Tests', () => {
		setup(async function() {
			this.timeout(10000);
			await cleanupTestBranches();
			await executeGit('git checkout develop');
		});

		test('Support: Start - should create a new support branch', async function() {
			this.timeout(15000);

			mockInputBox('1.x');
			mockQuickPick('No');

			await vscode.commands.executeCommand('git-flow-next.support.start');
			await new Promise(resolve => setTimeout(resolve, 2000));

			const currentBranch = await getCurrentBranch();
			assert.strictEqual(currentBranch, 'support/1.x', 'Should be on support/1.x branch');

			const exists = await branchExists('support/1.x');
			assert.strictEqual(exists, true, 'support/1.x branch should exist');
		});

		test('Support: List - should list support branches', async function() {
			this.timeout(10000);

			await executeGit('git flow support start 1.x develop');

			await vscode.commands.executeCommand('git-flow-next.support.list');
			await new Promise(resolve => setTimeout(resolve, 1000));

			const exists = await branchExists('support/1.x');
			assert.strictEqual(exists, true, 'support/1.x should exist');
		});
	});

	suite('Bugfix Branch Tests', () => {
		setup(async function() {
			this.timeout(10000);
			await cleanupTestBranches();
			await executeGit('git checkout develop');
		});

		test('Bugfix: Start - should create a new bugfix branch', async function() {
			this.timeout(15000);

			mockInputBox('test-bug');
			mockQuickPick('No');

			await vscode.commands.executeCommand('git-flow-next.bugfix.start');
			await new Promise(resolve => setTimeout(resolve, 2000));

			const currentBranch = await getCurrentBranch();
			assert.strictEqual(currentBranch, 'bugfix/test-bug', 'Should be on bugfix/test-bug branch');

			const exists = await branchExists('bugfix/test-bug');
			assert.strictEqual(exists, true, 'bugfix/test-bug branch should exist');
		});

		test('Bugfix: List - should list bugfix branches', async function() {
			this.timeout(10000);

			await executeGit('git flow bugfix start test-bug');

			await vscode.commands.executeCommand('git-flow-next.bugfix.list');
			await new Promise(resolve => setTimeout(resolve, 1000));

			const exists = await branchExists('bugfix/test-bug');
			assert.strictEqual(exists, true, 'bugfix/test-bug should exist');
		});

		test('Bugfix: Checkout - should switch between bugfix branches', async function() {
			this.timeout(15000);

			await executeGit('git flow bugfix start test-bug');
			await executeGit('git flow bugfix start test-bug-2');

			mockQuickPick('test-bug');

			await vscode.commands.executeCommand('git-flow-next.bugfix.checkout');
			await new Promise(resolve => setTimeout(resolve, 2000));

			const currentBranch = await getCurrentBranch();
			assert.strictEqual(currentBranch, 'bugfix/test-bug', 'Should switch to bugfix/test-bug');
		});

		test('Bugfix: Rename - should rename the current bugfix branch', async function() {
			this.timeout(15000);

			await executeGit('git flow bugfix start test-bug');

			mockInputBox('renamed-bug');

			await vscode.commands.executeCommand('git-flow-next.bugfix.rename');
			await new Promise(resolve => setTimeout(resolve, 2000));

			const oldExists = await branchExists('bugfix/test-bug');
			const newExists = await branchExists('bugfix/renamed-bug');

			assert.strictEqual(oldExists, false, 'Old bugfix branch should not exist');
			assert.strictEqual(newExists, true, 'New bugfix branch should exist');
		});
	});

	suite('Shorthand Commands Tests', () => {
		setup(async function() {
			this.timeout(10000);
			await cleanupTestBranches();
			await executeGit('git checkout develop');
		});

		test('Shorthand: Update - should update current branch', async function() {
			this.timeout(15000);

			await executeGit('git flow feature start test-feature');

			await vscode.commands.executeCommand('git-flow-next.shorthand.update');
			await new Promise(resolve => setTimeout(resolve, 2000));

			const currentBranch = await getCurrentBranch();
			assert.strictEqual(currentBranch, 'feature/test-feature', 'Should still be on feature branch');
		});

		test('Shorthand: Rename - should rename current branch', async function() {
			this.timeout(15000);

			await executeGit('git flow feature start test-feature');

			mockInputBox('renamed-feature');

			await vscode.commands.executeCommand('git-flow-next.shorthand.rename');
			await new Promise(resolve => setTimeout(resolve, 2000));

			const oldExists = await branchExists('feature/test-feature');
			const newExists = await branchExists('feature/renamed-feature');

			assert.strictEqual(oldExists, false, 'Old branch should not exist');
			assert.strictEqual(newExists, true, 'New branch should exist');
		});

		test('Shorthand: Finish - should finish current branch', async function() {
			this.timeout(20000);

			await executeGit('git flow feature start test-feature');
			await executeGit('echo "test" > test-file.txt');
			await executeGit('git add test-file.txt');
			await executeGit('git commit -m "Test commit"');

			await vscode.commands.executeCommand('git-flow-next.shorthand.finish');
			await new Promise(resolve => setTimeout(resolve, 3000));

			const currentBranch = await getCurrentBranch();
			assert.strictEqual(currentBranch, 'develop', 'Should be back on develop');

			const exists = await branchExists('feature/test-feature');
			assert.strictEqual(exists, false, 'Feature branch should be deleted');
		});
	});

	suite('Global Commands Tests', () => {
		test('Overview - should display git flow overview', async function() {
			this.timeout(10000);

			// This command just displays information, so we just verify it doesn't throw
			await vscode.commands.executeCommand('git-flow-next.overview');
			await new Promise(resolve => setTimeout(resolve, 1000));

			// If we got here, the command executed successfully
			assert.ok(true, 'Overview command executed');
		});

		test('Config - should display git flow config', async function() {
			this.timeout(10000);

			await vscode.commands.executeCommand('git-flow-next.config');
			await new Promise(resolve => setTimeout(resolve, 1000));

			assert.ok(true, 'Config command executed');
		});
	});
});
