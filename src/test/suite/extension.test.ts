import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Git Flow Next Extension Test Suite', () => {
  vscode.window.showInformationMessage('Starting all tests...');

  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('gittower.git-flow-next-extension'));
  });

  test('Extension should activate', async () => {
    const ext = vscode.extensions.getExtension('gittower.git-flow-next-extension');
    assert.ok(ext);
    await ext!.activate();
    assert.strictEqual(ext!.isActive, true);
  });

  test('All Git Flow commands should be registered', async () => {
    const commands = await vscode.commands.getCommands(true);

    const gitFlowCommands = [
      'git-flow-next.init',
      'git-flow-next.feature.start',
      'git-flow-next.feature.finish',
      'git-flow-next.feature.list',
      'git-flow-next.feature.checkout',
      'git-flow-next.feature.delete',
      'git-flow-next.feature.rename',
      'git-flow-next.feature.update',
      'git-flow-next.release.start',
      'git-flow-next.release.finish',
      'git-flow-next.release.list',
      'git-flow-next.release.checkout',
      'git-flow-next.release.delete',
      'git-flow-next.release.rename',
      'git-flow-next.release.update',
      'git-flow-next.hotfix.start',
      'git-flow-next.hotfix.finish',
      'git-flow-next.hotfix.list',
      'git-flow-next.hotfix.checkout',
      'git-flow-next.hotfix.delete',
      'git-flow-next.hotfix.rename',
      'git-flow-next.hotfix.update',
      'git-flow-next.support.start',
      'git-flow-next.support.finish',
      'git-flow-next.support.list',
      'git-flow-next.support.checkout',
      'git-flow-next.support.delete',
      'git-flow-next.support.rename',
      'git-flow-next.support.update',
      'git-flow-next.bugfix.start',
      'git-flow-next.bugfix.finish',
      'git-flow-next.bugfix.list',
      'git-flow-next.bugfix.checkout',
      'git-flow-next.bugfix.delete',
      'git-flow-next.bugfix.rename',
      'git-flow-next.bugfix.update',
      'git-flow-next.shorthand.finish',
      'git-flow-next.shorthand.delete',
      'git-flow-next.shorthand.rebase',
      'git-flow-next.shorthand.update',
      'git-flow-next.shorthand.rename',
      'git-flow-next.shorthand.publish',
      'git-flow-next.overview',
      'git-flow-next.config',
      'git-flow-next.finish.continue',
      'git-flow-next.finish.abort'
    ];

    for (const cmd of gitFlowCommands) {
      assert.ok(
        commands.includes(cmd),
        `Command ${cmd} should be registered`
      );
    }
  });

  test('Sample test - Array indexOf', () => {
    assert.strictEqual(-1, [1, 2, 3].indexOf(5));
    assert.strictEqual(-1, [1, 2, 3].indexOf(0));
  });

  suiteTeardown(() => {
    vscode.window.showInformationMessage('All tests completed!');
  });
});
