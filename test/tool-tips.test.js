const test = require('node:test');
const assert = require('node:assert/strict');

const { getTip, redactCommand } = require('../src/hooks/tool-tips');

test('redactCommand hides common secret values', () => {
  const command = [
    'curl https://api.example.com?api_key=sk-abc123456789',
    '-H "Authorization: Bearer sk-secret987654321"',
    'OPENAI_API_KEY=sk-env123456789',
    'PASSWORD=hunter2',
  ].join(' ');

  const redacted = redactCommand(command);

  assert.doesNotMatch(redacted, /sk-abc123456789/);
  assert.doesNotMatch(redacted, /sk-secret987654321/);
  assert.doesNotMatch(redacted, /sk-env123456789/);
  assert.doesNotMatch(redacted, /hunter2/);
  assert.match(redacted, /api_key=\[REDACTED\]/);
  assert.match(redacted, /Authorization: Bearer \[REDACTED\]/i);
  assert.match(redacted, /OPENAI_API_KEY=\[REDACTED\]/);
  assert.match(redacted, /PASSWORD=\[REDACTED\]/);
});

test('redactCommand hides quoted environment secret values', () => {
  const redacted = redactCommand('PASSWORD="hunter2" TOKEN=\'abc123\'');

  assert.doesNotMatch(redacted, /hunter2/);
  assert.doesNotMatch(redacted, /abc123/);
  assert.match(redacted, /PASSWORD=\[REDACTED\]/);
  assert.match(redacted, /TOKEN=\[REDACTED\]/);
});

test('redactCommand hides lowercase environment secret names', () => {
  const redacted = redactCommand('password=hunter2 openai_api_key=abc123456 github_token=ghp_secret123456');

  assert.doesNotMatch(redacted, /hunter2/);
  assert.doesNotMatch(redacted, /abc123456/);
  assert.doesNotMatch(redacted, /ghp_secret123456/);
  assert.match(redacted, /password=\[REDACTED\]/);
  assert.match(redacted, /openai_api_key=\[REDACTED\]/);
  assert.match(redacted, /github_token=\[REDACTED\]/);
});

test('getTip redacts bash command before printing', () => {
  const tip = getTip({
    tool_name: 'Bash',
    tool_input: {
      command: 'OPENAI_API_KEY=sk-test123456789 node script.js',
    },
  });

  assert.match(tip, /OPENAI_API_KEY=\[REDACTED\]/);
  assert.doesNotMatch(tip, /sk-test123456789/);
});

test('getTip does not leak short unknown secret commands in bash explanation', () => {
  const tip = getTip({
    tool_name: 'Bash',
    tool_input: {
      command: 'PASSWORD=hunter2',
    },
  });

  assert.match(tip, /PASSWORD=\[REDACTED\]/);
  assert.doesNotMatch(tip, /hunter2/);
});
