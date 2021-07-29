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
    if (!github.context.payload.pull_request) {
      throw new Error('Not a pull request');
    }
    // const { ignore } = await getConfig();
    const { number } = github.context.payload.pull_request;

    const files = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: number,
    });

    core.debug(JSON.stringify(files, null, 2));
    const ms: string = core.getInput('milliseconds');
    core.debug(`Waiting ${ms} milliseconds ...`); // debug is only output if you set the secret `ACTIONS_RUNNER_DEBUG` to true

    core.debug(new Date().toTimeString());
    await wait(parseInt(ms, 10));
    core.debug(new Date().toTimeString());

    core.setOutput('time', new Date().toTimeString());
  } catch (error) {
    core.setFailed((error as any).message);
  }
}

run();
