import * as core from '@actions/core';
import * as github from '@actions/github';
import { Octokit } from '@octokit/action';

import { wait } from './wait';

const { GITHUB_REPOSITORY = '', GITHUB_REF = '' } = process.env;

const [owner, repo] = GITHUB_REPOSITORY.split('/');
const issue_number = GITHUB_REF.split('/')[2];
// const configPath = core.getInput('configuration-path');

const octokit = new Octokit();

async function run(): Promise<void> {
  try {
    const files = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: parseInt(issue_number),
    });

    const ms: string = core.getInput('milliseconds');

    const invalidFiles = files.data.filter(
      (file) =>
        file.status === 'added' &&
        (file.filename.endsWith('.js') || file.filename.endsWith('.jsx'))
    );
    if (invalidFiles.length > 0) {
      const message = `${invalidFiles.length} js(x)? files are added, please convert to ts(x).`;
      await octokit.pulls.createReview({
        owner,
        event: 'REQUEST_CHANGES',
        repo,
        pull_number: parseInt(issue_number),
        body: message,
      });
      throw new Error(message);
    }
    core.setOutput('time', new Date().toTimeString());
  } catch (error) {
    core.setFailed((error as any).message);
  }
}

run();
