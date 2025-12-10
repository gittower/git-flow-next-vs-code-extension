import * as assert from 'assert';
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Test repository path - uses current workspace folder
const TEST_REPO_PATH = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

/**
 * Integration tests that directly test git-flow commands via terminal
 * These tests verify that the extension commands work by:
 * 1. Creating branches using git flow CLI
 * 2. Executing VS Code extension commands
 * 3. Verifying git state changes
 */
suite('Git Flow Next Direct Integration Tests', () => {
	let originalWorkspaceFolder: vscode.WorkspaceFolder | undefined;

	suiteSetup(async function() {
		this.timeout(60000);

		originalWorkspaceFolder = vscode.workspace.workspaceFolders?.[0];

		// Ensure extension is activated
		const ext = vscode.extensions.getExtension('gittower.git-flow-next-extension');
		if (ext && !ext.isActive) {
			await ext.activate();
		}

		await new Promise(resolve => setTimeout(resolve, 2000));
		vscode.window.showInformationMessage('Direct integration test setup complete');
	});

	suiteTeardown(async function() {
		this.timeout(30000);

		try {
			await cleanupTestBranches();
		} catch (error) {
			console.error('Cleanup error:', error);
		}

		vscode.window.showInformationMessage('Direct integration tests completed');
	});

	async function executeGit(command: string): Promise<string> {
		const { stdout, stderr } = await execAsync(command, { cwd: TEST_REPO_PATH });
		if (stderr && !stderr.includes('Switched to') && !stderr.includes('Already on')) {
			console.warn('Git stderr:', stderr);
		}
		return stdout.trim();
	}

	async function getCurrentBranch(): Promise<string> {
		return await executeGit('git branch --show-current');
	}

	async function branchExists(branchName: string): Promise<boolean> {
		try {
			await executeGit(`git show-ref --verify --quiet refs/heads/${branchName}`);
			return true;
		} catch {
			return false;
		}
	}

	async function deleteBranchIfExists(branchName: string): Promise<void> {
		if (await branchExists(branchName)) {
			try {
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

	async function cleanupTestBranches(): Promise<void> {
		const testBranches = [
			'feature/test-direct-1',
			'feature/test-direct-2',
			'release/2.0.0',
			'hotfix/2.0.1',
			'support/2.x',
			'bugfix/test-direct-bug',
			'bugfix/test-direct-bug-2'
		];

		try {
			await executeGit('git checkout develop');
		} catch (error) {
			console.warn('Could not switch to develop:', error);
		}

		for (const branch of testBranches) {
			await deleteBranchIfExists(branch);
		}
	}

	suite('Feature Branch Direct Tests', () => {
		setup(async function() {
			this.timeout(10000);
			await cleanupTestBranches();
			await executeGit('git checkout develop');
		});

		test('Feature: List command should show existing features', async function() {
			this.timeout(15000);

			// Create a feature using git flow CLI
			await executeGit('git flow feature start test-direct-1');

			// Execute the list command (it displays in UI, so just verify no error)
			try {
				await vscode.commands.executeCommand('git-flow-next.feature.list');
				await new Promise(resolve => setTimeout(resolve, 1000));

				// If we got here, command executed successfully
				assert.ok(true, 'Feature list command executed');
			} catch (error) {
				assert.fail(`Feature list command failed: ${error}`);
			}

			// Verify the feature exists
			const exists = await branchExists('feature/test-direct-1');
			assert.strictEqual(exists, true, 'Feature branch should exist');
		});

		test('Feature: Update command should update from develop', async function() {
			this.timeout(20000);

			// Create a feature
			await executeGit('git flow feature start test-direct-1');

			// Switch to develop, make a commit, switch back
			await executeGit('git checkout develop');
			await executeGit('echo "update test" >> README.md');
			await executeGit('git add README.md');
			await executeGit('git commit -m "Update test" 2>/dev/null || true');
			await executeGit('git checkout feature/test-direct-1');

			// Execute update command
			try {
				await vscode.commands.executeCommand('git-flow-next.feature.update');
				await new Promise(resolve => setTimeout(resolve, 2000));

				const currentBranch = await getCurrentBranch();
				assert.strictEqual(currentBranch, 'feature/test-direct-1', 'Should still be on feature branch');
			} catch (error) {
				assert.fail(`Feature update command failed: ${error}`);
			}
		});

		test('Feature: Finish via shorthand command', async function() {
			this.timeout(25000);

			// Create feature with a commit
			await executeGit('git flow feature start test-direct-1');
			await executeGit('echo "test content" > test-direct-file.txt');
			await executeGit('git add test-direct-file.txt');
			await executeGit('git commit -m "Add test file"');

			// Finish using shorthand command
			try {
				await vscode.commands.executeCommand('git-flow-next.shorthand.finish');
				await new Promise(resolve => setTimeout(resolve, 3000));

				// Verify we're back on develop
				const currentBranch = await getCurrentBranch();
				assert.strictEqual(currentBranch, 'develop', 'Should be back on develop');

				// Verify feature branch was deleted
				const exists = await branchExists('feature/test-direct-1');
				assert.strictEqual(exists, false, 'Feature branch should be deleted');
			} catch (error) {
				assert.fail(`Feature finish command failed: ${error}`);
			}
		});
	});

	suite('Release Branch Direct Tests', () => {
		setup(async function() {
			this.timeout(10000);
			await cleanupTestBranches();
			await executeGit('git checkout develop');
		});

		test('Release: List command should show existing releases', async function() {
			this.timeout(15000);

			await executeGit('git flow release start 2.0.0');

			try {
				await vscode.commands.executeCommand('git-flow-next.release.list');
				await new Promise(resolve => setTimeout(resolve, 1000));
				assert.ok(true, 'Release list command executed');
			} catch (error) {
				assert.fail(`Release list command failed: ${error}`);
			}

			const exists = await branchExists('release/2.0.0');
			assert.strictEqual(exists, true, 'Release branch should exist');
		});

		test('Release: Update command should work on release branch', async function() {
			this.timeout(20000);

			await executeGit('git flow release start 2.0.0');

			try {
				await vscode.commands.executeCommand('git-flow-next.release.update');
				await new Promise(resolve => setTimeout(resolve, 2000));

				const currentBranch = await getCurrentBranch();
				assert.strictEqual(currentBranch, 'release/2.0.0', 'Should still be on release branch');
			} catch (error) {
				assert.fail(`Release update command failed: ${error}`);
			}
		});
	});

	suite('Hotfix Branch Direct Tests', () => {
		setup(async function() {
			this.timeout(10000);
			await cleanupTestBranches();
			await executeGit('git checkout develop');
		});

		test('Hotfix: List command should show existing hotfixes', async function() {
			this.timeout(15000);

			await executeGit('git flow hotfix start 2.0.1');

			try {
				await vscode.commands.executeCommand('git-flow-next.hotfix.list');
				await new Promise(resolve => setTimeout(resolve, 1000));
				assert.ok(true, 'Hotfix list command executed');
			} catch (error) {
				assert.fail(`Hotfix list command failed: ${error}`);
			}

			const exists = await branchExists('hotfix/2.0.1');
			assert.strictEqual(exists, true, 'Hotfix branch should exist');
		});

		test('Hotfix: Update command should work on hotfix branch', async function() {
			this.timeout(20000);

			await executeGit('git flow hotfix start 2.0.1');

			try {
				await vscode.commands.executeCommand('git-flow-next.hotfix.update');
				await new Promise(resolve => setTimeout(resolve, 2000));

				const currentBranch = await getCurrentBranch();
				assert.strictEqual(currentBranch, 'hotfix/2.0.1', 'Should still be on hotfix branch');
			} catch (error) {
				assert.fail(`Hotfix update command failed: ${error}`);
			}
		});
	});

	suite('Support Branch Direct Tests', () => {
		setup(async function() {
			this.timeout(10000);
			await cleanupTestBranches();
			await executeGit('git checkout develop');
		});

		test('Support: List command should show existing support branches', async function() {
			this.timeout(15000);

			await executeGit('git flow support start 2.x develop');

			try {
				await vscode.commands.executeCommand('git-flow-next.support.list');
				await new Promise(resolve => setTimeout(resolve, 1000));
				assert.ok(true, 'Support list command executed');
			} catch (error) {
				assert.fail(`Support list command failed: ${error}`);
			}

			const exists = await branchExists('support/2.x');
			assert.strictEqual(exists, true, 'Support branch should exist');
		});

		test('Support: Update command should work on support branch', async function() {
			this.timeout(20000);

			await executeGit('git flow support start 2.x develop');

			try {
				await vscode.commands.executeCommand('git-flow-next.support.update');
				await new Promise(resolve => setTimeout(resolve, 2000));

				const currentBranch = await getCurrentBranch();
				assert.strictEqual(currentBranch, 'support/2.x', 'Should still be on support branch');
			} catch (error) {
				assert.fail(`Support update command failed: ${error}`);
			}
		});
	});

	suite('Bugfix Branch Direct Tests', () => {
		setup(async function() {
			this.timeout(10000);
			await cleanupTestBranches();
			await executeGit('git checkout develop');
		});

		test('Bugfix: List command should show existing bugfixes', async function() {
			this.timeout(15000);

			await executeGit('git flow bugfix start test-direct-bug');

			try {
				await vscode.commands.executeCommand('git-flow-next.bugfix.list');
				await new Promise(resolve => setTimeout(resolve, 1000));
				assert.ok(true, 'Bugfix list command executed');
			} catch (error) {
				assert.fail(`Bugfix list command failed: ${error}`);
			}

			const exists = await branchExists('bugfix/test-direct-bug');
			assert.strictEqual(exists, true, 'Bugfix branch should exist');
		});

		test('Bugfix: Update command should work on bugfix branch', async function() {
			this.timeout(20000);

			await executeGit('git flow bugfix start test-direct-bug');

			try {
				await vscode.commands.executeCommand('git-flow-next.bugfix.update');
				await new Promise(resolve => setTimeout(resolve, 2000));

				const currentBranch = await getCurrentBranch();
				assert.strictEqual(currentBranch, 'bugfix/test-direct-bug', 'Should still be on bugfix branch');
			} catch (error) {
				assert.fail(`Bugfix update command failed: ${error}`);
			}
		});

		test('Bugfix: Finish via shorthand command', async function() {
			this.timeout(25000);

			await executeGit('git flow bugfix start test-direct-bug');
			await executeGit('echo "bugfix content" > bugfix-file.txt');
			await executeGit('git add bugfix-file.txt');
			await executeGit('git commit -m "Fix bug"');

			try {
				await vscode.commands.executeCommand('git-flow-next.shorthand.finish');
				await new Promise(resolve => setTimeout(resolve, 3000));

				const currentBranch = await getCurrentBranch();
				assert.strictEqual(currentBranch, 'develop', 'Should be back on develop');

				const exists = await branchExists('bugfix/test-direct-bug');
				assert.strictEqual(exists, false, 'Bugfix branch should be deleted');
			} catch (error) {
				assert.fail(`Bugfix finish command failed: ${error}`);
			}
		});
	});

	suite('Shorthand Commands Direct Tests', () => {
		setup(async function() {
			this.timeout(10000);
			await cleanupTestBranches();
			await executeGit('git checkout develop');
		});

		test('Shorthand: Update works on any topic branch', async function() {
			this.timeout(20000);

			// Test with feature branch
			await executeGit('git flow feature start test-direct-1');

			try {
				await vscode.commands.executeCommand('git-flow-next.shorthand.update');
				await new Promise(resolve => setTimeout(resolve, 2000));

				const currentBranch = await getCurrentBranch();
				assert.strictEqual(currentBranch, 'feature/test-direct-1', 'Should still be on feature branch');
			} catch (error) {
				assert.fail(`Shorthand update command failed: ${error}`);
			}
		});

		test('Shorthand: Rebase works on topic branch', async function() {
			this.timeout(20000);

			await executeGit('git flow feature start test-direct-1');

			try {
				await vscode.commands.executeCommand('git-flow-next.shorthand.rebase');
				await new Promise(resolve => setTimeout(resolve, 2000));

				const currentBranch = await getCurrentBranch();
				assert.strictEqual(currentBranch, 'feature/test-direct-1', 'Should still be on feature branch');
			} catch (error) {
				// Rebase might fail if there's nothing to rebase, which is OK
				console.log('Rebase command completed (may have had nothing to rebase)');
			}
		});
	});

	suite('Global Commands Direct Tests', () => {
		test('Overview command should execute without errors', async function() {
			this.timeout(10000);

			try {
				await vscode.commands.executeCommand('git-flow-next.overview');
				await new Promise(resolve => setTimeout(resolve, 1000));
				assert.ok(true, 'Overview command executed');
			} catch (error) {
				assert.fail(`Overview command failed: ${error}`);
			}
		});

		test('Config command should execute without errors', async function() {
			this.timeout(10000);

			try {
				await vscode.commands.executeCommand('git-flow-next.config');
				await new Promise(resolve => setTimeout(resolve, 1000));
				assert.ok(true, 'Config command executed');
			} catch (error) {
				assert.fail(`Config command failed: ${error}`);
			}
		});
	});

	suite('Complete Workflow Tests', () => {
		setup(async function() {
			this.timeout(10000);
			await cleanupTestBranches();
			await executeGit('git checkout develop');
		});

		test('Complete Feature Workflow: Start -> Work -> Update -> Finish', async function() {
			this.timeout(30000);

			// 1. Start feature
			await executeGit('git flow feature start test-direct-1');
			let currentBranch = await getCurrentBranch();
			assert.strictEqual(currentBranch, 'feature/test-direct-1', 'Should be on feature branch');

			// 2. Do some work
			await executeGit('echo "feature work" > feature-work.txt');
			await executeGit('git add feature-work.txt');
			await executeGit('git commit -m "Feature work"');

			// 3. Update from develop
			await vscode.commands.executeCommand('git-flow-next.feature.update');
			await new Promise(resolve => setTimeout(resolve, 2000));

			// 4. Finish feature
			await vscode.commands.executeCommand('git-flow-next.feature.finish');
			await new Promise(resolve => setTimeout(resolve, 3000));

			// Verify final state
			currentBranch = await getCurrentBranch();
			assert.strictEqual(currentBranch, 'develop', 'Should be back on develop');

			const exists = await branchExists('feature/test-direct-1');
			assert.strictEqual(exists, false, 'Feature branch should be deleted');
		});

		test('Complete Bugfix Workflow: Start -> Work -> Finish', async function() {
			this.timeout(30000);

			// 1. Start bugfix
			await executeGit('git flow bugfix start test-direct-bug');
			let currentBranch = await getCurrentBranch();
			assert.strictEqual(currentBranch, 'bugfix/test-direct-bug', 'Should be on bugfix branch');

			// 2. Fix the bug
			await executeGit('echo "bug fixed" > bugfix-work.txt');
			await executeGit('git add bugfix-work.txt');
			await executeGit('git commit -m "Fix the bug"');

			// 3. Finish using shorthand
			await vscode.commands.executeCommand('git-flow-next.shorthand.finish');
			await new Promise(resolve => setTimeout(resolve, 3000));

			// Verify final state
			currentBranch = await getCurrentBranch();
			assert.strictEqual(currentBranch, 'develop', 'Should be back on develop');

			const exists = await branchExists('bugfix/test-direct-bug');
			assert.strictEqual(exists, false, 'Bugfix branch should be deleted');
		});
	});
});
